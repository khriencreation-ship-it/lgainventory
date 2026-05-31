'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Loader2, Building2, ShieldAlert, Check, Filter, Calendar, AlertTriangle, Info } from 'lucide-react';
import SlideOver from '@/components/SlideOver';
import Toast from '@/components/Toast';


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
  jurisdiction?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  state_name: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  flutterwave_subaccount_id?: string | null;
  flutterwave_subaccount_code?: string | null;
  khrien_split_percentage?: number | string | null;
  payment_setup_status?: 'not_configured' | 'payment_setup_incomplete' | 'active' | null;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmStyle: 'amber' | 'red';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmStyle,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
      ></div>

      {/* Modal Dialog */}
      <div className="relative bg-white border border-slate-200/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-scale-in text-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            confirmStyle === 'red' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        </div>
        
        <p className="text-xs text-slate-550 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer ${
              confirmStyle === 'red' 
                ? 'bg-red-600 hover:bg-red-750 shadow-md shadow-red-500/10' 
                : 'bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/10'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'EcoBank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '090479', name: 'First Heritage Microfinance Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '000030', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '090267', name: 'Kuda Bank' },
  { code: '100004', name: 'Opay' },
  { code: '100033', name: 'PalmPay' },
  { code: '327', name: 'Paga' },
  { code: '090110', name: 'VFD Microfinance Bank' }
];


