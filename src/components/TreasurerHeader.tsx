'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface UserSession {
  name: string;
  role: string;
}

interface TreasurerHeaderProps {
  user: UserSession;
}

export default function TreasurerHeader({ user }: TreasurerHeaderProps) {
  const pathname = usePathname();

  // Determine page title based on pathname
  const getPageTitle = (path: string) => {
    if (path === '/dashboard/treasurer') return 'Dashboard Home';
    if (path.startsWith('/dashboard/treasurer/clients')) return 'Registered Clients';
    if (path.startsWith('/dashboard/treasurer/demand-bills')) return 'Demand Bills';
    if (path.startsWith('/dashboard/treasurer/receipts')) return 'Receipts Ledger';
    if (path.startsWith('/dashboard/treasurer/reports')) return 'Analytics Reports';
    if (path.startsWith('/dashboard/treasurer/profile')) return 'Profile & Signature';
    return 'LGA Treasurer Portal';
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="hidden md:flex items-center justify-between px-6 md:px-8 pt-8 pb-4 bg-transparent border-none">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          {pageTitle}
        </h2>
      </div>
      <div className="flex items-center gap-5">
        {/* Static Notification Bell */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200/65 rounded-xl transition-colors cursor-pointer shadow-sm">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border border-white"></span>
        </button>

        {/* User Badge Info */}
        <Link 
          href="/dashboard/treasurer/profile" 
          className="flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200/65 px-4 py-2 rounded-2xl shadow-sm transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-800 text-xs shadow-sm shrink-0">
            {user.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-slate-800">{user.name}</span>
            <span className="block text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider mt-0.5">Council Treasurer</span>
          </div>
        </Link>
      </div>
    </header>
  );
}
