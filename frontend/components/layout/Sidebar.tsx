import Link from 'next/link';

const links = [
  { href: '/', label: 'Chat', icon: 'C' },
  { href: '/history', label: 'History', icon: 'H' },
  { href: '/tasks', label: 'Tasks', icon: 'T' },
  { href: '/monitor', label: 'Monitor', icon: 'M' }
];

export function Sidebar() {
  return (
    <aside className="glass-sidebar rounded-2xl border border-black/5 p-4 shadow-sm md:w-48">
      <nav className="flex flex-row flex-wrap gap-3 md:flex-col">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="glass-card glass-hover flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700"
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
