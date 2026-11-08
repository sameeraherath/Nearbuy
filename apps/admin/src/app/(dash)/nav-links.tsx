'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/orders', label: 'Orders' },
  { href: '/shops', label: 'Shops & menus' },
  { href: '/places', label: 'Places' },
  { href: '/riders', label: 'Riders' },
  { href: '/customers', label: 'Customers' },
  { href: '/sms', label: 'SMS log' },
  { href: '/settings', label: 'Settings' },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + '/');
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
              active ? 'bg-white/10 font-semibold text-primary' : 'text-white/80 hover:bg-white/5'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
