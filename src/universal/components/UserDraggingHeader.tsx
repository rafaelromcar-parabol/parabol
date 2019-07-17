import React from 'react'
import appTheme from 'universal/styles/theme/appTheme'
import {createFragmentContainer, graphql} from 'react-relay'
import styled from 'react-emotion'
import Tag from 'universal/components/Tag/Tag'
import {UserDraggingHeader_user} from '__generated__/UserDraggingHeader_user.graphql'
import useAtmosphere from 'universal/hooks/useAtmosphere'

const Header = styled('div')({
  bottom: '100%',
  color: appTheme.palette.warm,
  fontSize: '.6875rem',
  lineHeight: '1.125rem',
  position: 'absolute',
  right: 0,
  textAlign: 'end'
})

interface Props {
  user: UserDraggingHeader_user | null
}

const UserDraggingHeader = (props: Props) => {
  const {user} = props
  const atmosphere = useAtmosphere()
  const {viewerId} = atmosphere
  if (!user) return null
  const {userId, preferredName} = user
  const name = userId === viewerId ? 'Your ghost 👻' : preferredName
  return (
    <Header>
      <Tag colorPalette='purple' label={name} />
    </Header>
  )
}

export default createFragmentContainer(UserDraggingHeader, {
  user: graphql`
    fragment UserDraggingHeader_user on User {
      userId: id
      preferredName
    }
  `
})
