'use client';

import { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  FileText, 
  Building2, 
  RefreshCw, 
  Search, 
  Filter, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Map, 
  Loader2, 
  AlertTriangle,
  Info
} from 'lucide-react';

interface SummaryStats {
  total_revenue: number;
  total_transactions: number;
  total_active_lgs: number;
}

interface ChartItem {
  period: string;
  amount: number;
}

interface StateBreakdown {
  state_id: string;
  state_name: string;
  lg_count: number;
  total_transactions: number;
  total_revenue: number;
}

interface LgBreakdown {
  lg_id: string;
  lg_name: string;
  state_name: string;
  total_transactions: number;
  total_revenue: number;
  last_transaction_date: string | null;
}

interface TransactionRecord {
  id: string;
  transaction_date: string;
  lg_name: string;
  state_name: string;
  client_name: string;
  total_amount_paid: number;
  lg_share: number;
  khrien_share: number;
  flutterwave_transaction_id: string;
}

interface StateRecord {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface LgRecord {
  id: string;
  state_id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export default function PlatformRevenue() {
  // Page state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'state' | 'lg' | 'log'>('state');

  // Summary stats
  const [summary, setSummary] = useState<SummaryStats>({
    total_revenue: 0,
    total_transactions: 0,
    total_active_lgs: 0
  });

  // Wallet balance state
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState(false);

  // Chart state
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // Breakdown tables state
  const [statesBreakdown, setStatesBreakdown] = useState<StateBreakdown[]>([]);
  const [lgsBreakdown, setLgsBreakdown] = useState<LgBreakdown[]>([]);

  // Transaction Log paginated table state
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  // Filter values
  const [filterSearch, setFilterSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterLg, setFilterLg] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Dropdown lists
  const [statesList, setStatesList] = useState<StateRecord[]>([]);
  const [lgsList, setLgsList] = useState<LgRecord[]>([]);

  // Helper formatting for Naira
  const formatNaira = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return '₦0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '₦0.00';
    return '₦' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
  };

  // Helper date formatting
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load basic dropdown structures
  useEffect(() => {
    async function loadFilters() {
      try {
        const [statesRes, lgsRes] = await Promise.all([
          fetch('/api/super-admin/states'),
          fetch('/api/super-admin/lgs')
        ]);
        const statesData = await statesRes.json();
        const lgsData = await lgsRes.json();

        if (statesRes.ok) setStatesList(statesData.states || []);
        if (lgsRes.ok) setLgsList(lgsData.lgs || []);
      } catch (err) {
        console.error('Error fetching filter resources:', err);
      }
    }
    loadFilters();
  }, []);

  // Fetch Flutterwave Balance
  const fetchWalletBalance = async () => {
    setLoadingWallet(true);
    setWalletError(false);
    try {
      const res = await fetch('/api/admin/flutterwave-balance');
      const data = await res.json();
      if (res.ok) {
        setWalletBalance(data.available_balance);
      } else {
        setWalletError(true);
      }
    } catch {
      setWalletError(true);
    } finally {
      setLoadingWallet(false);
    }
  };

  // Fetch Summary stats, breaks, and log records
  const fetchRevenueAnalytics = async (resetPage = false) => {
    if (resetPage) setCurrentPage(1);
    
    setLoading(true);
    setError('');

    const pageQuery = resetPage ? 1 : currentPage;
    const queryParams = new URLSearchParams({
      chart_period: chartPeriod,
      page: pageQuery.toString(),
      limit: pageSize.toString(),
      search: filterSearch,
      state_id: filterState,
      lg_id: filterLg,
      start_date: filterStartDate,
      end_date: filterEndDate
    });

    try {
      const res = await fetch(`/api/super-admin/revenue?${queryParams}`);
      const data = await res.json();

      if (res.ok) {
        setSummary(data.summary);
        setChartData(data.chart_data || []);
        setStatesBreakdown(data.breakdown_states || []);
        setLgsBreakdown(data.breakdown_lgs || []);
        setTransactions(data.transactions?.data || []);
        setTotalCount(data.transactions?.total_count || 0);
        setTotalPages(data.transactions?.total_pages || 1);
      } else {
        setError(data.error || 'Failed to fetch platform revenue analytics');
      }
    } catch (err) {
      setError('Network error fetching revenue analytics');
    } finally {
      setLoading(false);
    }
  };

