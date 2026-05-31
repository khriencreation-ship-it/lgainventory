'use client';

import { useState, useEffect, useCallback, Suspense, Fragment } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  User,
  Tags,
  Download,
  Calendar,
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet
} from 'lucide-react';


// Format helpers
const formatNaira = (amount: any) => {
  if (amount === undefined || amount === null) return '₦0.00';
  const val = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(val)) return '₦0.00';
  return '₦' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + 
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// Main wrapper with Suspense boundary
export default function ChairmanReportsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Initializing Reports Workspace...</p>
      </div>
    }>
      <ChairmanReportsPage />
    </Suspense>
  );
}

function ChairmanReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Active Tab from URL
  const activeTab = searchParams.get('tab') || 'revenue'; // revenue | bills | clients | officers | levies

  // Common dropdown state
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [lgDetails, setLgDetails] = useState<any>(null);
  const [chairmanName, setChairmanName] = useState('LGA Chairman');

  // Filters from URL/state
  const [startDate, setStartDate] = useState(searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(searchParams.get('to') || new Date().toISOString().split('T')[0]);
  
  // Tab-specific filters
  const [groupBy, setGroupBy] = useState(searchParams.get('groupBy') || 'monthly'); // daily | weekly | monthly | yearly
  const [paymentMethod, setPaymentMethod] = useState(searchParams.get('paymentMethod') || 'all'); // all | flutterwave | bank_transfer
  const [officerId, setOfficerId] = useState(searchParams.get('officerId') || '');
  const [billStatus, setBillStatus] = useState(searchParams.get('status') || 'all');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');

  // Loading & Data states
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>({});
  const [reportData, setReportData] = useState<any[]>([]);

  // Expanded rows for drill downs
  const [expandedOfficerId, setExpandedOfficerId] = useState<string | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Fetch Chairman Profile for PDF signatures
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/officer/profile');
        if (res.ok) {
          const data = await res.json();
          setChairmanName(data.user?.name || 'LGA Chairman');
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchProfile();
  }, []);

  // Update URL Query Parameters
  const updateQueryParams = useCallback((params: Record<string, string>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });
    router.push(`${pathname}?${nextParams.toString()}`);
  }, [searchParams, router, pathname]);

  // Fetch reports data from backend
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      let typeParam = 'revenue';
      if (activeTab === 'bills') typeParam = 'demand-bills';
      else if (activeTab === 'clients') typeParam = 'clients';
      else if (activeTab === 'officers') typeParam = 'officers';
      else if (activeTab === 'levies') typeParam = 'levies';

      let url = `/api/chairman/reports?type=${typeParam}&startDate=${startDate}&endDate=${endDate}`;
      
      if (activeTab === 'revenue') {
        url += `&groupBy=${groupBy}&paymentMethod=${paymentMethod}&officerId=${officerId}`;
      } else if (activeTab === 'bills') {
        url += `&status=${billStatus}&officerId=${officerId}&categoryId=${categoryId}`;
      } else if (activeTab === 'clients') {
        url += `&officerId=${officerId}`;
      } else if (activeTab === 'officers') {
        url += `&officerId=${officerId}`;
      } else if (activeTab === 'levies') {
        url += `&categoryId=${categoryId}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to retrieve report data');
      const data = await res.json();

      setOfficers(data.officers || []);
      setCategories(data.categories || []);
      setLgDetails(data.lgDetails || null);
      setSummary(data.summary || {});
      setReportData(data.data || []);
      
      // Reset expansions
      setExpandedOfficerId(null);
      setExpandedCategoryId(null);
      setSortField('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, groupBy, paymentMethod, officerId, billStatus, categoryId]);

  // Reset reportData immediately when any query filter parameters change
  // to avoid rendering mismatched historical data layouts during reloading.
  useEffect(() => {
    setReportData([]);
    setLoading(true);
  }, [activeTab, startDate, endDate, groupBy, paymentMethod, officerId, billStatus, categoryId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Filter handlers
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({
      tab: activeTab,
      from: startDate,
      to: endDate,
      groupBy: activeTab === 'revenue' ? groupBy : '',
      paymentMethod: activeTab === 'revenue' ? paymentMethod : '',
      officerId: officerId,
      status: activeTab === 'bills' ? billStatus : '',
      categoryId: (activeTab === 'bills' || activeTab === 'levies') ? categoryId : ''
    });
  };

  const handleClearFilters = () => {
    const currentYear = new Date().getFullYear();
    const defaultStart = `${currentYear}-01-01`;
    const defaultEnd = new Date().toISOString().split('T')[0];

    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setGroupBy('monthly');
    setPaymentMethod('all');
    setOfficerId('');
    setBillStatus('all');
    setCategoryId('');

    updateQueryParams({
      tab: activeTab,
      from: defaultStart,
      to: defaultEnd,
      groupBy: '',
      paymentMethod: '',
      officerId: '',
      status: '',
      categoryId: ''
    });
  };

  // Sorting handler
  const handleSort = (field: string) => {
    const isAsc = sortField === field && sortOrder === 'ASC';
    const newOrder = isAsc ? 'DESC' : 'ASC';
    setSortField(field);
    setSortOrder(newOrder);

    // Sort reportData state
    const sorted = [...reportData].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return newOrder === 'ASC' ? -1 : 1;
      if (valA > valB) return newOrder === 'ASC' ? 1 : -1;
      return 0;
    });
    setReportData(sorted);
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortOrder === 'ASC' ? <ArrowUp className="h-3.5 w-3.5 text-indigo-650" /> : <ArrowDown className="h-3.5 w-3.5 text-indigo-650" />;
  };

  // Switch Tab
  const handleTabChange = (newTab: string) => {
    updateQueryParams({
      tab: newTab,
      from: startDate,
      to: endDate,
      groupBy: newTab === 'revenue' ? groupBy : '',
      paymentMethod: newTab === 'revenue' ? paymentMethod : '',
      officerId: officerId,
      status: newTab === 'bills' ? billStatus : '',
      categoryId: (newTab === 'bills' || newTab === 'levies') ? categoryId : ''
    });
  };

  // CSV Export Trigger
  const handleCSVExport = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const filename = `${activeTab}_report_${startDate}_to_${endDate}.csv`;

    if (activeTab === 'revenue') {
      headers = ['Period', 'Flutterwave Revenue (NGN)', 'Bank Transfer Revenue (NGN)', 'Total Revenue (NGN)', 'Transaction Count'];
      rows = reportData.map(r => [r.label, r.flw_revenue, r.bt_revenue, r.total_revenue, r.transaction_count]);
    } else if (activeTab === 'bills') {
      headers = ['Bill Reference', 'Client Name', 'Total Amount (NGN)', 'Amount Paid (NGN)', 'Balance Due (NGN)', 'Status', 'Generated By', 'Date Generated', 'Due Date'];
      rows = reportData.map(r => [
        r.reference_number,
        r.client_name,
        r.grand_total,
        r.amount_paid,
        r.balance_due,
        r.payment_status.toUpperCase(),
        r.generated_by,
        r.created_at.split('T')[0],
        r.due_date.split('T')[0]
      ]);
    } else if (activeTab === 'clients') {
      headers = ['Client Reference', 'Full Name', 'Phone', 'Ward', 'Added By', 'Date Added', 'Total Bills', 'Total Billed (NGN)', 'Total Paid (NGN)', 'Outstanding Balance (NGN)'];
      rows = reportData.map(r => [
        r.reference_number,
        r.full_name,
        r.phone_number,
        r.ward || 'N/A',
        r.added_by,
        r.created_at.split('T')[0],
        r.total_bills,
        r.total_billed,
        r.total_paid,
        r.outstanding_balance
      ]);
    } else if (activeTab === 'officers') {
      headers = ['Officer Name', 'Clients Added', 'Bills Generated', 'Receipts Generated', 'Flutterwave Payments', 'Manual Payments', 'Total Revenue Collected (NGN)', 'Last Active Date'];
      rows = reportData.map(r => [
        r.name,
        r.clients_added,
        r.bills_generated,
        r.receipts_generated,
        r.flw_payments_count,
        r.manual_payments_count,
        r.total_revenue,
        r.last_active_date ? r.last_active_date.split('T')[0] : 'Never'
      ]);
    } else if (activeTab === 'levies') {
      headers = ['Category Name', 'Levy Name', 'Bills Associated', 'Total Revenue split (NGN)'];
      reportData.forEach(cat => {
        cat.items.forEach((item: any) => {
          rows.push([cat.name, item.name, item.number_of_bills, item.total_revenue]);
        });
      });
    }

    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export Trigger (Browser Print Format)
  const handlePDFExport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build the tables content
    let reportBodyHtml = '';
    const stateLogo = lgDetails?.state_logo_url || '';
    const lgLogo = lgDetails?.lg_logo_url || '';
    const stateName = lgDetails?.state_name || 'STATE NAME';
    const lgName = lgDetails?.lg_name || 'LOCAL GOVERNMENT';
    const reportTitle = `${activeTab.replace('-', ' ')} Summary Report`.toUpperCase();

    // Summary block
    let summaryHtml = '';
    if (activeTab === 'revenue') {
      summaryHtml = `
        <div class="summary-card"><span>Total Revenue Collected:</span> <strong>${formatNaira(summary.totalRevenue)}</strong></div>
        <div class="summary-card"><span>Flutterwave Revenue:</span> <strong>${formatNaira(summary.flwRevenue)}</strong></div>
        <div class="summary-card"><span>Manual Teller Revenue:</span> <strong>${formatNaira(summary.btRevenue)}</strong></div>
        <div class="summary-card"><span>Total Transaction Volume:</span> <strong>${summary.transactionCount} successful logs</strong></div>
      `;
    } else if (activeTab === 'bills') {
      summaryHtml = `
        <div class="summary-card"><span>Total Bills Issued:</span> <strong>${summary.totalBills} notices</strong></div>
        <div class="summary-card"><span>Total Billed Amount:</span> <strong>${formatNaira(summary.totalBilled)}</strong></div>
        <div class="summary-card"><span>Total Collected:</span> <strong>${formatNaira(summary.totalCollected)}</strong></div>
        <div class="summary-card"><span>Total Outstanding:</span> <strong>${formatNaira(summary.totalOutstanding)}</strong></div>
        <div class="summary-card"><span>LGA Collection Rate:</span> <strong>${summary.collectionRate}%</strong></div>
      `;
    } else if (activeTab === 'clients') {
      summaryHtml = `
        <div class="summary-card"><span>Total Clients Enrolled:</span> <strong>${summary.totalClients} clients</strong></div>
        <div class="summary-card"><span>Total Collected Revenue:</span> <strong>${formatNaira(summary.totalRevenue)}</strong></div>
        <div class="summary-card"><span>Total LGA Outstanding:</span> <strong>${formatNaira(summary.totalOutstanding)}</strong></div>
        <div class="summary-card"><span>Average Collected Per Client:</span> <strong>${formatNaira(summary.averageRevenue)}</strong></div>
      `;
    } else if (activeTab === 'officers') {
      summaryHtml = `
        <div class="summary-card"><span>Active Officers in Range:</span> <strong>${summary.totalActiveOfficers} active</strong></div>
        <div class="summary-card"><span>Top Performer in Period:</span> <strong>${summary.highestRevenueOfficer?.name || 'N/A'} (${formatNaira(summary.highestRevenueOfficer?.amount || 0)})</strong></div>
        <div class="summary-card"><span>Total Billings Generated:</span> <strong>${summary.totalBillsGenerated} notices</strong></div>
        <div class="summary-card"><span>Total Revenue Collected:</span> <strong>${formatNaira(summary.totalRevenueCollected)}</strong></div>
      `;
    } else if (activeTab === 'levies') {
      summaryHtml = `
        <div class="summary-card"><span>Total Collected Revenue:</span> <strong>${formatNaira(summary.totalRevenue)}</strong></div>
        <div class="summary-card"><span>Top Performing Category:</span> <strong>${summary.topCategory?.name || 'N/A'} (${formatNaira(summary.topCategory?.amount || 0)})</strong></div>
        <div class="summary-card"><span>Top Performing Levy:</span> <strong>${summary.topLevy?.name || 'N/A'} (${formatNaira(summary.topLevy?.amount || 0)})</strong></div>
        <div class="summary-card"><span>Total Associated Logs:</span> <strong>${summary.totalTransactions} bills</strong></div>
      `;
    }

    // Chart Representation in print
    let printChartHtml = '';
    if (activeTab === 'revenue') {
      printChartHtml = `
        <div class="chart-container-print">
          <h3>Period Revenue Chart Summary</h3>
          <div class="bar-chart-print">
            ${reportData.map(r => {
              const maxVal = Math.max(...reportData.map(x => x.total_revenue)) || 1;
              const pct = (r.total_revenue / maxVal) * 100;
              return `
                <div class="chart-bar-print-row">
                  <span class="lbl">${r.label}</span>
                  <div class="bar-wrapper"><div class="bar-fill" style="width: ${pct}%"></div></div>
                  <span class="val">${formatNaira(r.total_revenue)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (activeTab === 'levies') {
      printChartHtml = `
        <div class="chart-container-print">
          <h3>Category Revenue Split</h3>
          <div class="bar-chart-print">
            ${reportData.map(c => {
              const maxVal = Math.max(...reportData.map(x => x.total_revenue)) || 1;
              const pct = (c.total_revenue / maxVal) * 100;
              return `
                <div class="chart-bar-print-row">
                  <span class="lbl">${c.name}</span>
                  <div class="bar-wrapper"><div class="bar-fill-category" style="width: ${pct}%"></div></div>
                  <span class="val">${formatNaira(c.total_revenue)} (${c.percentage_of_total}%)</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Main table representation
    let tableHtml = '';
    if (activeTab === 'revenue') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Flutterwave Rev</th>
              <th>Bank Transfer Rev</th>
              <th>Total Revenue</th>
              <th>Tx Count</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>${r.label}</td>
                <td>${formatNaira(r.flw_revenue)}</td>
                <td>${formatNaira(r.bt_revenue)}</td>
                <td style="font-weight:bold;">${formatNaira(r.total_revenue)}</td>
                <td>${r.transaction_count}</td>
              </tr>
            `).join('')}
            <tr style="font-weight:bold;background-color:#f1f5f9;">
              <td>TOTAL SUM</td>
              <td>${formatNaira(summary.flwRevenue)}</td>
              <td>${formatNaira(summary.btRevenue)}</td>
              <td>${formatNaira(summary.totalRevenue)}</td>
              <td>${summary.transactionCount}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 'bills') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Bill Ref</th>
              <th>Client Name</th>
              <th>Total Amount</th>
              <th>Amount Paid</th>
              <th>Balance Due</th>
              <th>Status</th>
              <th>Generated By</th>
              <th>Date Issued</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>${r.reference_number}</td>
                <td style="font-weight:bold;">${r.client_name}</td>
                <td>${formatNaira(r.grand_total)}</td>
                <td>${formatNaira(r.amount_paid)}</td>
                <td>${formatNaira(r.balance_due)}</td>
                <td>${r.payment_status.toUpperCase()}</td>
                <td>${r.generated_by}</td>
                <td>${formatDate(r.created_at)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight:bold;background-color:#f1f5f9;">
              <td colspan="2">TOTAL SUM</td>
              <td>${formatNaira(summary.totalBilled)}</td>
              <td>${formatNaira(summary.totalCollected)}</td>
              <td>${formatNaira(summary.totalOutstanding)}</td>
              <td colspan="3">Notice volume: ${summary.totalBills} bills</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 'clients') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Client Ref</th>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Ward</th>
              <th>Added By</th>
              <th>Date Enrolled</th>
              <th>Total Bills</th>
              <th>Total Billed</th>
              <th>Total Paid</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>${r.reference_number}</td>
                <td style="font-weight:bold;">${r.full_name}</td>
                <td>${r.phone_number}</td>
                <td>${r.ward || '—'}</td>
                <td>${r.added_by}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>${r.total_bills}</td>
                <td>${formatNaira(r.total_billed)}</td>
                <td>${formatNaira(r.total_paid)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight:bold;background-color:#f1f5f9;">
              <td colspan="6">TOTAL SUM</td>
              <td>—</td>
              <td>${formatNaira(reportData.reduce((acc, x) => acc + x.total_billed, 0))}</td>
              <td>${formatNaira(summary.totalRevenue)}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 'officers') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Officer Name</th>
              <th>Clients Added</th>
              <th>Bills Generated</th>
              <th>Receipts Generated</th>
              <th>Flutterwave Pymts</th>
              <th>Manual Pymts</th>
              <th>Collected Rev</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td style="font-weight:bold;">${r.name}</td>
                <td>${r.clients_added}</td>
                <td>${r.bills_generated}</td>
                <td>${r.receipts_generated}</td>
                <td>${r.flw_payments_count}</td>
                <td>${r.manual_payments_count}</td>
                <td style="font-weight:bold;color:#10b981;">${formatNaira(r.total_revenue)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight:bold;background-color:#f1f5f9;">
              <td>TOTAL SUM</td>
              <td>${reportData.reduce((acc, x) => acc + x.clients_added, 0)}</td>
              <td>${reportData.reduce((acc, x) => acc + x.bills_generated, 0)}</td>
              <td>${reportData.reduce((acc, x) => acc + x.receipts_generated, 0)}</td>
              <td>${reportData.reduce((acc, x) => acc + x.flw_payments_count, 0)}</td>
              <td>${reportData.reduce((acc, x) => acc + x.manual_payments_count, 0)}</td>
              <td>${formatNaira(summary.totalRevenueCollected)}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 'levies') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Category Breakdown / Levy Items</th>
              <th>Associated Bills</th>
              <th style="text-align:right;">Collected Revenue</th>
              <th style="text-align:right;">% Split</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(cat => `
              <tr style="font-weight:bold;background-color:#f8fafc;border-top:2px solid #cbd5e1;">
                <td>${cat.name}</td>
                <td>${cat.number_of_bills} notices</td>
                <td style="text-align:right;">${formatNaira(cat.total_revenue)}</td>
                <td style="text-align:right;">${cat.percentage_of_total}% of LGA</td>
              </tr>
              ${cat.items.map((item: any) => `
                <tr style="font-size:8px;color:#475569;">
                  <td style="padding-left:24px;">├── ${item.name}</td>
                  <td>${item.number_of_bills} bills</td>
                  <td style="text-align:right;">${formatNaira(item.total_revenue)}</td>
                  <td style="text-align:right;">${item.percentage_of_category}% of Cat</td>
                </tr>
              `).join('')}
            `).join('')}
            <tr style="font-weight:bold;background-color:#f1f5f9;border-top:2px solid #cbd5e1;">
              <td>LGA REVENUE SUM</td>
              <td>${summary.totalTransactions} notices</td>
              <td style="text-align:right;">${formatNaira(summary.totalRevenue)}</td>
              <td style="text-align:right;">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const html = `
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: sans-serif; padding: 0; color: #1e293b; background-color: #ffffff; margin: 0; }
            .header-doc { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header-top { display: flex; justify-content: space-between; align-items: center; }
            .logo-wrap { display: flex; align-items: center; gap: 8px; }
            .logo-img { height: 42px; width: 42px; object-contain: fit; }
            .lg-info-heading { text-align: center; flex: 1; }
            .lg-info-heading h1 { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .lg-info-heading h2 { font-size: 11px; font-weight: 700; margin: 2px 0 0 0; color: #475569; text-transform: uppercase; }
            .lg-info-heading p { font-size: 8px; margin: 3px 0 0 0; color: #64748b; font-weight: 550; }
            
            .report-title-bar { margin: 15px 0; text-align: center; }
            .report-title-bar h2 { font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px; color: #1e3a8a; }
            .report-title-bar p { font-size: 9px; margin: 4px 0 0 0; color: #64748b; font-weight: bold; }
            
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
            .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background-color: #f8fafc; font-size: 9px; }
            .summary-card span { display: block; color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 7px; margin-bottom: 2px; }
            .summary-card strong { font-size: 11px; color: #0f172a; font-weight: 800; }
            
            table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 15px; }
            th { border: 1px solid #cbd5e1; padding: 6px; text-align: left; font-weight: 800; background-color: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 8px; }
            td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; color: #475569; }
            tr:nth-child(even) td { background-color: #f8fafc; }
            
            .chart-container-print { margin: 20px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; }
            .chart-container-print h3 { font-size: 10px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            .bar-chart-print { display: flex; flex-direction: column; gap: 6px; }
            .chart-bar-print-row { display: flex; align-items: center; font-size: 8px; }
            .chart-bar-print-row .lbl { width: 100px; font-weight: 700; color: #475569; truncate: true; }
            .chart-bar-print-row .bar-wrapper { flex: 1; height: 10px; background-color: #e2e8f0; border-radius: 2px; margin: 0 10px; overflow: hidden; }
            .chart-bar-print-row .bar-fill { height: 100%; background-color: #6366f1; }
            .chart-bar-print-row .bar-fill-category { height: 100%; background-color: #10b981; }
            .chart-bar-print-row .val { font-weight: 700; width: 120px; text-align: right; color: #0f172a; }

            .footer-notes { margin-top: 40px; border-top: 1px dashed #cbd5e1; pt: 10px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; font-weight: bold; }
            
            @media print {
              body { padding: 1cm; }
              .no-print { display: none !important; }
              @page { size: A4; margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header-doc">
            <div class="header-top">
              ${stateLogo ? `<img src="${stateLogo}" class="logo-img" />` : '<div style="width:42px;"></div>'}
              <div class="lg-info-heading">
                <h1>${stateName} STATE GOVERNMENT</h1>
                <h2>${lgName} LOCAL GOVERNMENT COUNCIL</h2>
                <p>Official Executive Report · Scoped Data Directory</p>
              </div>
              ${lgLogo ? `<img src="${lgLogo}" class="logo-img" />` : '<div style="width:42px;"></div>'}
            </div>
          </div>
          
          <div class="report-title-bar">
            <h2>${reportTitle}</h2>
            <p>Period Range: ${formatDate(startDate)} to ${formatDate(endDate)} · Compiled by: ${chairmanName}</p>
          </div>
          
          <div class="summary-grid">
            ${summaryHtml}
          </div>
          
          ${printChartHtml}
          
          ${tableHtml}
          
          <div class="footer-notes">
            <span>${lgName} LGA Secretariat — Confidential</span>
            <span>Generated on ${formatDateTime(new Date().toISOString())}</span>
          </div>

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
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-650">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Executive Reports</h1>
            <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider mt-0.5">
              Read-only analytical report modules for local government operations
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2 -mb-px">
          {[
            { id: 'revenue', label: 'Revenue Report', icon: TrendingUp },
            { id: 'bills', label: 'Demand Bills', icon: FileText },
            { id: 'clients', label: 'Taxpayers / Clients', icon: Users },
            { id: 'officers', label: 'Officer Activity', icon: User },
            { id: 'levies', label: 'Levy Performance', icon: Tags }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-650 font-bold'
                    : 'border-transparent text-slate-450 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Options Bar */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h3 className="font-extrabold text-slate-800 text-sm">Report Criteria</h3>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-bold text-rose-650 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-100/50 transition-all flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3 w-3" /> Reset Criteria
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Picker Start */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Start Period</label>
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

          {/* Date Picker End */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">End Period</label>
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

          {/* Tab Specific Filters */}
          {activeTab === 'revenue' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Group Series By</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
                >
                  <option value="all">All Methods</option>
                  <option value="flutterwave">Flutterwave Online</option>
                  <option value="bank_transfer">Manual Bank Teller</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'bills' && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Bill Status</label>
                <select
                  value={billStatus}
                  onChange={(e) => setBillStatus(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="not_paid">Not Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Levy Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(activeTab === 'revenue' || activeTab === 'bills' || activeTab === 'clients' || activeTab === 'officers') && (
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider">Attributed Officer</label>
              <select
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              >
                <option value="">All Officers</option>
                {officers.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'levies' && (
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Primary Category Filter</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-slate-50/50"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100/50">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
          >
            Generate Report
          </button>
        </div>
      </form>

      {/* Main Report Area */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm py-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
          <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">Compiling data tables...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* 1. Summary Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTab === 'revenue' && (
              <>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Total Revenue</span>
                  <span className="text-xl font-black text-slate-900 block">{formatNaira(summary.totalRevenue || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Online (Flutterwave)</span>
                  <span className="text-xl font-black text-indigo-600 block">{formatNaira(summary.flwRevenue || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Manual Bank Teller</span>
                  <span className="text-xl font-black text-sky-600 block">{formatNaira(summary.btRevenue || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Transactions Logged</span>
                  <span className="text-xl font-black text-slate-700 block">{summary.transactionCount || 0} bills paid</span>
                </div>
              </>
            )}

            {activeTab === 'bills' && (
              <>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Total Bill Notices</span>
                  <span className="text-xl font-black text-slate-900 block">{summary.totalBills || 0} notices</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Total Amount Billed</span>
                  <span className="text-xl font-black text-slate-800 block">{formatNaira(summary.totalBilled || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Total Collected</span>
                  <span className="text-xl font-black text-emerald-705 block">{formatNaira(summary.totalCollected || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Collection Rate</span>
                  <span className="text-xl font-black text-indigo-705 block">{summary.collectionRate || 0}% split</span>
                </div>
              </>
            )}

            {activeTab === 'clients' && (
              <>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Total Enrolled Taxpayers</span>
                  <span className="text-xl font-black text-slate-900 block">{summary.totalClients || 0} clients</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Collected Revenue</span>
                  <span className="text-xl font-black text-emerald-705 block">{formatNaira(summary.totalRevenue || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Taxpayer Outstanding</span>
                  <span className="text-xl font-black text-rose-600 block">{formatNaira(summary.totalOutstanding || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Average Paid Per Client</span>
                  <span className="text-xl font-black text-indigo-700 block">{formatNaira(summary.averageRevenue || 0)}</span>
                </div>
              </>
            )}

            {activeTab === 'officers' && (
              <>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Active Account Officers</span>
                  <span className="text-xl font-black text-slate-950 block">{summary.totalActiveOfficers || 0} active</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5 col-span-1 sm:col-span-2">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Highest Revenue Officer</span>
                  <span className="text-sm font-black text-emerald-755 block truncate">
                    {summary.highestRevenueOfficer?.name || 'N/A'} ({formatNaira(summary.highestRevenueOfficer?.amount || 0)})
                  </span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Total Collected split</span>
                  <span className="text-xl font-black text-indigo-700 block">{formatNaira(summary.totalRevenueCollected || 0)}</span>
                </div>
              </>
            )}

            {activeTab === 'levies' && (
              <>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Total Revenue splits</span>
                  <span className="text-xl font-black text-slate-900 block">{formatNaira(summary.totalRevenue || 0)}</span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Top Category</span>
                  <span className="text-xs font-black text-indigo-705 block truncate">
                    {summary.topCategory?.name || 'N/A'} ({formatNaira(summary.topCategory?.amount || 0)})
                  </span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Top Performing Levy</span>
                  <span className="text-xs font-black text-emerald-705 block truncate font-mono">
                    {summary.topLevy?.name || 'N/A'} ({formatNaira(summary.topLevy?.amount || 0)})
                  </span>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-1.5">
                  <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Category Transactions</span>
                  <span className="text-xl font-black text-slate-705 block">{summary.totalTransactions || 0} bills</span>
                </div>
              </>
            )}
          </div>

          {/* 2. Chart Section */}
          {activeTab === 'revenue' && reportData.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">LGA Revenue Collection History</h3>
              
              {/* Responsive SVG Bar Chart */}
              <div className="w-full border-b border-slate-100 pb-2">
                <div className="flex h-[250px] items-end justify-between gap-2 pt-6 px-4">
                  {reportData.map((d, index) => {
                    const maxVal = Math.max(...reportData.map(x => x.total_revenue)) || 1;
                    const flwPct = (d.flw_revenue / maxVal) * 100;
                    const btPct = (d.bt_revenue / maxVal) * 100;
                    const totalPct = flwPct + btPct;

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer">
                        
                        {/* Hover Details Card tooltip */}
                        <div className="absolute bottom-full mb-2 bg-slate-900 text-white rounded-xl p-3 shadow-xl z-20 text-[10px] space-y-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-44 font-medium text-left">
                          <p className="font-bold text-indigo-300 border-b border-slate-800 pb-1">{d.label}</p>
                          <p className="flex justify-between"><span>Online (FLW):</span> <strong>{formatNaira(d.flw_revenue)}</strong></p>
                          <p className="flex justify-between"><span>Manual Teller:</span> <strong>{formatNaira(d.bt_revenue)}</strong></p>
                          <p className="flex justify-between border-t border-slate-800 pt-1 font-bold"><span>Total Collected:</span> <strong>{formatNaira(d.total_revenue)}</strong></p>
                        </div>

                        {/* Split Stacked Bars */}
                        <div className="w-full bg-slate-50/20 border border-slate-100/50 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: `${totalPct}%` }}>
                          <div className="bg-sky-500 w-full" style={{ height: `${(d.bt_revenue / (d.total_revenue || 1)) * 100}%` }} title={`Manual: ${formatNaira(d.bt_revenue)}`} />
                          <div className="bg-indigo-650 w-full" style={{ height: `${(d.flw_revenue / (d.total_revenue || 1)) * 100}%` }} title={`Online: ${formatNaira(d.flw_revenue)}`} />
                        </div>

                        {/* Label */}
                        <span className="text-[9px] font-bold text-slate-450 mt-2 truncate w-full text-center">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart Legend */}
              <div className="flex justify-center gap-6 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-indigo-650 rounded-md" />
                  <span>Online Card/QR (Flutterwave)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-sky-500 rounded-md" />
                  <span>Manual Teller Deposits (Bank Transfer)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'levies' && reportData.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Category Contribution Breakdown</h3>
              
              {/* Category Horizontal Bar Chart */}
              <div className="space-y-3.5 pt-2">
                {reportData.map((cat, idx) => {
                  const maxVal = Math.max(...reportData.map(x => x.total_revenue)) || 1;
                  const pct = (cat.total_revenue / maxVal) * 100;
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{cat.name}</span>
                        <span className="font-extrabold text-slate-900">{formatNaira(cat.total_revenue)} ({cat.percentage_of_total}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Data Tables */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-55 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">Report Ledger</span>
              
              {/* Export actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCSVExport}
                  className="px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-700 border border-emerald-150 hover:border-emerald-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handlePDFExport}
                  className="px-3 py-1.5 text-[11px] font-black text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-700 border border-rose-150 hover:border-rose-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-rose-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            {/* Tab Rendering */}
            <div className="overflow-x-auto">
              
              {/* Tab 1: Revenue Table */}
              {activeTab === 'revenue' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('key')}>
                        <div className="flex items-center gap-1"><span>Period</span> {renderSortIcon('key')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('flw_revenue')}>
                        <div className="flex items-center justify-end gap-1"><span>Flutterwave Revenue</span> {renderSortIcon('flw_revenue')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('bt_revenue')}>
                        <div className="flex items-center justify-end gap-1"><span>Bank Transfer Revenue</span> {renderSortIcon('bt_revenue')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_revenue')}>
                        <div className="flex items-center justify-end gap-1"><span>Total Revenue</span> {renderSortIcon('total_revenue')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('transaction_count')}>
                        <div className="flex items-center justify-end gap-1"><span>Transaction count</span> {renderSortIcon('transaction_count')}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-805">{row.label}</td>
                        <td className="py-3.5 px-5 text-right font-medium text-slate-500">{formatNaira(row.flw_revenue)}</td>
                        <td className="py-3.5 px-5 text-right font-medium text-slate-500">{formatNaira(row.bt_revenue)}</td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">{formatNaira(row.total_revenue)}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-700">{row.transaction_count}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black text-slate-800">
                      <td className="py-4 px-5">TOTAL SUM</td>
                      <td className="py-4 px-5 text-right text-indigo-755">{formatNaira(summary.flwRevenue || 0)}</td>
                      <td className="py-4 px-5 text-right text-sky-755">{formatNaira(summary.btRevenue || 0)}</td>
                      <td className="py-4 px-5 text-right text-indigo-755">{formatNaira(summary.totalRevenue || 0)}</td>
                      <td className="py-4 px-5 text-right">{summary.transactionCount || 0} bills</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Tab 2: Demand Bills Table */}
              {activeTab === 'bills' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('reference_number')}>
                        <div className="flex items-center gap-1"><span>Bill Ref</span> {renderSortIcon('reference_number')}</div>
                      </th>
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('client_name')}>
                        <div className="flex items-center gap-1"><span>Client Name</span> {renderSortIcon('client_name')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('grand_total')}>
                        <div className="flex items-center justify-end gap-1"><span>Total Billed</span> {renderSortIcon('grand_total')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('amount_paid')}>
                        <div className="flex items-center justify-end gap-1"><span>Amount Paid</span> {renderSortIcon('amount_paid')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('balance_due')}>
                        <div className="flex items-center justify-end gap-1"><span>Balance Due</span> {renderSortIcon('balance_due')}</div>
                      </th>
                      <th className="py-3 px-5 text-center cursor-pointer" onClick={() => handleSort('payment_status')}>
                        <div className="flex items-center justify-center gap-1"><span>Status</span> {renderSortIcon('payment_status')}</div>
                      </th>
                      <th className="py-3 px-5">Generated By</th>
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1"><span>Date Generated</span> {renderSortIcon('created_at')}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-805">{row.reference_number}</td>
                        <td className="py-3.5 px-5 font-extrabold text-slate-900">{row.client_name}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-655">{formatNaira(row.grand_total)}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-emerald-700">{formatNaira(row.amount_paid)}</td>
                        <td className="py-3.5 px-5 text-right font-black text-rose-600">{formatNaira(row.balance_due)}</td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                            row.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>{row.payment_status}</span>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-500">{row.generated_by}</td>
                        <td className="py-3.5 px-5 font-medium text-slate-450">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black text-slate-800">
                      <td colSpan={2} className="py-4 px-5">TOTAL SUM</td>
                      <td className="py-4 px-5 text-right text-slate-850">{formatNaira(summary.totalBilled || 0)}</td>
                      <td className="py-4 px-5 text-right text-emerald-650">{formatNaira(summary.totalCollected || 0)}</td>
                      <td className="py-4 px-5 text-right text-rose-600">{formatNaira(summary.totalOutstanding || 0)}</td>
                      <td colSpan={3} className="py-4 px-5 text-center">{summary.totalBills} bill notices</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Tab 3: Clients Table */}
              {activeTab === 'clients' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('reference_number')}>
                        <div className="flex items-center gap-1"><span>Taxpayer Ref</span> {renderSortIcon('reference_number')}</div>
                      </th>
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('full_name')}>
                        <div className="flex items-center gap-1"><span>Full Name</span> {renderSortIcon('full_name')}</div>
                      </th>
                      <th className="py-3 px-5">Phone</th>
                      <th className="py-3 px-5">Ward</th>
                      <th className="py-3 px-5">Added By</th>
                      <th className="py-3 px-5 cursor-pointer" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1"><span>Date Added</span> {renderSortIcon('created_at')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_bills')}>
                        <div className="flex items-center justify-end gap-1"><span>Bills count</span> {renderSortIcon('total_bills')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_billed')}>
                        <div className="flex items-center justify-end gap-1"><span>Billed Sum</span> {renderSortIcon('total_billed')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_paid')}>
                        <div className="flex items-center justify-end gap-1"><span>Paid Sum</span> {renderSortIcon('total_paid')}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-805">{row.reference_number}</td>
                        <td className="py-3.5 px-5 font-extrabold text-slate-900">{row.full_name}</td>
                        <td className="py-3.5 px-5 font-semibold text-slate-500">{row.phone_number}</td>
                        <td className="py-3.5 px-5 font-semibold text-slate-500">{row.ward || '—'}</td>
                        <td className="py-3.5 px-5 font-semibold text-slate-500">{row.added_by}</td>
                        <td className="py-3.5 px-5 font-medium text-slate-450">{formatDate(row.created_at)}</td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-700">{row.total_bills}</td>
                        <td className="py-3.5 px-5 text-right font-semibold text-slate-500">{formatNaira(row.total_billed)}</td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-emerald-700">{formatNaira(row.total_paid)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black text-slate-800">
                      <td colSpan={6} className="py-4 px-5">TOTAL SUM</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.total_bills, 0)} bills</td>
                      <td className="py-4 px-5 text-right text-slate-850">{formatNaira(reportData.reduce((acc, x) => acc + x.total_billed, 0))}</td>
                      <td className="py-4 px-5 text-right text-emerald-650">{formatNaira(summary.totalRevenue || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Tab 4: Officer Activity Table with drill-down */}
              {activeTab === 'officers' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                      <th className="py-3 px-5">Officer Name</th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('clients_added')}>
                        <div className="flex items-center justify-end gap-1"><span>Clients Added</span> {renderSortIcon('clients_added')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('bills_generated')}>
                        <div className="flex items-center justify-end gap-1"><span>Bills Issued</span> {renderSortIcon('bills_generated')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('receipts_generated')}>
                        <div className="flex items-center justify-end gap-1"><span>Receipts Issued</span> {renderSortIcon('receipts_generated')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('flw_payments_count')}>
                        <div className="flex items-center justify-end gap-1"><span>Online Payments</span> {renderSortIcon('flw_payments_count')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('manual_payments_count')}>
                        <div className="flex items-center justify-end gap-1"><span>Manual Payments</span> {renderSortIcon('manual_payments_count')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_revenue')}>
                        <div className="flex items-center justify-end gap-1"><span>Total Collected</span> {renderSortIcon('total_revenue')}</div>
                      </th>
                      <th className="py-3 px-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => {
                      const isExpanded = expandedOfficerId === row.id;
                      return (
                        <Fragment key={row.id || i}>
                          <tr className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3.5 px-5 font-extrabold text-slate-900">{row.name}</td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-700">{row.clients_added}</td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-700">{row.bills_generated}</td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-700">{row.receipts_generated}</td>
                            <td className="py-3.5 px-5 text-right font-medium text-slate-550">{row.flw_payments_count}</td>
                            <td className="py-3.5 px-5 text-right font-medium text-slate-550">{row.manual_payments_count}</td>
                            <td className="py-3.5 px-5 text-right font-black text-emerald-700">{formatNaira(row.total_revenue)}</td>
                            <td className="py-3.5 px-5 text-center">
                              <button
                                onClick={() => setExpandedOfficerId(isExpanded ? null : row.id)}
                                className="px-2 py-1 text-[10px] font-black uppercase text-indigo-650 hover:bg-indigo-50 border border-indigo-150 rounded-lg flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide bills' : 'View bills'}</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Drill Down */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50/60 p-5 border-y border-slate-100">
                                <div className="space-y-3.5 max-w-4xl mx-auto">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Demand Notices generated by {row.name} ({row.bills?.length || 0} bills)</h4>
                                  </div>
                                  <div className="bg-white border border-slate-200/50 rounded-2xl overflow-hidden shadow-inner max-h-[220px] overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50/60 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                          <th className="py-2 px-4">Bill Ref</th>
                                          <th className="py-2 px-4">Taxpayer / Client</th>
                                          <th className="py-2 px-4 text-right">Amount</th>
                                          <th className="py-2 px-4 text-center">Status</th>
                                          <th className="py-2 px-4">Date Issued</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-655">
                                        {!row.bills || row.bills.length === 0 ? (
                                          <tr>
                                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">No bill notices created in this range.</td>
                                          </tr>
                                        ) : (
                                          row.bills.map((bill: any, i: number) => (
                                            <tr key={bill.id || i} className="hover:bg-slate-50/30">
                                              <td className="py-2 px-4 font-bold text-slate-800">{bill.reference_number}</td>
                                              <td className="py-2 px-4 font-extrabold text-slate-850">{bill.client_name}</td>
                                              <td className="py-2 px-4 text-right text-slate-900">{formatNaira(bill.grand_total)}</td>
                                              <td className="py-2 px-4 text-center">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                  bill.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                                }`}>{bill.payment_status}</span>
                                              </td>
                                              <td className="py-2 px-4 font-medium text-slate-450">{formatDate(bill.created_at)}</td>
                                            </tr>
                                          ))
                                        )}
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
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black text-slate-800">
                      <td className="py-4 px-5">TOTAL SUM</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.clients_added, 0)} clients</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.bills_generated, 0)} bills</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.receipts_generated, 0)} receipts</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.flw_payments_count, 0)} flw</td>
                      <td className="py-4 px-5 text-right">{reportData.reduce((acc, x) => acc + x.manual_payments_count, 0)} manual</td>
                      <td className="py-4 px-5 text-right text-emerald-650">{formatNaira(summary.totalRevenueCollected || 0)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Tab 5: Levy Performance Category Breakdown with items expansion */}
              {activeTab === 'levies' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider select-none">
                      <th className="py-3 px-5">Category Name / Levy Breakdown</th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('number_of_bills')}>
                        <div className="flex items-center justify-end gap-1"><span>Bill notices</span> {renderSortIcon('number_of_bills')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('total_revenue')}>
                        <div className="flex items-center justify-end gap-1"><span>Collected Revenue</span> {renderSortIcon('total_revenue')}</div>
                      </th>
                      <th className="py-3 px-5 text-right cursor-pointer" onClick={() => handleSort('percentage_of_total')}>
                        <div className="flex items-center justify-end gap-1"><span>% of Total LGA</span> {renderSortIcon('percentage_of_total')}</div>
                      </th>
                      <th className="py-3 px-5 text-center">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((cat, i) => {
                      const isExpanded = expandedCategoryId === cat.id;
                      return (
                        <Fragment key={cat.id || i}>
                          <tr className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3.5 px-5 font-extrabold text-slate-900">{cat.name}</td>
                            <td className="py-3.5 px-5 text-right font-bold text-slate-700">{cat.number_of_bills} notices</td>
                            <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">{formatNaira(cat.total_revenue)}</td>
                            <td className="py-3.5 px-5 text-right font-black text-indigo-700">{cat.percentage_of_total}%</td>
                            <td className="py-3.5 px-5 text-center">
                              <button
                                onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                                className="px-2 py-1 text-[10px] font-black uppercase text-indigo-650 hover:bg-indigo-50 border border-indigo-150 rounded-lg flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide items' : 'View items'}</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </td>
                          </tr>

                          {/* Category Expand Items List */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50/40 p-5 border-y border-slate-100">
                                <div className="space-y-3 max-w-4xl mx-auto">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Levy items under {cat.name}</h4>
                                  
                                  <div className="bg-white border border-slate-200/50 rounded-2xl overflow-hidden shadow-inner">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50/60 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                          <th className="py-2 px-4">Levy Name</th>
                                          <th className="py-2 px-4 text-right">Bills Count</th>
                                          <th className="py-2 px-4 text-right">Collected Revenue</th>
                                          <th className="py-2 px-4 text-right">% of Category</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-655">
                                        {(cat.items || []).map((item: any, i: number) => (
                                          <tr key={i} className="hover:bg-slate-50/20">
                                            <td className="py-2.5 px-4 font-bold text-slate-800">{item.name}</td>
                                            <td className="py-2.5 px-4 text-right text-slate-600">{item.number_of_bills} notices</td>
                                            <td className="py-2.5 px-4 text-right text-emerald-700 font-extrabold">{formatNaira(item.total_revenue)}</td>
                                            <td className="py-2.5 px-4 text-right text-indigo-650 font-black">{item.percentage_of_category}%</td>
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
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black text-slate-800">
                      <td className="py-4 px-5">LGA REVENUE SUM</td>
                      <td className="py-4 px-5 text-right">{summary.totalTransactions} notices</td>
                      <td className="py-4 px-5 text-right text-emerald-650">{formatNaira(summary.totalRevenue || 0)}</td>
                      <td className="py-4 px-5 text-right text-indigo-700">100%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
