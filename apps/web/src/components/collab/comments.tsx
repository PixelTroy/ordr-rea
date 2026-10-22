'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { api } from '@/lib/api'
import { BriefUser } from '@/lib/work'
import { Button } from '@/components/ui'

type Comment = {
  id: string
  bodyText: string
  createdAt: string
  author: { id: string; displayName: string; avatarColor: string }
  reactions: Array<{ emoji: string; userId: string }>
}

export function CommentPanel({ slug, projectId, issueId }: { slug: string; projectId: string; issueId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [members, setMembers] = useState<BriefUser[]>([])

  function load() {
    api<{ comments: Comment[] }>(`/api/v1/workspaces/${slug}/projects/${projectId}/issues/${issueId}/comments`).then((body) =>
      setComments(body.comments),
    )
  }

  useEffect(() => {
    load()
    api<{ project: { members: Array<{ user: BriefUser }> } }>(`/api/v1/workspaces/${slug}/projects/${projectId}`).then((body) =>
      setMembers(body.project.members.map((member) => member.user)),
    )
  }, [issueId, projectId, slug])

  return (
    <div className="mt-4 space-y-3">
      {comments.map((comment) => (
        <article key={comment.id} data-testid="comment" className="rounded-lg border border-line p-3 text-sm">
          <p className="text-xs font-medium">{comment.author.displayName}</p>
          <p className="mt-1 whitespace-pre-wrap">{comment.bodyText}</p>
          <button
            type="button"
            className="mt-2 text-xs text-muted"
            onClick={async () => {
              await api(`/api/v1/workspaces/${slug}/comments/${comment.id}/reactions`, {
                method: 'POST',
                body: JSON.stringify({ emoji: '👍' }),
              })
              load()
            }}
          >
            👍 {comment.reactions.filter((reaction) => reaction.emoji === '👍').length}
          </button>
        </article>
      ))}
      <CommentComposer
        members={members}
        onSubmit={async (bodyJson) => {
          await api(`/api/v1/workspaces/${slug}/projects/${projectId}/issues/${issueId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ bodyJson }),
          })
          load()
        }}
      />
    </div>
  )
}

function CommentComposer({
  members,
  onSubmit,
}: {
  members: BriefUser[]
  onSubmit: (body: unknown) => Promise<void>
}) {
  const membersRef = useRef(members)
  membersRef.current = members
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write a comment. Use @ to mention someone.' }),
      Mention.configure({
        HTMLAttributes: { class: 'rounded bg-canvas px-1' },
        suggestion: {
          items: ({ query }) =>
            membersRef.current
              .filter((member) => member.displayName.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 6)
              .map((member) => ({ id: member.id, label: member.displayName })),
          render: () => {
            let element: HTMLDivElement | null = null
            let current: Array<{ id: string; label: string }> = []
            let command: (item: { id: string; label: string }) => void = () => undefined
            const paint = (props: {
              items: Array<{ id: string; label: string }>
              command: (item: { id: string; label: string }) => void
              clientRect?: (() => DOMRect | null) | null
            }) => {
              current = props.items
              command = props.command
              if (!element) return
              element.innerHTML = ''
              props.items.forEach((item) => {
                const button = document.createElement('button')
                button.type = 'button'
                button.textContent = item.label
                button.className = 'block w-full px-2 py-1 text-left text-sm hover:bg-canvas'
                button.onmousedown = (event) => {
                  event.preventDefault()
                  props.command(item)
                }
                element?.appendChild(button)
              })
              const rect = props.clientRect?.()
              if (rect) {
                element.style.left = `${rect.left}px`
                element.style.top = `${rect.bottom + 4}px`
              }
            }
            return {
              onStart: (props) => {
                element = document.createElement('div')
                element.className = 'fixed z-50 w-48 rounded-md border border-line bg-white shadow-pop'
                document.body.appendChild(element)
                paint(props)
              },
              onUpdate: paint,
              onKeyDown: (props) => {
                if (props.event.key === 'Enter' && current[0]) {
                  command(current[0])
                  return true
                }
                return false
              },
              onExit: () => {
                element?.remove()
                element = null
              },
            }
          },
        },
      }),
    ],
    immediatelyRender: false,
  })

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (!editor || editor.isEmpty) return
        await onSubmit(editor.getJSON())
        editor.commands.clearContent()
      }}
    >
      <div className="rounded-md border border-line p-2" data-testid="comment-editor">
        <EditorContent editor={editor} />
      </div>
      <Button className="mt-2" type="submit" data-testid="comment-submit">
        Comment
      </Button>
    </form>
  )
}
