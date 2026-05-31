'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Receipt,
  LogOut, 
  Menu, 
  X, 
  User as UserIcon,
  BarChart3,
  Calendar
} from 'lucide-react';

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LgaDetails {
  name: string;
  logo_url: string | null;
  code: string;
}

interface ChairmanSidebarProps {
  user: UserSession;
  lg: LgaDetails;
}

export default function ChairmanSidebar({ user, lg }: ChairmanSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard/chairman', icon: LayoutDashboard },
    { name: 'Clients', href: '/dashboard/chairman/clients', icon: Users },
    { name: 'Demand Bills', href: '/dashboard/chairman/demand-bills', icon: FileText },
    { name: 'Receipts', href: '/dashboard/chairman/receipts', icon: Receipt },
    { name: 'Reports', href: '/dashboard/chairman/reports', icon: BarChart3 },
    { name: 'Attendance', href: '/dashboard/chairman/attendance', icon: Calendar },
  ];

  // Helper to determine if a route is active
  const isRouteActive = (href: string) => {
    if (href === '/dashboard/chairman') {
      return pathname === '/dashboard/chairman' || pathname === '/dashboard/chairman/activity';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-white border-b border-slate-150 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {lg.logo_url && !logoError ? (
            <img 
              src={lg.logo_url} 
              alt={lg.name} 
              className="w-8 h-8 rounded-lg object-contain bg-slate-55 bg-slate-50 border border-slate-100"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-indigo-500/10">
              {lg.code ? lg.code.slice(0, 2).toUpperCase() : lg.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900 block truncate max-w-[180px]">{lg.name}</span>
            <span className="text-[9px] text-indigo-650 font-bold uppercase tracking-wider block">Chairman Workspace</span>
          </div>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-505 hover:text-slate-800 p-1 cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar Navigation Container */}
      <aside className={`
        fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-300 ease-in-out
        w-64 bg-white rounded-none border-r border-slate-200 flex flex-col z-40 p-6 shadow-sm overflow-y-auto no-scrollbar
      `}>
        {/* Sidebar Header with dynamic LG details */}
        <div className="pb-6 border-b border-slate-100 flex items-center gap-3">
          {lg.logo_url && !logoError ? (
            <img 
              src={lg.logo_url} 
              alt={lg.name} 
              className="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-150 p-0.5"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold text-sm border border-indigo-100 shadow-sm shrink-0">
              {lg.code ? lg.code.slice(0, 2).toUpperCase() : lg.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="font-black text-slate-850 text-sm tracking-tight block truncate" title={lg.name}>
              {lg.name}
            </span>
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">
              Chairman Dashboard
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 space-y-1.5">
          {navItems.map((item) => {
            const isActive = isRouteActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-950 font-bold shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                `}
              >
                <Icon className={`h-5 w-5 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-indigo-700' : 'text-slate-400 group-hover:text-slate-650'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="pt-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-1 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate" title={user.name}>{user.name}</p>
              <p className="text-[9px] text-slate-450 truncate" title={user.email}>{user.email}</p>
            </div>
          </div>

          <Link
            href="/dashboard/chairman/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 mb-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>Profile & Signatures</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-50 hover:bg-red-50 border border-slate-200/80 hover:border-red-200 text-slate-500 hover:text-red-650 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
        ></div>
      )}
    </>
  );
}
