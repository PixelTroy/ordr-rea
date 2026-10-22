'use client'

import { useParams } from 'next/navigation'
import { useWorkspace } from '@/components/shell/workspace-provider'

const titles: Record<string, string> = {
  billing: 'Billing and plans',
  imports: 'Imports',
  exports: 'Exports',
  worklogs: 'Worklogs',
  identity: 'Identity',
  governance: 'Workspace Governance',
  wiki: 'Wiki',
  assistant: 'Assistant',
  'feature-projects': 'Projects',
  teamspaces: 'Teamspaces',
  initiatives: 'Initiatives',
  customers: 'Customers',
  templates: 'Templates',
  integrations: 'Integrations',
  releases: 'Releases',
  webhooks: 'Webhooks',
  'access-tokens': 'Access tokens',
}

export default function SettingsSectionPage() {
  const { section } = useParams<{ section: string }>()
  const { slug } = useWorkspace()
  const title = titles[section] || section
  const tokens = section === 'access-tokens'
  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        {tokens
          ? 'Personal access tokens for this workspace will be created here. The form is title, description, and an expiration date or never expires.'
          : 'This setting is listed so the workspace settings map matches the product layout. It is not available yet.'}
      </p>
      <p className="mt-6 text-xs text-muted">
        {tokens ? `/${slug}/settings/access-tokens` : `Workspace ${slug}`}
      </p>
    </div>
  )
}