export default function LgsManagement() {
  const router = useRouter();
  const [lgs, setLgs] = useState<LgRecord[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add panel states
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedStateId, setSelectedStateId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newJurisdiction, setNewJurisdiction] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Wizard step tracking
  const [wizardStep, setWizardStep] = useState(1);

  // Step 3 banking fields
  const [newBankCode, setNewBankCode] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [newSplitPct, setNewSplitPct] = useState('5.00');

  // Retry payment setup
  const [allowManualInput, setAllowManualInput] = useState(false);


  // Fetch LGs and States
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [lgsRes, statesRes] = await Promise.all([
        fetch('/api/super-admin/lgs'),
        fetch('/api/super-admin/states')
      ]);
      
      const lgsData = await lgsRes.json();
      const statesData = await statesRes.json();

      if (lgsRes.ok && statesRes.ok) {
        setLgs(lgsData.lgs || []);
        setStates(statesData.states || []);
      } else {
        setError(lgsData.error || statesData.error || 'Failed to retrieve data');
      }
    } catch (err) {
      setError('Network error fetching platform data');
    } finally {
      setLoading(false);
    }
  }



  const handleNextStep1 = () => {
    if (!selectedStateId) {
      setError('Please select a parent state.');
      return;
    }
    if (!newName.trim()) {
      setError('Please enter a Local Government name.');
      return;
    }
    if (!newCode.trim()) {
      setError('Please enter a Local Government code prefix.');
      return;
    }
    setError('');
    setWizardStep(2);
  };

  const handleNextStep2 = () => {
    setError('');
    setWizardStep(3);
  };

  const handleAddLg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStateId || !newName || !newCode) {
      setError('Please fill in all required fields.');
      return;
    }

    // If banking details are partially entered, validate completeness
    if (newBankCode || newAccountNumber) {
      if (!newBankCode) {
        setError('Please select a bank name for settlement setup.');
        return;
      }
      if (!newAccountNumber || newAccountNumber.length < 10) {
        setError('Please enter a valid 10-digit bank account number.');
        return;
      }
      if (!accountVerified && !allowManualInput) {
        setError('Please verify the bank account details before onboarding.');
        return;
      }
      if (allowManualInput && !newAccountName.trim()) {
        setError('Please enter the bank account name manually.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/super-admin/lgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          state_id: selectedStateId, 
          name: newName, 
          code: newCode,
          jurisdiction: newJurisdiction,
          address: newAddress,
          phone: newPhone,
          email: newEmail,
          logo_url: newLogoUrl,
          bank_name: newBankCode || null,
          bank_account_number: newAccountNumber || null,
          bank_account_name: newAccountName || null,
          khrien_split_percentage: newBankCode ? parseFloat(newSplitPct) : null
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setLgs([...lgs, data.lg].sort((a, b) => a.state_name.localeCompare(b.state_name) || a.name.localeCompare(b.name)));
        setSuccess(`Local Government "${newName}" onboarded successfully!`);
        setNewName('');
        setNewCode('');
        setNewJurisdiction('');
        setNewAddress('');
        setNewPhone('');
        setNewEmail('');
        setNewLogoUrl('');
        setLogoPreview('');
        setSelectedStateId('');
        // Reset Step 3 variables
        setWizardStep(1);
        setNewBankCode('');
        setNewBankName('');
        setNewAccountNumber('');
        setNewAccountName('');
        setAccountVerified(false);
        setAllowManualInput(false);
        setNewSplitPct('5.00');
        setShowAddPanel(false);
      } else {
        setError(data.error || 'Failed to onboard Local Government');
      }
    } catch (err) {
      setError('Network error creating Local Government');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAccountNumber = async () => {
    if (!newAccountNumber || newAccountNumber.length < 10 || !newBankCode) return;
    setVerifyingAccount(true);
    setNewAccountName('');
    setAccountVerified(false);
    setAllowManualInput(false);
    setError('');
    try {
      const res = await fetch('/api/super-admin/lgs/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: newAccountNumber, account_bank: newBankCode })
      });
      const data = await res.json();
      if (res.ok && data.account_name) {
        setNewAccountName(data.account_name);
        setAccountVerified(true);
      } else {
        setError(data.error || 'Could not verify account number');
        setAllowManualInput(true);
      }
    } catch (err) {
      setError('Network error verifying account');
      setAllowManualInput(true);
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/super-admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setNewLogoUrl(data.url);
      } else {
        setError(data.error || 'Failed to upload logo');
        setLogoPreview('');
      }
    } catch (err) {
      setError('Network error uploading logo');
      setLogoPreview('');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setNewLogoUrl('');
    setLogoPreview('');
  };

  const filteredLgs = lgs.filter(lg => {
    const matchesSearch = 
      lg.name.toLowerCase().includes(search.toLowerCase()) ||
      lg.code.toLowerCase().includes(search.toLowerCase()) ||
      lg.state_name.toLowerCase().includes(search.toLowerCase());
    
    const matchesState = stateFilter === 'all' || lg.state_id === stateFilter;

    return matchesSearch && matchesState;
  });

  const isModalActive = showAddPanel;

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Local Government Tenants</h1>
          <p className="text-sm text-slate-505">Onboard and manage tenant local government administrations.</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setSuccess('');
            setLogoPreview('');
            setNewLogoUrl('');
            setNewName('');
            setNewCode('');
            setNewJurisdiction('');
            setNewAddress('');
            setNewPhone('');
            setNewEmail('');
            setSelectedStateId('');
            setWizardStep(1);
            setNewBankCode('');
            setNewBankName('');
            setNewAccountNumber('');
            setNewAccountName('');
            setAccountVerified(false);
            setAllowManualInput(false);
            setNewSplitPct('5.00');
            setShowAddPanel(true);
          }}
          disabled={states.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Onboard Local Govt</span>
        </button>
      </div>

      {/* Notifications */}
      {error && !isModalActive && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm rounded-xl p-4 flex items-center gap-2 animate-fade-in">
          <Check className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Floating Toast Notification for modal errors */}
      <Toast message={isModalActive ? error : ''} type="error" onClose={() => setError('')} />

      {/* Main Card Wrapper */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 space-y-6 shadow-sm">

        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search local governments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-150 text-sm"
            />
          </div>

          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter className="h-4 w-4" />
            </div>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-750 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-150 text-sm appearance-none cursor-pointer"
            >
              <option value="all">All States</option>
              {states.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Local Governments Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                <th className="py-4 px-6">Local Govt Name</th>
                <th className="py-4 px-6">LG Code</th>
                <th className="py-4 px-6">Parent State</th>
                <th className="py-4 px-6">Onboarded Date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-650">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-amber-600" />
                    <span>Loading local governments...</span>
                  </td>
                </tr>
              ) : filteredLgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No local governments found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLgs.map((lg) => (
                  <tr key={lg.id} className="hover:bg-slate-55/40 transition-colors duration-150">
                    <td 
                      onClick={() => router.push(`/super-admin/lgs/${lg.id}`)}
                      className="py-4 px-6 font-bold text-slate-800 flex items-center gap-3 cursor-pointer group"
                    >
                      {lg.logo_url ? (
                        <img 
                          src={lg.logo_url} 
                          alt={`${lg.name} Logo`} 
                          className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm shrink-0 bg-white"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center font-extrabold text-xs shadow-sm uppercase shrink-0">
                          {lg.code.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <span className="group-hover:text-amber-700 group-hover:underline transition-colors">{lg.name}</span>
                        {lg.payment_setup_status === 'payment_setup_incomplete' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-100 text-[10px] font-bold text-red-655 shrink-0 animate-pulse">
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                            <span>Setup Incomplete</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">
                        {lg.code}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-650">{lg.state_name}</td>
                    <td className="py-4 px-6 text-slate-550">
                      {new Date(lg.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        lg.is_active 
                          ? 'bg-amber-50 border-amber-100 text-amber-700' 
                          : 'bg-red-55/60 border-red-100 text-red-755'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${lg.is_active ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        <span>{lg.is_active ? 'Active' : 'Deactivated'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => router.push(`/super-admin/lgs/${lg.id}`)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Onboarding Drawer */}
      <SlideOver
        isOpen={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        title="Onboard Local Govt"
        icon={<Building2 className="h-5 w-5 text-amber-600" />}
        footer={
          <>
            {wizardStep === 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer"
                >
                  Next Step
                </button>
              </>
            )}
            {wizardStep === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer"
                >
                  Next Step
                </button>
              </>
            )}
            {wizardStep === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="add-lg-form"
                  disabled={submitting || uploadingLogo}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Onboarding...</span>
                    </>
                  ) : (
                    <span>Onboard Local Govt</span>
                  )}
                </button>
              </>
            )}
          </>
        }
      >
        {/* Steps indicator */}
        <div className="mb-6 bg-slate-55/60 p-4 border border-slate-200/50 rounded-2xl flex items-center justify-between text-center">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 1 ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20' : 'bg-slate-200 text-slate-500'
            }`}>
              1
            </div>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${wizardStep >= 1 ? 'text-amber-700' : 'text-slate-400'}`}>Identity</span>
          </div>
          <div className={`h-0.5 flex-1 transition-all ${wizardStep >= 2 ? 'bg-amber-600' : 'bg-slate-200'}`}></div>
          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 2 ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20' : 'bg-slate-200 text-slate-500'
            }`}>
              2
            </div>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${wizardStep >= 2 ? 'text-amber-700' : 'text-slate-400'}`}>Contact</span>
          </div>
          <div className={`h-0.5 flex-1 transition-all ${wizardStep >= 3 ? 'bg-amber-600' : 'bg-slate-200'}`}></div>
          {/* Step 3 */}
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 3 ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20' : 'bg-slate-200 text-slate-500'
            }`}>
              3
            </div>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${wizardStep >= 3 ? 'text-amber-700' : 'text-slate-400'}`}>Banking</span>
          </div>
        </div>

        <form onSubmit={handleAddLg} id="add-lg-form" className="space-y-5">
          {wizardStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label htmlFor="lg-state" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Parent State <span className="text-red-500">*</span>
                </label>
                <select
                  id="lg-state"
                  required
                  value={selectedStateId}
                  onChange={(e) => setSelectedStateId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
                >
                  <option value="">Select a State</option>
                  {states.filter(s => s.is_active).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lg-name" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                    LG Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lg-name"
                    type="text"
                    required
                    placeholder="e.g. Ibadan North"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="lg-code" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                    LG Code Prefix <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lg-code"
                    type="text"
                    required
                    placeholder="e.g. ibn"
                    maxLength={10}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lg-jurisdiction" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Jurisdiction (Scope/Areas Covered)
                </label>
                <input
                  id="lg-jurisdiction"
                  type="text"
                  placeholder="e.g. Ward 1 - 12, Metropolitan Area"
                  value={newJurisdiction}
                  onChange={(e) => setNewJurisdiction(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  LGA Logo Image
                </label>
                
                {logoPreview ? (
                  <div className="relative rounded-2xl border border-slate-200 p-4 bg-slate-55 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={logoPreview} 
                        alt="LGA Logo Preview" 
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200/50 bg-white shadow-sm shrink-0"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Uploaded Logo</span>
                        {uploadingLogo ? (
                          <span className="text-[10px] text-amber-600 font-bold animate-pulse block">Uploading...</span>
                        ) : (
                          <span className="text-[10px] text-emerald-655 font-bold block">Ready</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLogo()}
                      disabled={uploadingLogo}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 text-red-655 hover:text-red-750 text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="relative group rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-500/50 p-6 bg-slate-55/50 hover:bg-amber-50/10 flex flex-col items-center justify-center text-center gap-2 transition-all duration-200">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Upload LGA logo</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Drag & drop or click to choose file</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label htmlFor="lg-address" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Address Location
                </label>
                <input
                  id="lg-address"
                  type="text"
                  placeholder="e.g. Secretariat Road, Ibadan"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lg-phone" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                    Official Phone
                  </label>
                  <input
                    id="lg-phone"
                    type="tel"
                    placeholder="e.g. +234 803 000 0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="lg-email" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                    Official Email
                  </label>
                  <input
                    id="lg-email"
                    type="email"
                    placeholder="e.g. contact@ibadannorth.gov.ng"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-xs text-amber-805">
                <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-extrabold block">Settlement Configuration</span>
                  <span className="text-[10px] leading-relaxed mt-0.5 block">
                    Input the local government's official banking details to automatically configure revenue routing via Flutterwave. You can skip this and configure banking later.
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="lg-bank-code" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Bank Name
                </label>
                <select
                  id="lg-bank-code"
                  value={newBankCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewBankCode(val);
                    const name = NIGERIAN_BANKS.find(b => b.code === val)?.name || '';
                    setNewBankName(name);
                    setNewAccountName('');
                    setAccountVerified(false);
                  }}
                  className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm cursor-pointer"
                >
                  <option value="">Select Bank (Optional)</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="lg-account-number" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Account Number
                </label>
                <div className="relative">
                  <input
                    id="lg-account-number"
                    type="text"
                    placeholder="e.g. 0123456789"
                    maxLength={10}
                    value={newAccountNumber}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setNewAccountNumber(num);
                      setNewAccountName('');
                      setAccountVerified(false);
                    }}
                    onBlur={verifyAccountNumber}
                    className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                  />
                  {verifyingAccount && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400 gap-1.5 text-xs font-semibold bg-slate-50 pl-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                      <span>Verifying...</span>
                    </div>
                  )}
                  {!verifyingAccount && accountVerified && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-emerald-600 gap-1 text-xs font-extrabold bg-slate-50 pl-2">
                      <Check className="h-4 w-4" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="lg-account-name" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Account Name
                </label>
                <input
                  id="lg-account-name"
                  type="text"
                  readOnly={!allowManualInput}
                  placeholder={allowManualInput ? "Enter account name manually" : "Auto-resolved account name"}
                  value={newAccountName}
                  onChange={allowManualInput ? (e) => setNewAccountName(e.target.value) : undefined}
                  className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-bold focus:outline-none text-sm ${
                    allowManualInput 
                      ? 'bg-slate-55 text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600' 
                      : 'bg-slate-100 text-slate-700 cursor-not-allowed'
                  }`}
                />
                {allowManualInput && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    ⚠️ Verification service is unavailable. Please input the account name manually.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="lg-split-pct" className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-2">
                  Khrien Split %
                </label>
                <input
                  id="lg-split-pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 5.00"
                  value={newSplitPct}
                  onChange={(e) => setNewSplitPct(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-55 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:bg-white transition-all duration-200 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">Platform fee split percentage per transaction. Defaults to 5.00% if not specified.</p>
              </div>
            </div>
          )}
        </form>
      </SlideOver>
    </div>
  );
}
