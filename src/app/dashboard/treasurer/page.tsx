'use client';

import { useState, useEffect, useCallback } from 'react';
import AttendanceWidget from '@/components/AttendanceWidget';
import {
  TrendingUp,
  Users,
  FileText,
  AlertCircle,
  CheckSquare,
  DollarSign,
  BarChart3,
  Activity,
  UserCog,
  Loader2,
  Calendar,
  ChevronDown,
  ArrowUpRight
} from 'lucide-react';

interface Metrics {
  totalRevenue: number;
  revenueThisMonth: number;
  outstandingBalance: number;
  totalClients: number;
  totalDemandBills: number;
  paidBills: number;
  unpaidBills: number;
}

interface ChartDataPoint {
  label: string;
  revenue: number;
}

interface OfficerRow {
  id: string;
  name: string;
  role: string;
  clients_added: number;
  bills_generated: number;
  receipts_generated: number;
  total_revenue: number;
  last_active_date: string | null;
}

interface ActivityItem {
  type: 'client_created' | 'bill_created' | 'payment_confirmed';
  ref: string;
  detail: string;
  amount: number | null;
  created_at: string;
  officer_name: string | null;
}

type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const formatNaira = (amount: number) =>
  '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const getNigeriaDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return formatter.format(new Date());
};

