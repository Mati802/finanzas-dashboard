'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transacciones', label: 'Transacciones', icon: ArrowUpDown },
  { href: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { href: '/gastos', label: 'Gastos', icon: TrendingDown },
  { href: '/inversiones', label: 'Inversiones', icon: DollarSign },
  { href: '/patrimonio', label: 'Patrimonio', icon: Wallet },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="min-h-[calc(100vh-42px)] border-r border-border-subtle bg-bg-sunken px-2.5 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]">
          <DollarSign className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-bold tracking-tight">Finanzas</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] transition',
                active ? 'bg-border-subtle text-fg' : 'text-fg-subtle hover:text-fg'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active && 'text-[#a78bfa]')} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
