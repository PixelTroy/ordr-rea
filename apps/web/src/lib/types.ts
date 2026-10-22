export type PublicUser = {
  id: string
  email: string
  displayName: string
  avatarColor: string
  createdAt: string
}

export type Workspace = {
  id: string
  name: string
  slug: string
  description: string
  companySize: string
  timezone: string
  logoUrl: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
  role?: 'ADMIN' | 'MEMBER' | 'GUEST'
  isOwner?: boolean
}

export type Membership = {
  role: 'ADMIN' | 'MEMBER' | 'GUEST'
  isOwner: boolean
}

export type Member = {
  id: string
  role: 'ADMIN' | 'MEMBER' | 'GUEST'
  isOwner: boolean
  joinedAt: string
  user: {
    id: string
    email: string
    displayName: string
    avatarColor: string
  }
}

export type Invite = {
  id: string
  email: string
  role: 'ADMIN' | 'MEMBER' | 'GUEST'
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
  acceptUrl?: string
  expired?: boolean
}