const getActivityIcon = (type: string) => {
  if (type === 'client_created') return { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' };
  if (type === 'bill_created') return { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' };
  return { icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' };
};

const getActivityLabel = (type: string) => {
  if (type === 'client_created') return 'New Client';
  if (type === 'bill_created') return 'Bill Created';
  return 'Payment Confirmed';
};

// ─── Chart Bars sub-component with reliable hover tooltip ─────────────────────
function ChartBars({
  chartData,
  maxRevenue,
  formatNaira,
}: {
  chartData: ChartDataPoint[];
  maxRevenue: number;
  formatNaira: (n: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-250 scrollbar-track-transparent">
      {/* Chart area — height:220px with pt-10 for tooltip space and px-12 to prevent tooltip overflow clipping */}
      <div className="relative flex items-end gap-2 min-w-max pb-4 px-12 pt-10" style={{ height: '220px' }}>

        {/* Floating tooltip — renders above the chart, centred on hovered bar */}
        {hoveredIndex !== null && (
          <div
            className="absolute top-2 z-20 pointer-events-none transition-all duration-100"
            style={{
              // Each bar column is 32px wide + 8px gap (40px step), offset by 48px padding (px-12) + 16px (half of bar width)
              left: `${hoveredIndex * 40 + 64}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-xl px-3 py-2 shadow-xl text-center whitespace-nowrap border border-slate-700/80">
              <div className="text-[9px] font-extrabold text-indigo-300 uppercase tracking-wider leading-none mb-1">
                {chartData[hoveredIndex]?.label}
              </div>
              <div className="text-xs font-black text-white leading-none">
                {formatNaira(chartData[hoveredIndex]?.revenue ?? 0)}
              </div>
            </div>
            {/* Caret arrow pointing down */}
            <div className="flex justify-center">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900/95" />
            </div>
          </div>
        )}

        {/* Bars */}
        {chartData.map((point, i) => {
          const barHeight = Math.max((point.revenue / maxRevenue) * 140, 4);
          const isHovered = hoveredIndex === i;
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 cursor-pointer select-none"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Spacer so bars align to the bottom */}
              <div className="flex-1" />
              <div
                className="w-8 rounded-t-lg transition-all duration-200"
                style={{
                  height: `${barHeight}px`,
                  background: isHovered
                    ? 'linear-gradient(to top, #4338ca, #6366f1)'
                    : 'linear-gradient(to top, #6366f1, #818cf8)',
                  boxShadow: isHovered ? '0 0 0 2px #c7d2fe' : 'none',
                  transform: isHovered ? 'scaleX(1.1)' : 'scaleX(1)',
                }}
              />
              <span className="text-[9px] text-slate-400 font-semibold text-center whitespace-nowrap mt-1">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TreasurerDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>('monthly');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState('');



  const fetchDashboard = useCallback(async (p: ChartPeriod, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setChartLoading(true);

    try {
      const res = await fetch(`/api/chairman/dashboard?period=${p}`);
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const data = await res.json();
      setMetrics(data.metrics);
      setChartData(data.chartData);
      if (isInitial) {
        setOfficers(data.officers);
        setActivity(data.recentActivity);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(period, true);
  }, [fetchDashboard, period]);

  const handlePeriodChange = (p: ChartPeriod) => {
    setPeriod(p);
    fetchDashboard(p, false);
  };

  // Compute chart scale
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-semibold text-slate-600">{error}</p>
      </div>
    );
  }

  const m = metrics!;

  return (
    <div className="space-y-8">
      <AttendanceWidget />

      {/* --- Welcome Banner --- */}
      <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-emerald-850 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-56 h-56 bg-teal-500/8 rounded-full blur-2xl -mb-12 pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-450/20 inline-block">
            Treasurer Overview
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight pt-1">Revenue Analytics Dashboard</h1>
          <p className="text-emerald-300/80 text-sm font-medium pt-0.5">
            Read-only view · All data scoped to your Local Government.
          </p>
        </div>
      </div>

      {/* --- Row 1 Stats --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight truncate">{formatNaira(m.totalRevenue)}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">All-time confirmed payments</p>
          </div>
        </div>

        {/* Revenue This Month */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">This Month</span>
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight truncate">{formatNaira(m.revenueThisMonth)}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Revenue this calendar month</p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Outstanding</span>
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight truncate">{formatNaira(m.outstandingBalance)}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Unpaid &amp; partial balance</p>
          </div>
        </div>

        {/* Total Clients */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Clients</span>
            <div className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{m.totalClients.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Registered in this LGA</p>
          </div>
        </div>
      </div>

      {/* --- Row 2 Stats --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4 transition-all duration-200 hover:shadow-md">
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Total Bills</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{m.totalDemandBills.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4 transition-all duration-200 hover:shadow-md">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 shrink-0">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Paid Bills</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{m.paidBills.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center gap-4 transition-all duration-200 hover:shadow-md">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-650 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Unpaid / Overdue</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{m.unpaidBills.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* --- Revenue Chart --- */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm">Revenue Over Time</h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Confirmed payments</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as ChartPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer capitalize ${
                  period === p
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>

        {chartLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            No revenue data for this period.
          </div>
        ) : (
          <ChartBars chartData={chartData} maxRevenue={maxRevenue} formatNaira={formatNaira} />
        )}
      </div>


      {/* --- Bottom Grid: Officer Performance + Recent Activity --- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Officer Performance */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700">
              <UserCog className="h-5 w-5" />
            </div>
            <h3 className="font-black text-slate-800 text-sm">Officer Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-3 px-5">Officer</th>
                  <th className="py-3 px-5 text-center">Clients</th>
                  <th className="py-3 px-5 text-center">Bills</th>
                  <th className="py-3 px-5">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No officers found for this LGA.</td>
                  </tr>
                ) : (
                  officers.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-800 truncate max-w-[140px]">{o.name}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{
                          o.role === 'lg_treasurer' || o.role === 'treasurer' ? 'Council Treasurer' : 'Account Officer'
                        }</div>
                      </td>
                      <td className="py-3.5 px-5 text-center font-bold text-slate-700">{o.clients_added}</td>
                      <td className="py-3.5 px-5 text-center font-bold text-slate-700">{o.bills_generated}</td>
                      <td className="py-3.5 px-5 font-extrabold text-slate-900 text-xs">{formatNaira(o.total_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-black text-slate-800 text-sm">Recent Activity</h3>
            </div>
            <a
              href="/dashboard/treasurer/activity"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all border border-indigo-100/50 flex items-center gap-1 cursor-pointer"
            >
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="divide-y divide-slate-100">
            {activity.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No recent activity found.</div>
            ) : (
              activity.map((item, i) => {
                const { icon: Icon, color, bg } = getActivityIcon(item.type);
                return (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/40 transition-colors">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{getActivityLabel(item.type)}</span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{item.ref}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.detail}{item.officer_name ? ` · ${item.officer_name}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.amount != null && item.amount > 0 && (
                        <p className="text-xs font-extrabold text-slate-800">{formatNaira(item.amount)}</p>
                      )}
                      <p className="text-[9px] text-slate-400 mt-0.5">{formatDate(item.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
