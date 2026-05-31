import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { query } from '@/lib/db';
import Link from 'next/link';
import AttendanceWidget from '@/components/AttendanceWidget';
import { 
  FileText, 
  CheckSquare, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  UserPlus, 
  ArrowRight,
  Receipt
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OfficerDashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    redirect('/');
  }

  const user = await verifyJWT(sessionToken);

  if (!user || (
    user.role !== 'lg_account_officer' && 
    user.role !== 'treasurer' && 
    user.role !== 'lg_officer' && 
    user.role !== 'lg_treasurer'
  )) {
    redirect('/');
  }

  // Fetch user's Local Government Name
  const lgQuery = await query(
    'SELECT name FROM local_governments WHERE id = $1',
    [user.lg_id]
  );
  const lgName = lgQuery.rows[0]?.name || 'Local Government Authority';

  // 1. Bills Generated Today (Count of bills created today by this officer)
  const billsTodayQuery = await query(
    `SELECT COUNT(*)::int as count FROM demand_bills 
     WHERE created_by = $1 AND lg_id = $2 AND created_at::date = CURRENT_DATE`,
    [user.id, user.lg_id]
  );
  const billsGeneratedToday = billsTodayQuery.rows[0]?.count || 0;

  // 2. Payments Confirmed Today (Count of demand bills marked as paid today that this officer raised)
  const paymentsTodayQuery = await query(
    `SELECT COUNT(DISTINCT d.id)::int as count 
     FROM demand_bills d 
     JOIN payments p ON d.id = p.bill_id 
     WHERE d.created_by = $1 AND d.lg_id = $2 
       AND p.payment_date::date = CURRENT_DATE 
       AND p.status = 'successful'`,
    [user.id, user.lg_id]
  );
  const paymentsConfirmedToday = paymentsTodayQuery.rows[0]?.count || 0;

  // 3. Revenue Collected Today (Sum of confirmed payments today from this officer's bills)
  const revenueTodayQuery = await query(
    `SELECT COALESCE(SUM(p.amount), 0)::float as sum 
     FROM demand_bills d 
     JOIN payments p ON d.id = p.bill_id 
     WHERE d.created_by = $1 AND d.lg_id = $2 
       AND p.payment_date::date = CURRENT_DATE 
       AND p.status = 'successful'`,
    [user.id, user.lg_id]
  );
  const revenueCollectedToday = revenueTodayQuery.rows[0]?.sum || 0;

  // 4. Pending Bills (Count of all unpaid demand bills this officer has ever raised)
  const pendingBillsQuery = await query(
    `SELECT COUNT(*)::int as count FROM demand_bills 
     WHERE created_by = $1 AND lg_id = $2 AND payment_status = 'unpaid'`,
    [user.id, user.lg_id]
  );
  const pendingBillsCount = pendingBillsQuery.rows[0]?.count || 0;

  // 5. Recent Activity: Last 10 demand bills this officer generated
  const recentBillsQuery = await query(
    `SELECT 
       db.id,
       db.reference_number, 
       c.full_name as client_name, 
       db.grand_total::float as total_amount, 
       CASE 
         WHEN db.payment_status = 'unpaid' AND db.due_date < CURRENT_DATE THEN 'overdue' 
         ELSE db.payment_status 
       END as status, 
       db.created_at 
     FROM demand_bills db 
     JOIN clients c ON db.client_id = c.id 
     WHERE db.created_by = $1 AND db.lg_id = $2 
     ORDER BY db.created_at DESC 
     LIMIT 10`,
    [user.id, user.lg_id]
  );
  const recentBills = recentBillsQuery.rows;

  // Format today's date (e.g. "Thursday, 28 May 2026")
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  const formattedDate = today.toLocaleDateString('en-GB', dateOptions);

  // Currency formatter
  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-8">
      {/* Attendance Widget */}
      <AttendanceWidget />

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 rounded-3xl p-6 sm:p-8 text-white border border-slate-850 shadow-md relative overflow-hidden">
        {/* Abstract decorative shapes */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl -mb-10 pointer-events-none"></div>
        
        <div className="relative z-10 space-y-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Account Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight pt-1">
            Welcome back, {user.name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
            <p className="text-slate-350 text-sm font-semibold">
              {formattedDate}
            </p>
            <span className="hidden sm:inline text-slate-600 font-bold">•</span>
            <p className="text-amber-400 text-xs sm:text-sm font-extrabold">
              {lgName}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Bills Generated Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Bills Generated Today</span>
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{billsGeneratedToday}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Created by you today</p>
          </div>
        </div>

        {/* Card 2: Payments Confirmed Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Payments Confirmed</span>
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
              <CheckSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{paymentsConfirmedToday}</h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Marked paid today</p>
          </div>
        </div>

        {/* Card 3: Revenue Collected Today */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Revenue Collected Today</span>
            <div className="p-2.5 bg-amber-50 border border-amber-150 text-amber-700 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight truncate">{formatNaira(revenueCollectedToday)}</h3>
            <p className="text-[10px] text-slate-450 mt-1 font-medium">Naira collected today</p>
          </div>
        </div>

        {/* Card 4: Pending Bills */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Pending Bills</span>
            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">{pendingBillsCount}</h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Unpaid bills ever raised</p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-slate-50 border border-slate-200/40 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Quick Operations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/officer/clients/new"
            className="flex items-center justify-between p-4 bg-white hover:bg-amber-50/30 border border-slate-200/60 hover:border-amber-200/50 rounded-2xl transition-all duration-150 shadow-sm group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shadow-sm group-hover:scale-105 transition-transform">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-slate-800">New Client</span>
                <span className="block text-xs text-slate-400 mt-0.5">Register a new client portfolio</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            href="/dashboard/officer/demand-bills/new"
            className="flex items-center justify-between p-4 bg-white hover:bg-amber-50/30 border border-slate-200/60 hover:border-amber-200/50 rounded-2xl transition-all duration-150 shadow-sm group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shadow-sm group-hover:scale-105 transition-transform">
                <Plus className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-slate-800">New Demand Bill</span>
                <span className="block text-xs text-slate-400 mt-0.5">Generate a new invoice or levy</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Recent Demand Bills</h3>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Last 10 Generated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                <th className="py-4 px-6">Reference No</th>
                <th className="py-4 px-6">Client Name</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Date Created</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
              {recentBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-semibold">
                    No demand bills generated yet. Use "New Demand Bill" to generate one.
                  </td>
                </tr>
              ) : (
                recentBills.map((bill: any) => {
                  let statusBadgeClass = "";
                  let statusText = bill.status;

                  if (bill.status === 'paid') {
                    statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    statusText = "Paid";
                  } else if (bill.status === 'unpaid') {
                    statusBadgeClass = "bg-amber-50 text-amber-700 border-amber-150";
                    statusText = "Pending";
                  } else {
                    statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                    statusText = "Overdue";
                  }

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/40 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-800">
                        {bill.reference_number}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-700">
                        {bill.client_name}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-slate-900">
                        {formatNaira(bill.total_amount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${statusBadgeClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-450 text-xs">
                        {new Date(bill.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/officer/demand-bills/${bill.id}`}
                          className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors inline-block cursor-pointer"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
