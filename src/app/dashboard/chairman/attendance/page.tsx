'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';

interface NotOnSeatEntry {
  id: string;
  reason: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  resolved_by: 'user' | 'auto_clockout' | null;
}

interface AttendanceLog {
  id: string;
  user_id: string;
  date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  clock_out_type: 'manual' | 'auto' | null;
  status: 'clocked_in' | 'not_on_seat' | 'clocked_out';
  total_hours_on_duty: number | null;
  total_time_not_on_seat: number;
  was_not_on_seat_at_auto_clockout: boolean;
  not_on_seat_reason_at_auto_clockout: string | null;
  staff_name: string;
  staff_role: string;
  awayDetails: NotOnSeatEntry[];
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

interface SummaryStats {
  totalStaff: number;
  presentToday: number;
  autoClockoutsMonth: number;
  avgHoursMonth: number;
}

const formatDate = (isoString: string) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return isoString;
  }
};

const formatTime = (isoString: string | null) => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '—';
  }
};

const formatHours = (hours: number | null) => {
  if (hours === null || hours === undefined) return '—';
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function ChairmanAttendancePage() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalStaff: 0,
    presentToday: 0,
    autoClockoutsMonth: 0,
    avgHoursMonth: 0
  });
  
  const [lgName, setLgName] = useState('Local Government Authority');
  const [chairmanName, setChairmanName] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [staffId, setStaffId] = useState('');
  const [status, setStatus] = useState('all'); // all | complete | incomplete | auto_clockout
  const [role, setRole] = useState('all'); // all | officer | treasurer

  // Active filters for queries
  const [activeStartDate, setActiveStartDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');
  const [activeStaffId, setActiveStaffId] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeRole, setActiveRole] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/attendance/logs?page=${page}&limit=10`;
      if (activeStartDate) url += `&startDate=${activeStartDate}`;
      if (activeEndDate) url += `&endDate=${activeEndDate}`;
      if (activeStaffId) url += `&staffId=${activeStaffId}`;
      if (activeStatus !== 'all') url += `&status=${activeStatus}`;
      if (activeRole !== 'all') url += `&role=${activeRole}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch attendance logs');
      const data = await res.json();

      setLogs(data.logs || []);
      setStaffList(data.staffList || []);
      setSummary(data.summary);
      setLgName(data.lgName);
      setChairmanName(data.chairmanName);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, activeStartDate, activeEndDate, activeStaffId, activeStatus, activeRole]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
    setActiveStaffId(staffId);
    setActiveStatus(status);
    setActiveRole(role);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStaffId('');
    setStatus('all');
    setRole('all');
    setPage(1);
    setActiveStartDate('');
    setActiveEndDate('');
    setActiveStaffId('');
    setActiveStatus('all');
    setActiveRole('all');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const getLogStatusLabel = (log: AttendanceLog) => {
    if (log.status === 'clocked_out') {
      if (log.clock_out_type === 'auto') return { label: 'Auto Clock Out', style: 'bg-rose-50 border-rose-100 text-rose-700' };
      return { label: 'Complete', style: 'bg-emerald-50 border-emerald-100 text-emerald-700' };
    }
    return { label: 'Incomplete', style: 'bg-amber-50 border-amber-100 text-amber-700' };
  };

  const getDisplayRole = (role: string) => {
    if (role === 'lg_account_officer' || role === 'lg_officer') return 'Account Officer';
    if (role === 'treasurer' || role === 'lg_treasurer') return 'Treasurer';
    return role;
  };

  const isFiltered = activeStartDate || activeEndDate || activeStaffId || activeStatus !== 'all' || activeRole !== 'all';

  // Export Data Fetcher
  const getExportLogs = async () => {
    let url = `/api/attendance/logs?all=true`;
    if (activeStartDate) url += `&startDate=${activeStartDate}`;
    if (activeEndDate) url += `&endDate=${activeEndDate}`;
    if (activeStaffId) url += `&staffId=${activeStaffId}`;
    if (activeStatus !== 'all') url += `&status=${activeStatus}`;
    if (activeRole !== 'all') url += `&role=${activeRole}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Export query failed');
    return await res.json();
  };

  const exportCSV = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await getExportLogs();
      const records: AttendanceLog[] = data.logs || [];

      const headers = [
        'Date',
        'Staff Name',
        'Role',
        'Clock In Time (WAT)',
        'Clock Out Time (WAT)',
        'Clock Out Type',
        'Total Hours Worked',
        'Time Away (Mins)',
        'Not On Seat Count',
        'Not On Seat Details',
        'Auto Clock Out Flag'
      ];

      const rows = records.map(l => {
        const details = l.awayDetails
          .map(d => `[Reason: ${d.reason}, Start: ${formatTime(d.start_time)}, End: ${d.end_time ? formatTime(d.end_time) : 'Auto resolved'}]`)
          .join('; ');

        return [
          l.date.split('T')[0],
          l.staff_name,
          getDisplayRole(l.staff_role),
          l.clock_in_time ? new Date(l.clock_in_time).toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos' }) : '—',
          l.clock_out_time ? new Date(l.clock_out_time).toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos' }) : '—',
          l.clock_out_type || 'Incomplete',
          l.total_hours_on_duty || 0,
          l.total_time_not_on_seat || 0,
          l.awayDetails.length,
          details,
          l.was_not_on_seat_at_auto_clockout ? 'Yes' : 'No'
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error(err);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const data = await getExportLogs();
      const records: AttendanceLog[] = data.logs || [];

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Attendance Log Report</title>
            <style>
              body { font-family: sans-serif; padding: 30px; color: #1e293b; background-color: #ffffff; }
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
              .header-title { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
              .header-sub { font-size: 10px; font-weight: 700; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
              .meta-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 10px; margin-bottom: 20px; line-height: 1.5; }
              table.data-table { width: 100%; border-collapse: collapse; font-size: 9px; }
              th { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 800; background-color: #f1f5f9; color: #334155; text-transform: uppercase; }
              td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; color: #475569; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              tr.auto-clockout td { background-color: #fffbeb !important; border-color: #fef3c7; }
              .status-badge { font-weight: 800; font-size: 8px; padding: 2px 4px; border-radius: 4px; text-transform: uppercase; border: 1px solid; }
              .status-complete { background-color: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
              .status-incomplete { background-color: #fffbeb; border-color: #fde68a; color: #92400e; }
              .status-auto { background-color: #fef2f2; border-color: #fecaca; color: #991b1b; }
              .away-row { font-size: 8px; background-color: #fafafa; padding-left: 20px; color: #64748b; }
            </style>
          </head>
          <body>
            <h1 class="header-title">${lgName}</h1>
            <p class="header-sub">Staff Attendance Report · Official LG Document</p>
            <hr style="border: 0; border-top: 2px solid #1e3a8a; margin: 12px 0 20px 0;" />
            
            <div class="meta-box">
              <strong>Report Range:</strong> ${formatDate(activeStartDate || defaultStart)} to ${formatDate(activeEndDate || defaultEnd)}<br />
              <strong>Generated By:</strong> Chairman ${chairmanName || 'LGA Chairman'}<br />
              <strong>Total Records:</strong> ${records.length} logs
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Total Hours</th>
                  <th>Time Away</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(l => {
                  const statusInfo = getLogStatusLabel(l);
                  const isAuto = l.clock_out_type === 'auto';
                  const badgeClass = isAuto 
                    ? 'status-auto' 
                    : l.status === 'clocked_out' 
                      ? 'status-complete' 
                      : 'status-incomplete';

                  const awayDetails = l.awayDetails.length > 0 
                    ? `<br/><span style="font-size: 7px; color: #64748b;"><strong>Away periods:</strong> ` + 
                      l.awayDetails.map(d => `${d.reason} (${formatTime(d.start_time)} - ${d.end_time ? formatTime(d.end_time) : 'Auto resolved'})`).join('; ') + 
                      `</span>`
                    : '';

                  const autoNote = l.was_not_on_seat_at_auto_clockout 
                    ? `<br/><span style="font-size: 7.5px; color: #b45309; font-weight: 700;">* Still Not On Seat at auto clock out — Reason: ${l.not_on_seat_reason_at_auto_clockout}</span>`
                    : '';

                  return `
                    <tr class="${isAuto ? 'auto-clockout' : ''}">
                      <td><strong>${new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong></td>
                      <td>
                        <strong>${l.staff_name}</strong>
                        ${awayDetails}
                        ${autoNote}
                      </td>
                      <td>${getDisplayRole(l.staff_role)}</td>
                      <td>${formatTime(l.clock_in_time)}</td>
                      <td>${formatTime(l.clock_out_time)} ${isAuto ? '<em>(Auto)</em>' : ''}</td>
                      <td><strong>${formatHours(l.total_hours_on_duty)}</strong></td>
                      <td>${l.total_time_not_on_seat ? Math.round(l.total_time_not_on_seat) + ' mins' : '—'}</td>
                      <td><span class="status-badge ${badgeClass}">${statusInfo.label}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

    } catch (err) {
      console.error(err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  // Date constants for UI defaults
  const now = new Date();
  const lagosYear = parseInt(now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', year: 'numeric' }), 10);
  const lagosMonth = now.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: '2-digit' });
  const defaultStart = `${lagosYear}-${lagosMonth}-01`;
  const defaultEnd = `${lagosYear}-${lagosMonth}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-650">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Staff Attendance Log</h1>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
              Review and audit clock-in records and stepping-out history
            </p>
          </div>
        </div>

        {/* Export Dropdown */}
        <div className="relative self-start sm:self-center">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export Logs</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 py-1">
              <button
                onClick={exportCSV}
                className="w-full px-4 py-2.5 text-xs text-slate-650 hover:bg-slate-50 flex items-center gap-2 text-left font-bold cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export as CSV
              </button>
              <button
                onClick={exportPDF}
                className="w-full px-4 py-2.5 text-xs text-slate-650 hover:bg-slate-50 flex items-center gap-2 text-left font-bold cursor-pointer"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Staff */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Staff</span>
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{summary.totalStaff}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Officers &amp; Treasurer registered</p>
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Present Today</span>
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
              <Clock className="h-4.5 w-4.5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{summary.presentToday}</h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Active staff on duty today</p>
          </div>
        </div>

        {/* Card 3: Auto Clock-outs */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Auto Clock Outs</span>
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{summary.autoClockoutsMonth}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Fired at 9pm WAT this month</p>
          </div>
        </div>

        {/* Card 4: Avg Hours On Duty */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Avg Hours On Duty</span>
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-xl">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{summary.avgHoursMonth}h</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Net average per shift this month</p>
          </div>
        </div>
      </div>

      {/* Filters Form */}
      <form onSubmit={handleApplyFilters} className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h3 className="font-extrabold text-slate-800 text-sm">Filters &amp; Search</h3>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-100/50 transition-all flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" /> Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Date range - From */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Date From</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Date range - To */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Date To</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Staff selection dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Staff Member</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50 cursor-pointer"
            >
              <option value="">All Staff Members</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({getDisplayRole(s.role)})</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Shift Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">All Logs</option>
              <option value="complete">Complete (Manual Clock Out)</option>
              <option value="incomplete">Incomplete / Active</option>
              <option value="auto_clockout">Auto Clock Out (9pm)</option>
            </select>
          </div>

          {/* Role filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Staff Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="officer">Account Officer</option>
              <option value="treasurer">Council Treasurer</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100/50">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-655" />
            </div>
            <p className="text-xs font-bold text-slate-455 uppercase tracking-wider animate-pulse">Fetching records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">No attendance records found</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              No shift logs match the active filter criteria. Try broadening your dates or resetting the filter.
            </p>
            {isFiltered && (
              <button
                onClick={handleClearFilters}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg border border-indigo-100/50 transition-all cursor-pointer inline-block"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-450 uppercase tracking-wider select-none">
                  <th className="py-4 px-5 w-8"></th>
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5">Staff Member</th>
                  <th className="py-4 px-5">Role</th>
                  <th className="py-4 px-5">Clock In</th>
                  <th className="py-4 px-5">Clock Out</th>
                  <th className="py-4 px-5">Hours On Duty</th>
                  <th className="py-4 px-5">Time Away</th>
                  <th className="py-4 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const statusInfo = getLogStatusLabel(log);
                  const isExpanded = expandedRows.has(log.id);
                  const isAuto = log.clock_out_type === 'auto';
                  
                  return (
                    <Fragment key={log.id}>
                      <tr 
                        key={log.id} 
                        className={`transition-colors border-l-2 ${
                          isAuto 
                            ? 'bg-amber-50/30 hover:bg-amber-50/50 border-l-amber-400' 
                            : 'hover:bg-slate-50/30 border-l-transparent'
                        }`}
                      >
                        <td className="py-4 px-4 text-center">
                          {log.awayDetails && log.awayDetails.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleRow(log.id)}
                              className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-5 font-bold text-slate-800">
                          {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-extrabold text-slate-900">{log.staff_name}</div>
                          {log.was_not_on_seat_at_auto_clockout && (
                            <div className="text-[10px] text-amber-700 font-extrabold flex items-center gap-1 mt-0.5">
                              <Info className="h-3 w-3 shrink-0" />
                              <span>Still Away at auto clock out — Reason: {log.not_on_seat_reason_at_auto_clockout}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 font-semibold text-slate-500">
                          {getDisplayRole(log.staff_role)}
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-600">
                          {formatTime(log.clock_in_time)}
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-600">
                          {formatTime(log.clock_out_time)}
                          {isAuto && (
                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 border border-rose-100 rounded px-1.5 py-0.25 ml-1">
                              Auto
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 font-black text-slate-800">
                          {formatHours(log.total_hours_on_duty)}
                        </td>
                        <td className="py-4 px-5 font-semibold text-slate-600">
                          {log.total_time_not_on_seat ? `${Math.round(log.total_time_not_on_seat)}m` : '—'}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-black border rounded-md uppercase tracking-wider ${statusInfo.style}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable sub-table */}
                      {isExpanded && log.awayDetails && log.awayDetails.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={9} className="py-3.5 px-8 border-t border-slate-100/50">
                            <div className="space-y-2 max-w-4xl">
                              <h4 className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-450" />
                                Not On Seat Records Details
                              </h4>
                              
                              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                                      <th className="py-2 px-4">Stepped Out At</th>
                                      <th className="py-2 px-4">Returned At</th>
                                      <th className="py-2 px-4">Duration Away</th>
                                      <th className="py-2 px-4">Reason</th>
                                      <th className="py-2 px-4">Resolution Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-600">
                                    {log.awayDetails.map((away) => (
                                      <tr key={away.id}>
                                        <td className="py-2.5 px-4 font-medium">{formatTime(away.start_time)}</td>
                                        <td className="py-2.5 px-4 font-medium">
                                          {away.end_time ? formatTime(away.end_time) : (
                                            <span className="text-rose-600 font-extrabold">Auto-resolved at 9pm</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 font-bold text-slate-700">
                                          {away.duration_minutes ? `${away.duration_minutes} mins` : '—'}
                                        </td>
                                        <td className="py-2.5 px-4 italic text-slate-500 font-medium">"{away.reason}"</td>
                                        <td className="py-2.5 px-4">
                                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                                            away.resolved_by === 'user' 
                                              ? 'bg-slate-50 text-slate-600 border border-slate-150' 
                                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                                          }`}>
                                            {away.resolved_by === 'user' ? 'Self resolved' : 'Auto Resolved (9pm)'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-semibold">
                  Showing page <span className="font-bold text-slate-850">{page}</span> of{' '}
                  <span className="font-bold text-slate-850">{totalPages}</span> ({totalCount} shift records)
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-slate-500 hover:text-indigo-650 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - page) <= 1) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            page === pageNum
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white text-slate-650 border-slate-200/85 hover:border-indigo-350 hover:text-indigo-655'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} className="text-slate-400 text-xs px-1 select-none">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 text-slate-500 hover:text-indigo-655 bg-white border border-slate-200/80 rounded-lg disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