  // Trigger load on initial mount and when filters/period change
  useEffect(() => {
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    fetchRevenueAnalytics();
  }, [chartPeriod, currentPage]);

  const handleApplyFilters = () => {
    fetchRevenueAnalytics(true);
  };

  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterState('');
    setFilterLg('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
    // Directly fetch with empty query parameters
    setTimeout(() => {
      fetchRevenueAnalytics(true);
    }, 0);
  };

  // Filter local governments based on selected state in filter
  const filteredLgsList = filterState 
    ? lgsList.filter(lg => lg.state_id === filterState) 
    : lgsList;

  // Maximum value for scaling the bar chart
  const maxChartValue = Math.max(...chartData.map(item => item.amount), 1000);

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Facilitation Revenue</h1>
          <p className="text-sm text-slate-505">Track facilitation fee earnings and master settlements wallet status.</p>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Flutterwave balance */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm relative group overflow-hidden flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <button
              onClick={fetchWalletBalance}
              disabled={loadingWallet}
              className="text-slate-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh wallet balance"
            >
              <RefreshCw className={`h-4 w-4 ${loadingWallet ? 'animate-spin text-amber-600' : ''}`} />
            </button>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Facilitator Wallet Balance</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              {loadingWallet && walletBalance === null ? (
                <span className="text-sm font-bold text-slate-450 animate-pulse">Loading...</span>
              ) : walletError ? (
                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Connection Error</span>
                </span>
              ) : (
                <span className="text-xl font-black text-slate-800 tracking-tight">
                  {formatNaira(walletBalance)}
                </span>
              )}
            </div>
          </div>
          {/* Subtle accent border */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        {/* Card 2: Total Facilitator Revenue */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between h-36 relative">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Facilitator Revenue</span>
            <span className="text-xl font-black text-slate-800 tracking-tight block mt-0.5">
              {formatNaira(summary.total_revenue)}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600"></div>
        </div>

        {/* Card 3: Total Transactions */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between h-36 relative">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Transactions Faciliated</span>
            <span className="text-xl font-black text-slate-800 tracking-tight block mt-0.5">
              {summary.total_transactions.toLocaleString('en-NG')}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800"></div>
        </div>

        {/* Card 4: Active LGAs */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between h-36 relative">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active LGA Tenants</span>
            <span className="text-xl font-black text-slate-800 tracking-tight block mt-0.5">
              {summary.total_active_lgs}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-400"></div>
        </div>

      </div>

      {/* Middle Section: Chart Block */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">Facilitation Fees Over Time</h3>
            <p className="text-xs text-slate-450">Monthly aggregates of facilitation fees routed to Khrien master wallet.</p>
          </div>

          {/* Chart period selectors */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded-xl w-fit">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  chartPeriod === p 
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/15' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Bar Chart Visualizer */}
        <div className="relative">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border border-dashed border-slate-150 rounded-2xl bg-slate-50/30">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <span className="text-xs font-bold tracking-wider uppercase">Loading chart data...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-1.5 border border-dashed border-slate-150 rounded-2xl bg-slate-50/30">
              <Info className="h-6 w-6 text-slate-350" />
              <span className="text-xs font-semibold">No platform revenue splits recorded for this period.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chart content area */}
              <div className="relative h-64 border-b border-slate-150 flex items-end gap-2 md:gap-4 px-4 pb-2 pt-6 overflow-x-auto no-scrollbar">
                
                {/* Horizontal Background grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2 pt-6">
                  <div className="w-full border-t border-slate-100 border-dashed relative">
                    <span className="absolute right-0 -top-2.5 text-[9px] font-bold text-slate-400 pr-1">{formatNaira(maxChartValue)}</span>
                  </div>
                  <div className="w-full border-t border-slate-100 border-dashed relative">
                    <span className="absolute right-0 -top-2.5 text-[9px] font-bold text-slate-400 pr-1">{formatNaira(maxChartValue * 0.75)}</span>
                  </div>
                  <div className="w-full border-t border-slate-100 border-dashed relative">
                    <span className="absolute right-0 -top-2.5 text-[9px] font-bold text-slate-400 pr-1">{formatNaira(maxChartValue * 0.5)}</span>
                  </div>
                  <div className="w-full border-t border-slate-100 border-dashed relative">
                    <span className="absolute right-0 -top-2.5 text-[9px] font-bold text-slate-400 pr-1">{formatNaira(maxChartValue * 0.25)}</span>
                  </div>
                </div>

                {/* Bars */}
                {chartData.map((item, idx) => {
                  const percentage = (item.amount / maxChartValue) * 100;
                  return (
                    <div 
                      key={idx} 
                      className="flex-1 h-full min-w-[32px] max-w-[80px] flex flex-col justify-end items-center group relative z-10"
                    >
                      {/* Interactive Hover Tooltip */}
                      <div className="absolute bottom-full mb-2.5 hidden group-hover:flex flex-col items-center z-25 animate-scale-in pointer-events-none">
                        <div className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex flex-col items-center gap-0.5">
                          <span className="text-slate-400 text-[8px] font-black uppercase tracking-wider">{item.period}</span>
                          <span>{formatNaira(item.amount)}</span>
                        </div>
                        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1"></div>
                      </div>

                      {/* Animated Column Bar */}
                      <div 
                        style={{ height: `${Math.max(percentage, 2)}%` }}
                        className="w-full bg-gradient-to-t from-amber-500 to-amber-600 rounded-t-lg transition-all duration-300 group-hover:from-amber-600 group-hover:to-amber-700 shadow-sm group-hover:shadow group-hover:scale-y-[1.02] origin-bottom"
                      ></div>

                      {/* X Axis Label */}
                      <span className="text-[9px] font-bold text-slate-400 mt-2 truncate w-full text-center tracking-tight">
                        {item.period.slice(-5)}
                      </span>
                    </div>
                  );
                })}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Breakdowns Tabs */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Tab Controls */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('state')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'state' 
                ? 'border-amber-600 text-amber-750' 
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            By State
          </button>
          <button
            onClick={() => setActiveTab('lg')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'lg' 
                ? 'border-amber-600 text-amber-750' 
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            By Local Government
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'log' 
                ? 'border-amber-600 text-amber-750' 
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Transaction Log
          </button>
        </div>

        {/* Tab 1: By State */}
        {activeTab === 'state' && (
          <div className="border border-slate-100 rounded-2xl overflow-hidden animate-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                  <th className="py-4 px-6">State Name</th>
                  <th className="py-4 px-6">Onboarded LGs</th>
                  <th className="py-4 px-6">Total Facilitated Transactions</th>
                  <th className="py-4 px-6 text-right">Khrien Share Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
                {loading && statesBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                      <span>Loading state data...</span>
                    </td>
                  </tr>
                ) : statesBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No state analytics found.
                    </td>
                  </tr>
                ) : (
                  statesBreakdown.map((row) => (
                    <tr key={row.state_id} className="hover:bg-slate-55/40 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-800">{row.state_name}</td>
                      <td className="py-4 px-6 font-medium text-slate-600">{row.lg_count}</td>
                      <td className="py-4 px-6 text-slate-550">{row.total_transactions.toLocaleString('en-NG')}</td>
                      <td className="py-4 px-6 text-right font-bold text-slate-800">{formatNaira(row.total_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: By LG */}
        {activeTab === 'lg' && (
          <div className="border border-slate-100 rounded-2xl overflow-hidden animate-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                  <th className="py-4 px-6">LGA Name</th>
                  <th className="py-4 px-6">Parent State</th>
                  <th className="py-4 px-6">Total Facilitated Transactions</th>
                  <th className="py-4 px-6">Last Transaction Date</th>
                  <th className="py-4 px-6 text-right">Khrien Share Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
                {loading && lgsBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                      <span>Loading LGA data...</span>
                    </td>
                  </tr>
                ) : lgsBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No Local Government analytics found.
                    </td>
                  </tr>
                ) : (
                  lgsBreakdown.map((row) => (
                    <tr key={row.lg_id} className="hover:bg-slate-55/40 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-800">{row.lg_name}</td>
                      <td className="py-4 px-6 text-slate-550">{row.state_name}</td>
                      <td className="py-4 px-6 font-medium text-slate-600">{row.total_transactions.toLocaleString('en-NG')}</td>
                      <td className="py-4 px-6 text-xs text-slate-505">{formatDate(row.last_transaction_date)}</td>
                      <td className="py-4 px-6 text-right font-bold text-slate-800">{formatNaira(row.total_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Transaction Log */}
        {activeTab === 'log' && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Filters panel */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                <Filter className="h-4 w-4 text-slate-400" />
                <span>Filter Transaction Log</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div>
                  <label htmlFor="search-input" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Search Client / Location</label>
                  <div className="relative">
                    <input
                      id="search-input"
                      type="text"
                      placeholder="Search Client, State, LGA..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>

                {/* State select */}
                <div>
                  <label htmlFor="state-filter" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">State</label>
                  <select
                    id="state-filter"
                    value={filterState}
                    onChange={(e) => {
                      setFilterState(e.target.value);
                      setFilterLg(''); // Reset cascading LG filter
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">All States</option>
                    {statesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* LGA select */}
                <div>
                  <label htmlFor="lga-filter" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Local Government</label>
                  <select
                    id="lga-filter"
                    value={filterLg}
                    onChange={(e) => setFilterLg(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">All LGAs</option>
                    {filteredLgsList.map(lg => (
                      <option key={lg.id} value={lg.id}>{lg.name}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label htmlFor="start-date" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                  <div className="relative">
                    <input
                      id="start-date"
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                    />
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>

                {/* End Date */}
                <div>
                  <label htmlFor="end-date" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
                  <div className="relative">
                    <input
                      id="end-date"
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer"
                    />
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-1.5">
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 border border-slate-250 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Clear Filters
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm hover:shadow"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                    <th className="py-4 px-5">Date</th>
                    <th className="py-4 px-5">Local Govt</th>
                    <th className="py-4 px-5">State</th>
                    <th className="py-4 px-5">Client Name</th>
                    <th className="py-4 px-5 text-right">Amount Paid</th>
                    <th className="py-4 px-5 text-right">LG Share</th>
                    <th className="py-4 px-5 text-right">Khrien Share</th>
                    <th className="py-4 px-5">Flutterwave ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-650">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                        <span>Loading transactions...</span>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400 font-semibold">
                        No platform transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-55/40 transition-colors duration-150">
                        <td className="py-4 px-5 text-slate-550 whitespace-nowrap">{formatDate(tx.transaction_date)}</td>
                        <td className="py-4 px-5 font-bold text-slate-850">{tx.lg_name}</td>
                        <td className="py-4 px-5 font-medium text-slate-650">{tx.state_name}</td>
                        <td className="py-4 px-5 font-semibold text-slate-700">{tx.client_name}</td>
                        <td className="py-4 px-5 text-right font-semibold text-slate-808">{formatNaira(tx.total_amount_paid)}</td>
                        <td className="py-4 px-5 text-right text-emerald-700 font-medium">{formatNaira(tx.lg_share)}</td>
                        <td className="py-4 px-5 text-right text-amber-700 font-bold">{formatNaira(tx.khrien_share)}</td>
                        <td className="py-4 px-5">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate block max-w-[120px]" title={tx.flutterwave_transaction_id}>
                            {tx.flutterwave_transaction_id}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-505 font-bold">
                  Showing Page {currentPage} of {totalPages} ({totalCount} transactions total)
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 border border-slate-250 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 border border-slate-250 text-slate-500 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 rounded-xl transition cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" />
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
