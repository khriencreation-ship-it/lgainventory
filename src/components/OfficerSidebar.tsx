'use client';

import { useState, useEffect, useCallback } from 'react';
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
  MapPin,
  Coffee,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Clock,
  HelpCircle
} from 'lucide-react';

const formatToWAT = (isoString: string) => {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '12:00 AM';
  }
};

const formatHours = (hours: number | null) => {
  if (hours === null || hours === undefined) return '0m';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const QUICK_REASONS = [
  'Gone for lunch',
  'Official errand',
  'Medical appointment',
  'Other'
];

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

interface OfficerSidebarProps {
  user: UserSession;
  lg: LgaDetails;
}

export default function OfficerSidebar({ user, lg }: OfficerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const [status, setStatus] = useState<'clocked_out' | 'clocked_in' | 'not_on_seat'>('clocked_out');
  const [log, setLog] = useState<any>(null);
  const [activeNotOnSeat, setActiveNotOnSeat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showNosModal, setShowNosModal] = useState(false);
  const [nosReason, setNosReason] = useState('');
  const [showClockOutModal, setShowClockOutModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/status');
      if (!res.ok) throw new Error('Failed to load status');
      const data = await res.json();
      setStatus(data.status);
      setLog(data.log);
      setActiveNotOnSeat(data.activeNotOnSeat);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Could not fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    const handleUpdate = () => {
      fetchStatus();
    };
    window.addEventListener('attendance-update', handleUpdate);

    return () => {
      window.removeEventListener('attendance-update', handleUpdate);
    };
  }, [fetchStatus]);

  const handleClockIn = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/attendance/clock-in', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clock in');
      
      window.dispatchEvent(new Event('attendance-update'));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Clock-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNosSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nosReason.trim()) return;
    
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/attendance/not-on-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: nosReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark not on seat');
      
      setShowNosModal(false);
      setNosReason('');
      window.dispatchEvent(new Event('attendance-update'));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackOnSeat = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/attendance/back-on-seat', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark back on seat');
      
      window.dispatchEvent(new Event('attendance-update'));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/attendance/clock-out', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clock out');
      
      setShowClockOutModal(false);
      window.dispatchEvent(new Event('attendance-update'));
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Clock out failed');
    } finally {
      setActionLoading(false);
    }
  };

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
    { name: 'Dashboard', href: '/dashboard/officer', icon: LayoutDashboard },
    { name: 'Clients', href: '/dashboard/officer/clients', icon: Users },
    { name: 'Demand Bills', href: '/dashboard/officer/demand-bills', icon: FileText },
    { name: 'Receipts', href: '/dashboard/officer/receipts', icon: Receipt },
  ];

  // Helper to determine if a route is active
  const isRouteActive = (href: string) => {
    if (href === '/dashboard/officer') {
      return pathname === '/dashboard/officer';
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
              className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-amber-500/10">
              {lg.code ? lg.code.slice(0, 2).toUpperCase() : lg.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900 block truncate max-w-[180px]">{lg.name}</span>
            <span className="text-[9px] text-amber-650 font-bold uppercase tracking-wider block">Officer Workspace</span>
          </div>
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
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 font-extrabold text-sm border border-amber-100 shadow-sm shrink-0">
              {lg.code ? lg.code.slice(0, 2).toUpperCase() : lg.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="font-black text-slate-800 text-sm tracking-tight block truncate" title={lg.name}>
              {lg.name}
            </span>
            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">
              LGA Officer Portal
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

        {/* Attendance Sidebar Panel */}
        <div className="mb-6 bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Attendance</span>
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            ) : status === 'clocked_in' ? (
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                On Duty
              </span>
            ) : status === 'not_on_seat' ? (
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
                Away
              </span>
            ) : log ? (
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Completed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-slate-555 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-150">
                Off Duty
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-2 text-center text-xs font-medium text-slate-400">Loading status...</div>
          ) : (
            <div className="space-y-2.5">
              {/* Quick Status Info */}
              {status === 'clocked_in' && log?.clock_in_time && (
                <div className="text-[11px] font-semibold text-slate-550 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>In at: {formatToWAT(log.clock_in_time)}</span>
                </div>
              )}
              {status === 'not_on_seat' && activeNotOnSeat?.start_time && (
                <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span>Away since: {formatToWAT(activeNotOnSeat.start_time)}</span>
                </div>
              )}
              {status === 'clocked_out' && (
                log ? (
                  <div className="text-[11px] font-semibold text-indigo-650 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Active: {formatHours(log.total_hours_on_duty)}</span>
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-350" />
                    <span>Not clocked in today</span>
                  </div>
                )
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-1.5">
                {status === 'clocked_out' ? (
                  <button
                    onClick={handleClockIn}
                    disabled={actionLoading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer animate-fade-in"
                  >
                    {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                    {log ? 'Clock In Again' : 'Clock In'}
                  </button>
                ) : (
                  <>
                    {status === 'clocked_in' ? (
                      <button
                        onClick={() => setShowNosModal(true)}
                        disabled={actionLoading}
                        className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer animate-fade-in"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" /> : <Coffee className="h-3.5 w-3.5" />}
                        Not On Seat
                      </button>
                    ) : (
                      <button
                        onClick={handleBackOnSeat}
                        disabled={actionLoading}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer animate-fade-in"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Back On Seat
                      </button>
                    )}
                    <button
                      onClick={() => setShowClockOutModal(true)}
                      disabled={actionLoading}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer animate-fade-in"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                      Clock Out
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-[10px] text-rose-600 font-extrabold flex items-center gap-1 bg-rose-50 p-1.5 rounded-lg border border-rose-100/50">
              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
        </div>

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
            href="/dashboard/officer/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 mb-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer"
          >
            <UserIcon className="h-3.5 w-3.5" />
            <span>Profile Settings</span>
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

      {/* MODAL 1: Not On Seat Input (Sidebar Trigger) */}
      {showNosModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-sm">Why are you stepping out?</h3>
              <button 
                onClick={() => { setShowNosModal(false); setNosReason(''); }}
                className="p-1.5 text-slate-450 hover:bg-slate-50 rounded-xl transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleNosSubmit} className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Quick select</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNosReason(r)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        nosReason === r 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                          : 'bg-slate-50 border-slate-200/80 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Reason</label>
                <textarea
                  required
                  placeholder="Enter detailed reason here..."
                  value={nosReason}
                  onChange={(e) => setNosReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50 min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100/50">
                <button
                  type="button"
                  onClick={() => { setShowNosModal(false); setNosReason(''); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!nosReason.trim() || actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded-xl transition-all shadow-md shadow-amber-100 cursor-pointer"
                >
                  Mark Not On Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Clock Out Confirmation */}
      {showClockOutModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-scale-up p-5 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <HelpCircle className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-sm">Confirm Clock Out</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to clock out?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClockOutModal(false)}
                className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-xl transition-all shadow-md shadow-rose-100 cursor-pointer"
              >
                Clock Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
