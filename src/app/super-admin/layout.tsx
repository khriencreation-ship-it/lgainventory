'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Map, 
  Building2, 
  Users, 
  Loader2,
  Wallet
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

interface UserSession {
  name: string;
  email: string;
  role: string;
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session on load
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user && data.user.role === 'super_admin') {
          setUser(data.user);
        } else {
          router.push('/superadmin');
        }
      } catch (err) {
        router.push('/superadmin');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/superadmin');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
    { name: 'States', href: '/super-admin/states', icon: Map },
    { name: 'Local Governments', href: '/super-admin/lgs', icon: Building2 },
    { name: 'Users', href: '/super-admin/users', icon: Users },
    { name: 'Revenue', href: '/super-admin/revenue', icon: Wallet },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-650" />
        <span className="text-xs tracking-wider uppercase font-semibold text-slate-400">Loading Session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-slate-800 flex flex-col md:flex-row p-0">
      
      <Sidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Header Bar */}
        <header className="hidden md:flex items-center justify-between px-6 md:px-8 pt-8 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {navItems.find((item) => item.href === pathname)?.name || 'Admin Panel'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-black text-amber-700 uppercase tracking-wider">
              Super Admin Mode
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 pt-4 md:pt-2 pb-12">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
