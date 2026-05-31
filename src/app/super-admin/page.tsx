import { query } from '@/lib/db';
import { 
  Map, 
  Building2, 
  Users, 
  Plus,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import StateLogo from '@/components/StateLogo';

export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
  // Query core statistics
  const statsQuery = await Promise.all([
    query('SELECT COUNT(*)::int as count FROM states'),
    query('SELECT COUNT(*)::int as count FROM local_governments'),
    query('SELECT COUNT(*)::int as count FROM users')
  ]);

  const totalStates = statsQuery[0].rows[0].count;
  const totalLgs = statsQuery[1].rows[0].count;
  const totalUsers = statsQuery[2].rows[0].count;

  // Query state breakdowns (LGA count and active user operators per state)
  const stateBreakdowns = await query(`
    SELECT 
      s.id, 
      s.name, 
      s.code, 
      s.logo_url,
      COUNT(DISTINCT lg.id)::int as lg_count, 
      COUNT(DISTINCT u.id)::int as user_count
    FROM states s 
    LEFT JOIN local_governments lg ON s.id = lg.state_id 
    LEFT JOIN users u ON lg.id = u.lg_id
    GROUP BY s.id, s.name, s.code, s.logo_url 
    ORDER BY lg_count DESC, s.name ASC
  `);

  // Query recent audit logs
  const recentLogs = await query(`
    SELECT 
      al.id, 
      al.action, 
      al.details, 
      al.created_at, 
      u.name as user_name, 
      u.role as user_role 
    FROM audit_logs al 
    LEFT JOIN users u ON al.user_id = u.id 
    ORDER BY al.created_at DESC 
    LIMIT 5
  `);

  return (
    <div className="space-y-6">
      
      {/* Top section: Stats on left, operations & health on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left side: Main statistics & Registry Table (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Smart Wallet-style Platform Registry Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/50 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Activity className="h-4 w-4" />
                </div>
                <span className="font-bold text-slate-800 text-sm">Infrastructure Registry</span>
              </div>
              <Link
                href="/super-admin/states"
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Onboard State</span>
              </Link>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Deployments</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{totalLgs} Active LGAs</span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-extrabold rounded-md">
                  {totalStates} States Active
                </span>
              </div>
            </div>

            {/* Sub-balances layout */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">States</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800 block">{totalStates} Registered</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Local Govts</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800 block">{totalLgs} Onboarded</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Operators</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800 block">{totalUsers} Staff Members</span>
              </div>
            </div>
          </div>

          {/* State Tenant Deployment Table */}
          <div className="bg-white rounded-3xl border border-slate-200/50 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">State Deployment Registry</h3>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{totalStates} Active States</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-4 px-6">State</th>
                  <th className="py-4 px-6">Code</th>
                  <th className="py-4 px-6 text-center">Local Govts</th>
                  <th className="py-4 px-6 text-right">Active Operators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
                {stateBreakdowns.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                      No states onboarded. Go to States module to add one.
                    </td>
                  </tr>
                ) : (
                  stateBreakdowns.rows.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-3">
                        <StateLogo logoUrl={row.logo_url} code={row.code} name={row.name} />
                        <span>{row.name}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                          {row.code}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-extrabold text-slate-700">{row.lg_count}</td>
                      <td className="py-4 px-6 text-right font-black text-amber-700">
                        {row.user_count} staff
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right side: Health Monitor & Quick actions (4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* System Health Status Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-amber-500 fill-amber-500" />
                <h3 className="font-bold text-slate-800 text-sm">System Health</h3>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-md border border-amber-100 uppercase tracking-wide">
                Active
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Database Status */}
              <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500 font-medium">Database Node</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Operational</span>
                </div>
              </div>

              {/* API server Status */}
              <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500 font-medium">API Server Gateway</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Operational</span>
                </div>
              </div>

              {/* Auth Engine Status */}
              <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                <span className="text-slate-500 font-medium">Auth Controller</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Active</span>
                </div>
              </div>

              {/* Logging Engine Status */}
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-slate-500 font-medium">Audit Logger Stream</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>Streaming</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/50 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Quick Operations</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/super-admin/states"
                className="p-3 bg-slate-50 hover:bg-amber-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-1.5 transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-500 group-hover:text-amber-600 transition-colors">
                  <Map className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-amber-700 transition-colors">Add State</span>
              </Link>

              <Link
                href="/super-admin/lgs"
                className="p-3 bg-slate-50 hover:bg-amber-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-1.5 transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-500 group-hover:text-amber-600 transition-colors">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-amber-700 transition-colors">Onboard LG</span>
              </Link>

              <Link
                href="/super-admin/users"
                className="p-3 bg-slate-50 hover:bg-amber-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-1.5 transition-colors group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-500 group-hover:text-amber-600 transition-colors">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-amber-700 transition-colors">Create User</span>
              </Link>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-1.5 opacity-55">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-505">Security Logs</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Section: Platform Activity Logs (takes full width) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 text-sm">System Activity Logs</h3>
          </div>
          <span className="text-[9px] bg-amber-50 border border-amber-100 text-amber-700 font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
            Live Stream
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
          {recentLogs.rows.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">No recent actions logged.</p>
          ) : (
            recentLogs.rows.map((log: any) => (
              <div key={log.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{log.user_name || 'System'}</span>
                    <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md uppercase tracking-wider">
                      {log.user_role ? log.user_role.replace('_', ' ') : 'System'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">{log.details}</p>
                </div>
                <div className="flex sm:flex-col items-end gap-1 shrink-0 text-right">
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider">
                    {log.action.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
