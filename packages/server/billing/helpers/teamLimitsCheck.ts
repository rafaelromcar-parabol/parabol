import ms from 'ms'
import {Threshold} from 'parabol-client/types/constEnums'
// Uncomment for easier testing
// import { ThresholdTest as Threshold } from "~/types/constEnums";
import scheduleTeamLimitsJobs from '../../database/types/scheduleTeamLimitsJobs'
import generateUID from '../../generateUID'
import {DataLoaderWorker} from '../../graphql/graphql'
import publishNotification from '../../graphql/public/mutations/helpers/publishNotification'
import getActiveTeamCountByTeamIds from '../../graphql/public/types/helpers/getActiveTeamCountByTeamIds'
import {getFeatureTier} from '../../graphql/types/helpers/getFeatureTier'
import {domainHasActiveDeals} from '../../hubSpot/hubSpotApi'
import getKysely from '../../postgres/getKysely'
import getTeamIdsByOrgIds from '../../postgres/queries/getTeamIdsByOrgIds'
import {Organization} from '../../postgres/types'
import {getBillingLeadersByOrgId} from '../../utils/getBillingLeadersByOrgId'
import sendToSentry from '../../utils/sendToSentry'
import removeTeamsLimitObjects from './removeTeamsLimitObjects'
import sendTeamsLimitEmail from './sendTeamsLimitEmail'

const enableUsageStats = async (userIds: string[], orgId: string) => {
  const pg = getKysely()
  await pg
    .updateTable('OrganizationUser')
    .set({suggestedTier: 'team'})
    .where('orgId', '=', orgId)
    .where('userId', 'in', userIds)
    .where('removedAt', 'is', null)
    .execute()
  const featureFlag = await pg
    .selectFrom('FeatureFlag')
    .select(['id'])
    .where('featureName', '=', 'insights')
    .executeTakeFirst()
  if (featureFlag) {
    const values = [...userIds.map((userId) => ({userId, featureFlagId: featureFlag.id}))]
    await pg
      .insertInto('FeatureFlagOwner')
      .values(values)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}

const sendWebsiteNotifications = async (
  organization: Organization,
  userIds: string[],
  dataLoader: DataLoaderWorker
) => {
  const pg = getKysely()
  const {id: orgId, name: orgName, picture: orgPicture} = organization
  const operationId = dataLoader.share()
  const subOptions = {operationId}
  const notificationsToInsert = userIds.map((userId) => ({
    id: generateUID(),
    type: 'TEAMS_LIMIT_EXCEEDED' as const,
    userId,
    orgId,
    orgName,
    orgPicture
  }))

  await pg.insertInto('Notification').values(notificationsToInsert).execute()
  notificationsToInsert.forEach((notification) => {
    publishNotification(notification, subOptions)
  })
}

// Warning: the function might be expensive
const isLimitExceeded = async (orgId: string) => {
  const teamIds = await getTeamIdsByOrgIds([orgId])
  if (teamIds.length <= Threshold.MAX_STARTER_TIER_TEAMS) {
    return false
  }

  const activeTeamCount = await getActiveTeamCountByTeamIds(teamIds)

  return activeTeamCount >= Threshold.MAX_STARTER_TIER_TEAMS
}

// Warning: the function might be expensive
export const maybeRemoveRestrictions = async (orgId: string, dataLoader: DataLoaderWorker) => {
  const organization = await dataLoader.get('organizations').loadNonNull(orgId)

  if (!organization.tierLimitExceededAt) {
    return
  }

  if (!(await isLimitExceeded(orgId))) {
    const billingLeadersIds = await dataLoader.get('billingLeadersIdsByOrgId').load(orgId)
    const pg = getKysely()
    await Promise.all([
      pg
        .updateTable('Organization')
        .set({tierLimitExceededAt: null, scheduledLockAt: null, lockedAt: null})
        .where('id', '=', orgId)
        .execute(),
      pg
        .updateTable('OrganizationUser')
        .set({suggestedTier: 'starter'})
        .where('orgId', '=', orgId)
        .where('userId', 'in', billingLeadersIds)
        .where('removedAt', 'is', null)
        .execute(),
      removeTeamsLimitObjects(orgId, dataLoader)
    ])
    dataLoader.get('organizations').clear(orgId)
  }
}

// Warning: the function might be expensive
export const checkTeamsLimit = async (orgId: string, dataLoader: DataLoaderWorker) => {
  const organization = await dataLoader.get('organizations').loadNonNull(orgId)
  const {tierLimitExceededAt, tier, trialStartDate, name: orgName} = organization

  const hasTeamsLimitFlag = await dataLoader
    .get('featureFlagByOwnerId')
    .load({ownerId: orgId, featureName: 'teamsLimit'})
  if (!hasTeamsLimitFlag) return

  if (tierLimitExceededAt || getFeatureTier({tier, trialStartDate}) !== 'starter') return

  // if an org is using a free provider, e.g. gmail.com, we can't show them usage stats, so don't send notifications/emails directing them there for now. Issue to fix this here: https://github.com/ParabolInc/parabol/issues/7723
  if (!organization.activeDomain) return

  if (!(await isLimitExceeded(orgId))) return

  const hasActiveDeals = await domainHasActiveDeals(organization.activeDomain)

  if (hasActiveDeals) {
    if (hasActiveDeals instanceof Error) {
      sendToSentry(hasActiveDeals)
    }

    return
  }

  const now = new Date()
  const scheduledLockAt = new Date(now.getTime() + ms(`${Threshold.STARTER_TIER_LOCK_AFTER_DAYS}d`))
  const pg = getKysely()
  await Promise.all([
    pg
      .updateTable('Organization')
      .set({
        tierLimitExceededAt: now,
        scheduledLockAt
      })
      .where('id', '=', orgId)
      .execute()
  ])
  dataLoader.get('organizations').clear(orgId)

  const billingLeaders = await getBillingLeadersByOrgId(orgId, dataLoader)
  const billingLeadersIds = billingLeaders.map((billingLeader) => billingLeader.id)

  // wait for usage stats to be enabled as we dont want to send notifications before it's available
  await enableUsageStats(billingLeadersIds, orgId)
  await Promise.all([
    sendWebsiteNotifications(organization, billingLeadersIds, dataLoader),
    billingLeaders.map((billingLeader) =>
      sendTeamsLimitEmail({
        user: billingLeader,
        orgId,
        orgName,
        emailType: 'thirtyDayWarning'
      })
    ),
    scheduleTeamLimitsJobs(scheduledLockAt, orgId)
  ])
}
