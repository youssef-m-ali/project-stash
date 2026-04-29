'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Summary',       href: '/dashboard',              exact: true  },
  { label: 'Per Paycheck',  href: '/dashboard/per-paycheck', exact: false },
  { label: 'Monthly',       href: '/dashboard/monthly',      exact: false },
  { label: 'Import',        href: '/dashboard/import',       exact: false },
  { label: 'Subscriptions', href: '/dashboard/subscriptions', exact: false },
  { label: 'Settings',      href: '/dashboard/settings',      exact: false },
];

export function DashboardNav() {
  const pathname = usePathname();

  function isActive(tab: typeof TABS[0]) {
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <header className="border-b border-zinc-700 bg-zinc-800/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex items-center gap-1 h-12 overflow-x-auto">
          <span className="text-sm font-semibold text-zinc-100 mr-4 shrink-0">Stash Up</span>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive(tab)
                  ? 'bg-zinc-700 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
