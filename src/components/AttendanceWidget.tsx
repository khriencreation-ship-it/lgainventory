'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  Coffee, 
  LogOut, 
  MapPin, 
  AlertTriangle,
  Loader2, 
  CheckCircle,
  HelpCircle,
  X
} from 'lucide-react';

interface AttendanceLog {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: 'clocked_in' | 'not_on_seat' | 'clocked_out';
  total_time_not_on_seat: number;
  total_hours_on_duty: number | null;
}

interface ActiveNotOnSeat {
  id: string;
  reason: string;
  start_time: string;
}

const QUICK_REASONS = [
  'Gone for lunch',
  'Official errand',
  'Medical appointment',
  'Other'
];

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

const getNigeriaDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return formatter.format(new Date());
};

const formatHours = (hours: number | null) => {
  if (hours === null || hours === undefined) return '0m';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function AttendanceWidget() {
  const [status, setStatus] = useState<'clocked_out' | 'clocked_in' | 'not_on_seat'>('clocked_out');
  const [log, setLog] = useState<AttendanceLog | null>(null);
  const [activeNotOnSeat, setActiveNotOnSeat] = useState<ActiveNotOnSeat | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modals
  const [showNosModal, setShowNosModal] = useState(false);
  const [nosReason, setNosReason] = useState('');
  
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  
  // Live updating clock counter
  const [now, setNow] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/status');
      if (!res.ok) throw new Error('Failed to load attendance status');
      const data = await res.json();
      
      setStatus(data.status);
      setLog(data.log);
      setActiveNotOnSeat(data.activeNotOnSeat);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Could not fetch attendance status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    setNow(new Date());

    const handleUpdate = () => {
      fetchStatus();
    };
    window.addEventListener('attendance-update', handleUpdate);

    // Update live counter every 30 seconds (ensures minute accuracy)
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => {
      window.removeEventListener('attendance-update', handleUpdate);
      clearInterval(interval);
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

  // Helper calculations for live counters
  const getNetDutyDuration = () => {
    if (!log || !log.clock_in_time || !now) return '0m';
    
    const start = new Date(log.clock_in_time);
    const elapsedMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);
    const awayMinutes = log.total_time_not_on_seat || 0;
    const netMinutes = Math.max(0, elapsedMinutes - awayMinutes);
    
    const hrs = Math.floor(netMinutes / 60);
    const mins = netMinutes % 60;
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const getAwayDuration = () => {
    if (!activeNotOnSeat || !activeNotOnSeat.start_time || !now) return '0m';
    
    const start = new Date(activeNotOnSeat.start_time);
    const elapsedMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);
    const netMinutes = Math.max(0, elapsedMinutes);
    
    const hrs = Math.floor(netMinutes / 60);
    const mins = netMinutes % 60;
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-slate-550" />
        <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Loading attendance status...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Widget Card */}
      <div className={`rounded-3xl border shadow-sm transition-all p-5 ${
        status === 'clocked_out' 
          ? 'bg-white border-slate-200/60' 
          : status === 'clocked_in' 
            ? 'bg-emerald-50/40 border-emerald-100' 
            : 'bg-amber-50/40 border-amber-100'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Left Info Column */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              {status === 'clocked_out' ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                  <span className="text-sm font-extrabold text-slate-700">
                    {log ? 'Shift Completed' : 'Not Clocked In'}
                  </span>
                </>
              ) : status === 'clocked_in' ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm font-extrabold text-emerald-800">● Clocked In</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <span className="text-sm font-extrabold text-amber-800">○ Not On Seat</span>
                </>
              )}
            </div>

            <div className="text-xs text-slate-500 font-semibold space-y-1">
              {status === 'clocked_out' ? (
                log ? (
                  <p>
                    You have clocked in today (In: <span className="font-extrabold text-slate-700">{formatToWAT(log.clock_in_time)}</span>
                    {log.clock_out_time && <> · Out: <span className="font-extrabold text-slate-700">{formatToWAT(log.clock_out_time)}</span></>}). Active time: <span className="font-black text-slate-800">{formatHours(log.total_hours_on_duty)}</span>
                  </p>
                ) : (
                  <p>You are not clocked in today · Date: <span className="font-extrabold text-slate-700">{getNigeriaDateString()}</span></p>
                )
              ) : status === 'clocked_in' ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p>Since: <span className="font-extrabold text-slate-700">{formatToWAT(log!.clock_in_time)}</span></p>
                  <p>Net Duration: <span className="font-black text-slate-800">{getNetDutyDuration()}</span></p>
                  {log!.total_time_not_on_seat > 0 && (
                    <p>Total Away: <span className="font-semibold text-slate-550">{Math.round(log!.total_time_not_on_seat)} mins</span></p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p>Away since: <span className="font-extrabold text-slate-700">{formatToWAT(activeNotOnSeat!.start_time)}</span></p>
                    <p>Duration away: <span className="font-black text-amber-700">{getAwayDuration()}</span></p>
                  </div>
                  <p className="bg-amber-100/50 border border-amber-200/30 text-[11px] px-2 py-0.5 rounded-lg inline-block font-bold text-amber-800">
                    Reason: {activeNotOnSeat!.reason}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {actionLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

            {status === 'clocked_out' ? (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5" />
                {log ? 'Clock In Again' : 'Clock In'}
              </button>
            ) : status === 'clocked_in' ? (
              <>
                <button
                  onClick={() => setShowNosModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-amber-700 hover:text-amber-850 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 border border-amber-250/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  Not On Seat
                </button>
                <button
                  onClick={() => setShowClockOutModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-xl transition-all shadow-md shadow-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Clock Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleBackOnSeat}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl transition-all shadow-md shadow-emerald-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Back On Seat
                </button>
                <button
                  onClick={() => setShowClockOutModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 rounded-xl transition-all shadow-md shadow-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-rose-50 border border-rose-100/50 text-[11px] font-extrabold text-rose-700 p-2.5 rounded-xl flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* MODAL 1: Not On Seat Input */}
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
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Quick select</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNosReason(r)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        nosReason === r 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                          : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Reason</label>
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
                You have been on duty for <span className="font-bold text-slate-800">{getNetDutyDuration()}</span> today.
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
    </div>
  );
}
