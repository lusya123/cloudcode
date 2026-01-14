export function Header() {
  return (
    <header className="border-b border-line bg-white/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">CloudClaude</p>
          <h1 className="text-2xl font-semibold">Console</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-ink animate-pulse-line" />
          <span>System Online</span>
        </div>
      </div>
    </header>
  );
}
