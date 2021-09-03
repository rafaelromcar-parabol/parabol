import styled from '@emotion/styled'
import graphql from 'babel-plugin-relay/macro'
import React from 'react'
import {PreloadedQuery, usePreloadedQuery} from 'react-relay'
import useBreakpoint from '../hooks/useBreakpoint'
import {DECELERATE, fadeUp} from '../styles/animation'
import {Elevation} from '../styles/elevation'
import {PALETTE} from '../styles/paletteV3'
import {ICON_SIZE} from '../styles/typographyV2'
import {Breakpoint, ElementHeight, ElementWidth, ZIndex} from '../types/constEnums'
import {SpotlightModalQuery} from '../__generated__/SpotlightModalQuery.graphql'
import Icon from './Icon'
import LoadingComponent from './LoadingComponent/LoadingComponent'
import MenuItemComponentAvatar from './MenuItemComponentAvatar'
import MenuItemLabel from './MenuItemLabel'
import PlainButton from './PlainButton/PlainButton'
import DraggableReflectionCard from './ReflectionGroup/DraggableReflectionCard'
import SpotlightGroups from './SpotlightGroups'

const SELECTED_HEIGHT_PERC = 33.3
const ModalContainer = styled('div')<{isDesktop: boolean}>(({isDesktop}) => ({
  animation: `${fadeUp.toString()} 300ms ${DECELERATE} 300ms forwards`,
  background: '#FFFF',
  borderRadius: 8,
  boxShadow: Elevation.Z8,
  display: 'flex',
  flexWrap: 'wrap',
  height: '80vh',
  justifyContent: 'center',
  opacity: 0,
  overflow: 'hidden',
  width: isDesktop ? '80vw' : '90vw',
  zIndex: ZIndex.SPOTLIGHT_MODAL
}))

const SelectedReflectionSection = styled('div')({
  alignItems: 'flex-start',
  background: PALETTE.SLATE_100,
  borderRadius: '8px 8px 0px 0px',
  display: 'flex',
  flexWrap: 'wrap',
  height: `${SELECTED_HEIGHT_PERC}%`,
  justifyContent: 'center',
  padding: 16,
  position: 'relative',
  width: '100%'
})

const SimilarReflectionGroups = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: `${SELECTED_HEIGHT_PERC * 2}%`,
  padding: 16
})

const Title = styled('div')({
  color: PALETTE.SLATE_800,
  fontSize: 16,
  fontWeight: 600,
  textAlign: 'center'
})

const TopRow = styled('div')({
  width: `calc(100% - 48px)`, // 48px accounts for icon size
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
})

const ReflectionWrapper = styled('div')({
  display: 'flex',
  alignItems: 'center',
  position: 'absolute',
  top: `calc(${SELECTED_HEIGHT_PERC / 2}% - ${ElementHeight.REFLECTION_CARD / 2}px)`,
  left: `calc(50% - ${ElementWidth.REFLECTION_CARD / 2}px)`,
  zIndex: ZIndex.REFLECTION_IN_FLIGHT_LOCAL
})

const SearchInput = styled('input')({
  appearance: 'none',
  border: `1px solid ${PALETTE.SKY_500}`,
  borderRadius: 4,
  boxShadow: `0 0 1px 1px ${PALETTE.SKY_300}`,
  color: PALETTE.SLATE_700,
  display: 'block',
  fontSize: 14,
  lineHeight: '24px',
  outline: 'none',
  padding: '6px 0 6px 39px',
  width: '100%',
  '::placeholder': {
    color: PALETTE.SLATE_600
  }
})

const SearchItem = styled(MenuItemLabel)({
  overflow: 'visible',
  padding: 0,
  position: 'absolute',
  bottom: -16,
  width: ElementWidth.REFLECTION_CARD
})

const StyledMenuItemIcon = styled(MenuItemComponentAvatar)({
  position: 'absolute',
  left: 8,
  top: 8
})

const SearchIcon = styled(Icon)({
  color: PALETTE.SLATE_600,
  fontSize: ICON_SIZE.MD24
})

const StyledCloseButton = styled(PlainButton)({
  height: 24,
  position: 'absolute',
  right: 16
})

