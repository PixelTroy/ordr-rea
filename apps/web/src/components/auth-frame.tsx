export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm font-semibold text-white">
              O
            </span>
            <span className="text-lg font-semibold">Ordr</span>
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer ? <p className="mt-6 text-sm text-muted">{footer}</p> : null}
        </div>
      </div>
      <div className="hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="text-sm text-white/70">Self-hosted work management</p>
        <div>
          <p className="text-3xl font-semibold leading-tight">
            Projects, work items, cycles, and pages in one workspace.
          </p>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Ordr keeps the familiar layout of a modern issue tracker: a workspace switcher, project tabs, and a
            record of who changed what.
          </p>
        </div>
        <p className="text-xs text-white/50">Original software. Not affiliated with Plane.</p>
      </div>
    </div>
  )
}
