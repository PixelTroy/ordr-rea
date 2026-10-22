'use client'

import { FormEvent, useEffect, useState } from 'react'
import { WORKSPACE_ROLES } from '@ordr/shared'
import { useWorkspace } from '@/components/shell/workspace-provider'
import { Avatar, Button, ErrorText, SelectField, TextField } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { Invite, Member } from '@/lib/types'

function roleLabel(member: Member) {
  if (member.isOwner) return 'Owner'
  if (member.role === 'ADMIN') return 'Admin'
  if (member.role === 'GUEST') return 'Guest'
  return 'Member'
}

export default function MembersPage() {
  const { workspace, membership } = useWorkspace()
  const admin = membership.isOwner || membership.role === 'ADMIN'
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof WORKSPACE_ROLES)[number]>('MEMBER')
  const [acceptUrl, setAcceptUrl] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const data = await api<{ members: Member[] }>(`/api/v1/workspaces/${workspace.slug}/members`)
    setMembers(data.members)
    if (admin) {
      const pendingInvites = await api<{ invites: Invite[] }>(`/api/v1/workspaces/${workspace.slug}/invites`)
      setInvites(pendingInvites.invites)
    }
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load members'))
  }, [workspace.slug])

  async function invite(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const data = await api<{ acceptUrl: string }>(`/api/v1/workspaces/${workspace.slug}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      })
      setAcceptUrl(data.acceptUrl)
      setEmail('')
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invite')
    } finally {
      setPending(false)
    }
  }

  async function changeRole(member: Member, next: string) {
    await api(`/api/v1/workspaces/${workspace.slug}/members/${member.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: next }),
    })
    await load()
  }

  async function remove(member: Member) {
    await api(`/api/v1/workspaces/${workspace.slug}/members/${member.user.id}`, { method: 'DELETE' })
    await load()
  }

  async function revoke(invite: Invite) {
    await api(`/api/v1/workspaces/${workspace.slug}/invites/${invite.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="mt-1 text-sm text-muted">People and pending invites. Invite links are shown here because email is not sent.</p>
        </div>
        {admin ? (
          <Button data-testid="add-member" onClick={() => setOpen(true)}>
            Add member
          </Button>
        ) : null}
      </div>

      {acceptUrl ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">Invite link</p>
          <input data-testid="invite-link" readOnly value={acceptUrl} className="mt-2 h-9 w-full rounded-md border border-emerald-200 bg-white px-3 text-sm" />
        </div>
      ) : null}

      <div className="mt-6 overflow-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Full name</th>
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Authentication</th>
              <th className="px-3 py-2 font-medium">Joining date</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-line" data-testid="member-row">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={member.user.displayName} color={member.user.avatarColor} />
                    {member.user.displayName}
                  </span>
                </td>
                <td className="px-3 py-2">{member.user.displayName}</td>
                <td className="px-3 py-2">{member.user.email}</td>
                <td className="px-3 py-2">
                  {admin && !member.isOwner ? (
                    <select
                      aria-label={`Role for ${member.user.email}`}
                      className="h-8 rounded-md border border-line px-2"
                      value={member.role}
                      onChange={(event) => changeRole(member, event.target.value)}
                    >
                      {WORKSPACE_ROLES.map((item) => (
                        <option key={item} value={item}>
                          {item === 'ADMIN' ? 'Admin' : item === 'GUEST' ? 'Guest' : 'Member'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(member)
                  )}
                </td>
                <td className="px-3 py-2 text-muted">Password</td>
                <td className="px-3 py-2 text-muted">{new Date(member.joinedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  {admin && !member.isOwner ? (
                    <button type="button" className="text-xs text-red-600" onClick={() => remove(member)}>
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {admin ? (
        <section className="mt-8">
          <h3 className="text-sm font-semibold">Pending invites</h3>
          {invites.length === 0 ? <p className="mt-2 text-sm text-muted">No pending invites.</p> : null}
          <ul className="mt-2 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="font-medium">{invite.email}</span>
                <span className="text-muted">{invite.role}</span>
                {invite.expired ? <span className="text-red-600">Expired</span> : null}
                <input readOnly value={invite.acceptUrl} className="h-8 min-w-48 flex-1 rounded-md border border-line px-2 text-xs" />
                <button type="button" className="text-xs text-red-600" onClick={() => revoke(invite)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-4" onClick={() => setOpen(false)}>
          <form
            onClick={(event) => event.stopPropagation()}
            onSubmit={invite}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-pop"
          >
            <h3 className="text-lg font-semibold">Add member</h3>
            <p className="mt-1 text-sm text-muted">We will not send email. Copy the invite link after you create it.</p>
            <div className="mt-4 space-y-3">
              <TextField
                label="Email"
                type="email"
                data-testid="invite-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <SelectField
                label="Role"
                data-testid="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="GUEST">Guest</option>
              </SelectField>
              <ErrorText>{error}</ErrorText>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="invite-submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create invite'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {!open && error ? <div className="mt-3"><ErrorText>{error}</ErrorText></div> : null}
    </div>
  )
}
