'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Chat' },
  { href: '/history', label: 'History' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/monitor', label: 'Monitor' }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-60">
      <nav className="surface rounded-2xl p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted">Navigate</p>
        <ul className="space-y-2">
          {items.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm transition ${
                    active
                      ? 'bg-ink text-white shadow-soft'
                      : 'text-ink/80 hover:bg-white/80'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
