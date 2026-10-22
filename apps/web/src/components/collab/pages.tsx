'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ApiError, api } from '@/lib/api'
import { Button, EmptyState, ErrorText, Spinner } from '@/components/ui'
import { PageEditor } from '@/components/collab/page-editor'

type PageRow = {
  id: string
  title: string
  access: 'PUBLIC' | 'PRIVATE'
  updatedAt: string
  favorite: boolean
  createdBy: { displayName: string }
  projectId: string | null
}

export function PageList({ projectId }: { projectId?: string }) {
  const params = useParams<{ workspaceSlug: string }>()
  const router = useRouter()
  const slug = params.workspaceSlug
  const [tab, setTab] = useState<'PUBLIC' | 'PRIVATE' | 'archived'>('PUBLIC')
  const [pages, setPages] = useState<PageRow[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  function load() {
    const query = new URLSearchParams()
    if (projectId) query.set('projectId', projectId)
    else query.set('wiki', '1')
    if (tab === 'archived') query.set('archived', '1')
    else query.set('access', tab)
    api<{ pages: PageRow[] }>(`/api/v1/workspaces/${slug}/pages?${query.toString()}`)
      .then((body) => setPages(body.pages))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load pages'))
  }

  useEffect(() => {
    load()
  }, [projectId, slug, tab])

  const shown = (pages || []).filter((page) => page.title.toLowerCase().includes(search.toLowerCase()))
  const hrefFor = (id: string) => (projectId ? `/${slug}/projects/${projectId}/pages/${id}` : `/${slug}/wiki/${id}`)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        {(['PUBLIC', 'PRIVATE', 'archived'] as const).map((item) => (
          <button key={item} type="button" className={`rounded-md px-3 py-1 text-sm ${tab === item ? 'bg-canvas font-medium' : ''}`} onClick={() => setTab(item)}>
            {item === 'archived' ? 'Archives' : item === 'PUBLIC' ? 'Public' : 'Private'}
          </button>
        ))}
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="ml-auto h-8 rounded-md border border-line px-2 text-sm" />
        <Button
          data-testid="add-page"
          onClick={async () => {
            const created = await api<{ page: PageRow }>(`/api/v1/workspaces/${slug}/pages`, {
              method: 'POST',
              body: JSON.stringify({ title: 'Untitled', projectId: projectId ?? null, access: tab === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC' }),
            })
            router.push(hrefFor(created.page.id))
          }}
        >
          Add page
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {pages === null ? <Spinner /> : null}
      {pages && shown.length === 0 ? <EmptyState title="No pages" body="Pages are shared documents. Private pages stay with you and workspace admins." /> : null}
      <ul>
        {shown.map((page) => (
          <li key={page.id} className="border-b border-line">
            <Link href={hrefFor(page.id)} data-testid="page-row" className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-medium">{page.title}</span>
              <span className="text-xs text-muted">{page.access}</span>
              <span className="text-xs text-muted">{page.createdBy.displayName}</span>
              {page.favorite ? <span className="text-xs">★</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PageScreen({ pageId }: { pageId: string }) {
  const params = useParams<{ workspaceSlug: string; projectId?: string }>()
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const back = params.projectId ? `/${params.workspaceSlug}/projects/${params.projectId}/pages` : `/${params.workspaceSlug}/wiki`

  useEffect(() => {
    api<{ page: PageRow }>(`/api/v1/workspaces/${params.workspaceSlug}/pages/${pageId}`).then((body) => {
      setTitle(body.page.title)
      setFavorite(body.page.favorite)
      setReady(true)
    })
  }, [pageId, params.workspaceSlug])

  if (!ready) return <Spinner />
  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <p className="text-sm text-muted">
        <Link href={back}>Pages</Link> / {title}
      </p>
      <div className="mt-2 flex justify-end">
        <Button
          variant="secondary"
          onClick={async () => {
            const next = !favorite
            setFavorite(next)
            await api(`/api/v1/workspaces/${params.workspaceSlug}/pages/${pageId}/favorite`, {
              method: 'POST',
              body: JSON.stringify({ favorite: next }),
            })
          }}
        >
          {favorite ? 'Starred' : 'Star'}
        </Button>
      </div>
      <PageEditor slug={params.workspaceSlug} pageId={pageId} title={title} onTitle={setTitle} />
    </div>
  )
}
