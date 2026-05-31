'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Map, 
  Building2, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  User,
  Wallet
} from 'lucide-react';

interface UserSession {
  name: string;
  email: string;
  role: string;
}

interface SidebarProps {
  user: UserSession | null;
  onLogout: () => Promise<void>;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
    { name: 'States', href: '/super-admin/states', icon: Map },
    { name: 'Local Governments', href: '/super-admin/lgs', icon: Building2 },
    { name: 'Users', href: '/super-admin/users', icon: Users },
    { name: 'Revenue', href: '/super-admin/revenue', icon: Wallet },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          {/* Yellow Grid Logo */}
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-amber-500/10">
            K
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900">Khrien</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
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
        {/* Sidebar Header */}
        <div className="pb-6 border-b border-slate-100 flex items-center gap-3">
          {/* Yellow Grid logo representation */}
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex flex-wrap p-1.5 gap-0.5 justify-between items-between shadow-md shadow-amber-500/10">
            <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-amber-200 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-amber-200 rounded-sm"></div>
            <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
          </div>
          <div>
            <span className="font-extrabold text-slate-800 text-base tracking-tight block">Khrien</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Super Operations</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group
                  ${isActive 
                    ? 'bg-amber-100 text-amber-955 font-bold shadow-sm shadow-amber-500/5' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                `}
              >
                <Icon className={`h-5 w-5 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-amber-900' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="pt-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-1 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-700 truncate">{user?.name}</p>
              <p className="text-[9px] text-slate-450 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
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
