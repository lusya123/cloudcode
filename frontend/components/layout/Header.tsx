import { StatusIndicator } from './StatusIndicator';

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">CloudClaude</p>
          <h1 className="text-lg font-semibold">Console</h1>
        </div>
        <div className="flex items-center gap-4">
          <StatusIndicator />
          <button className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs text-gray-600 shadow-sm">
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}
