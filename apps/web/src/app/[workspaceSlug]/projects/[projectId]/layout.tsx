'use client'

import { useParams } from 'next/navigation'
import { ProjectFrame } from '@/components/project/project-frame'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>()
  if (!params.projectId) return children
  return <ProjectFrame>{children}</ProjectFrame>
}