const CloseIcon = styled(Icon)({
  color: PALETTE.SLATE_600,
  cursor: 'pointer',
  fontSize: ICON_SIZE.MD24,
  '&:hover,:focus': {
    color: PALETTE.SLATE_800
  }
})

interface Props {
  closeSpotlight: () => void
  flipRef: (instance: HTMLDivElement) => void
  queryRef: PreloadedQuery<SpotlightModalQuery>
}

const SpotlightModal = (props: Props) => {
  const {closeSpotlight, flipRef, queryRef} = props
  const data = usePreloadedQuery<SpotlightModalQuery>(
    graphql`
      query SpotlightModalQuery($reflectionId: ID!, $searchQuery: String!, $meetingId: ID!) {
        viewer {
          ...SpotlightGroups_viewer
          similarReflectionGroups(reflectionId: $reflectionId, searchQuery: $searchQuery) {
            id
            title
          }
          meeting(meetingId: $meetingId) {
            id
            teamId
            localPhase {
              phaseType
            }
            localStage {
              isComplete
              phaseType
            }
            phases {
              phaseType
              stages {
                isComplete
                phaseType
              }
            }
            ... on RetrospectiveMeeting {
              ...DraggableReflectionCard_meeting
              ...SpotlightGroups_meeting
              spotlightReflection {
                ...DraggableReflectionCard_reflection
              }
            }
          }
        }
      }
    `,
    queryRef,
    {UNSTABLE_renderPolicy: 'full'}
  )
  console.log('🚀 ~ SpotlightModal ~ data', data)
  const {viewer} = data
  const {meeting, similarReflectionGroups} = viewer
  const {spotlightReflection} = meeting
  console.log('🚀  ~ spotlightReflection', spotlightReflection)
  // const similarReflectionGroups = viewer?.similarReflectionGroups
  const isLoading = similarReflectionGroups === undefined
  console.log('🚀 ~ SpotlightModal ~ isLoading', isLoading)
  const isDesktop = useBreakpoint(Breakpoint.NEW_MEETING_SELECTOR)
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && !e.currentTarget.value) {
      closeSpotlight()
    }
  }
  return (
    <>
      <ModalContainer isDesktop={isDesktop}>
        <SelectedReflectionSection>
          <TopRow>
            <Title>Find cards with similar reflections</Title>
            <StyledCloseButton onClick={closeSpotlight}>
              <CloseIcon>close</CloseIcon>
            </StyledCloseButton>
          </TopRow>
          <SearchItem>
            <StyledMenuItemIcon>
              <SearchIcon>search</SearchIcon>
            </StyledMenuItemIcon>
            <SearchInput
              onKeyDown={onKeyDown}
              autoFocus
              autoComplete='off'
              name='search'
              placeholder='Or search for keywords...'
              type='text'
            />
          </SearchItem>
        </SelectedReflectionSection>
        <SimilarReflectionGroups>
          {isLoading ? (
            <LoadingComponent height={24} width={24} showAfter={0} spinnerSize={24} />
          ) : (
            <SpotlightGroups meeting={meeting} viewer={viewer!} />
          )}
        </SimilarReflectionGroups>
      </ModalContainer>
      <ReflectionWrapper ref={flipRef}>
        {spotlightReflection && (
          <DraggableReflectionCard
            isDraggable
            reflection={spotlightReflection}
            meeting={meeting}
            staticReflections={null}
          />
        )}
      </ReflectionWrapper>
    </>
  )
}

export default SpotlightModal
// export default createFragmentContainer(SpotlightModal, {
//   meeting: graphql`
//     fragment SpotlightModal_meeting on RetrospectiveMeeting {
//       ...DraggableReflectionCard_meeting
//       ...SpotlightGroups_meeting
//       id
//       teamId
//       localPhase {
//         phaseType
//       }
//       localStage {
//         isComplete
//         phaseType
//       }
//       phases {
//         phaseType
//         stages {
//           isComplete
//           phaseType
//         }
//       }
//       spotlightReflection {
//         ...DraggableReflectionCard_reflection
//       }
//     }
//   `,
//   viewer: graphql`
//     fragment SpotlightModal_viewer on User {
//       ...SpotlightGroups_viewer
//       similarReflectionGroups(reflectionId: $reflectionId, searchQuery: $searchQuery) {
//         id
//         title
//       }
//     }
//   `
// })
