'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Trash2, 
  Search, 
  Calendar, 
  TrendingUp, 
  FileCheck,
  Building2,
  DollarSign
} from 'lucide-react';
import Toast from '@/components/Toast';

interface ClientRecord {
  id: string;
  reference_number: string;
  full_name: string;
  phone_number: string;
}

interface LevyItemInput {
  category_id: string;
  category_name: string;
  levy_id: string;
  levy_name: string;
  description: string;
  amount: string;
  leviesList?: { id: string; name: string }[];
  loadingLevies?: boolean;
}

// Client-side translation of numbers to words
function getAmountInWords(amount: number): string {
  const integerPart = Math.floor(amount);
  
  if (integerPart === 0) {
    return "Zero Naira Only";
  }

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", 
                 "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];

  function convertLessThanThousand(num: number): string {
    let str = "";
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      str += ones[num] + " ";
    }
    return str.trim();
  }

  let num = integerPart;
  let words = "";
  let scaleIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkStr = convertLessThanThousand(chunk);
      words = chunkStr + (scales[scaleIndex] ? " " + scales[scaleIndex] : "") + " " + words;
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return words.trim().replace(/\s+/g, ' ') + " Naira Only";
}

function NewDemandBillForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [clientSearchText, setClientSearchText] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<ClientRecord[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [isClientLocked, setIsClientLocked] = useState(false);

  // Form states
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [levyItems, setLevyItems] = useState<LevyItemInput[]>([
    { category_id: '', category_name: '', levy_id: '', levy_name: '', description: '', amount: '', leviesList: [], loadingLevies: false }
  ]);
  const [arrears, setArrears] = useState('0');
  const [penalty, setPenalty] = useState('0');
  const [dueDate, setDueDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Load categories on mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/levy-categories');
        const data = await res.json();
        if (res.ok && data.categories) {
          setCategories(data.categories);
        } else {
          setError(data.error || 'Failed to load levy categories');
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
        setError('Network error loading levy categories');
      }
    }
    fetchCategories();
  }, []);

  // Load preselected client if any
  useEffect(() => {
    if (preselectedClientId) {
      async function loadClient() {
        setSearchingClients(true);
        try {
          const res = await fetch(`/api/officer/clients/${preselectedClientId}`);
          const data = await res.json();
          if (res.ok && data.client) {
            setSelectedClient(data.client);
            setIsClientLocked(true);
            setClientSearchText(data.client.full_name);
          }
        } catch (err) {
          console.error('Failed to load preselected client:', err);
        } finally {
          setSearchingClients(false);
        }
      }
      loadClient();
    }
  }, [preselectedClientId]);

  // Client search handler
  useEffect(() => {
    if (isClientLocked || clientSearchText.trim() === '' || (selectedClient && clientSearchText === selectedClient.full_name)) {
      setClientSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const res = await fetch(`/api/officer/clients?search=${encodeURIComponent(clientSearchText)}`);
        const data = await res.json();
        if (res.ok) {
          setClientSearchResults(data.clients || []);
        }
      } catch (err) {
        console.error('Client search API error:', err);
      } finally {
        setSearchingClients(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchText, isClientLocked, selectedClient]);

  // Totals calculations
  const subtotal = levyItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const parsedArrears = parseFloat(arrears) || 0;
  const parsedPenalty = parseFloat(penalty) || 0;
  const grandTotal = subtotal + parsedArrears + parsedPenalty;
  const amountInWords = getAmountInWords(grandTotal);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedClient) {
      setError('Please search and select a client first.');
      return;
    }

    const invalidLevy = levyItems.some(item => !item.category_id || !item.levy_id || !item.amount || parseFloat(item.amount) <= 0);
    if (invalidLevy) {
      setError('Please ensure all levy items have a selected category, levy item, and a valid positive amount.');
      return;
    }

    if (!dueDate) {
      setError('Please specify the bill payment due date.');
      return;
    }

    const dueDateObj = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDateObj < today) {
      setError('The due date must be today or in the future.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/officer/demand-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          levy_items: levyItems.map(item => ({
            category_id: item.category_id,
            category_name: item.category_name,
            levy_id: item.levy_id,
            levy_name: item.levy_name,
            description: item.description,
            amount: parseFloat(item.amount)
          })),
          arrears: parsedArrears,
          penalty: parsedPenalty,
          due_date: dueDate
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create demand bill');
      }

      setToastType('success');
      setToastMessage('Demand bill generated successfully!');
      
      setTimeout(() => {
        router.push(`/dashboard/officer/demand-bills/${data.billId}`);
        router.refresh();
      }, 800);

    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleAddLevyItem = () => {
    setLevyItems([...levyItems, {
      category_id: '',
      category_name: '',
      levy_id: '',
      levy_name: '',
      description: '',
      amount: '',
      leviesList: [],
      loadingLevies: false
    }]);
  };

  const handleRemoveLevyItem = (index: number) => {
    if (levyItems.length > 1) {
      const updated = levyItems.filter((_, i) => i !== index);
      setLevyItems(updated);
    }
  };

  const handleCategoryChange = async (index: number, categoryId: string) => {
    const updated = [...levyItems];
    const category = categories.find(c => c.id === categoryId);
    
    updated[index] = {
      ...updated[index],
      category_id: categoryId,
      category_name: category ? category.name : '',
      levy_id: '',
      levy_name: '',
      description: '',
      leviesList: [],
      loadingLevies: categoryId ? true : false
    };
    
    setLevyItems(updated);

    if (!categoryId) return;

    try {
      const res = await fetch(`/api/levy-items?categoryId=${categoryId}`);
      const data = await res.json();
      if (res.ok && data.items) {
        setLevyItems(prev => {
          const next = [...prev];
          if (next[index] && next[index].category_id === categoryId) {
            next[index].leviesList = data.items;
            next[index].loadingLevies = false;
          }
          return next;
        });
      } else {
        setToastType('error');
        setToastMessage(data.error || 'Failed to load levies for category');
        setLevyItems(prev => {
          const next = [...prev];
          if (next[index]) next[index].loadingLevies = false;
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load levies:', err);
      setToastType('error');
      setToastMessage('Network error loading levies');
      setLevyItems(prev => {
        const next = [...prev];
        if (next[index]) next[index].loadingLevies = false;
        return next;
      });
    }
  };

  const handleLevySelect = (index: number, levyId: string) => {
    const updated = [...levyItems];
    const row = updated[index];
    const levy = row.leviesList?.find(l => l.id === levyId);
    
    row.levy_id = levyId;
    row.levy_name = levy ? levy.name : '';
    row.description = levy ? levy.name : '';
    
    setLevyItems(updated);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const updated = [...levyItems];
    updated[index].description = value;
    setLevyItems(updated);
  };

  const handleAmountChange = (index: number, value: string) => {
    const updated = [...levyItems];
    updated[index].amount = value;
    setLevyItems(updated);
  };

  const selectClient = (client: ClientRecord) => {
    setSelectedClient(client);
    setClientSearchText(client.full_name);
    setClientSearchResults([]);
  };

  const clearSelectedClient = () => {
    if (isClientLocked) return; // locked if from query param
    setSelectedClient(null);
    setClientSearchText('');
  };

  // Currency formatter
  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Top Header back button */}
      <div>
        <Link 
          href="/dashboard/officer/demand-bills" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Invoices</span>
        </Link>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Generate Demand Bill</h2>
        <p className="text-xs text-slate-400 font-medium">Raise a fresh demand notice, combine multiple Oyo State official levy codes, and calculate splits.</p>
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/60 shadow-sm space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-xs font-semibold rounded-xl p-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Search Section */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Step 1: Client Ratepayer Selection</span>
            </h3>
            
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                Search Client Name or Reference Number <span className="text-red-500">*</span>
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  disabled={isClientLocked}
                  value={clientSearchText}
                  onChange={(e) => setClientSearchText(e.target.value)}
                  placeholder="e.g. Kolawole Davies or IBN-CLT-0001"
                  className="w-full pl-10 pr-20 py-2.5 bg-white border border-slate-250 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm disabled:bg-slate-100/70 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
                
                {selectedClient && !isClientLocked && (
                  <button
                    type="button"
                    onClick={clearSelectedClient}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-bold text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-lg cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Client dropdown results */}
              {clientSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-slate-50">
                  {clientSearchResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => selectClient(client)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-800 transition"
                    >
                      <span>{client.full_name}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{client.reference_number}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchingClients && (
                <div className="absolute right-12 top-10 flex items-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="text-[10px] bg-white border border-slate-200/50 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-bold block">Selected Ratepayer:</span>
                  <span className="text-slate-800 font-black text-xs block mt-0.5">{selectedClient.full_name}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-150 text-amber-850 font-black rounded-lg">
                  {selectedClient.reference_number}
                </span>
              </div>
            )}
          </div>

          {/* Levy Items Builder Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-450 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Step 2: Levy Line Items</span>
              </h3>
              
              <button
                type="button"
                onClick={handleAddLevyItem}
                className="px-3.5 py-1.5 border border-amber-200 hover:border-amber-400 text-amber-750 hover:bg-amber-50/20 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {levyItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 p-4 border border-slate-100 bg-slate-50/30 rounded-2xl relative">
                  {/* Category Dropdown */}
                  <div className="md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={item.category_id}
                      onChange={(e) => handleCategoryChange(index, e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-amber-500 text-xs font-bold"
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Levy Dropdown */}
                  <div className="md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
                      <span>Levy Item <span className="text-red-500">*</span></span>
                      {item.loadingLevies && <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-600" />}
                    </label>
                    <select
                      value={item.levy_id}
                      onChange={(e) => handleLevySelect(index, e.target.value)}
                      required
                      disabled={!item.category_id || item.loadingLevies}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-amber-500 text-xs font-bold disabled:bg-slate-100/50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!item.category_id ? '-- Choose Category First --' : '-- Choose Levy --'}
                      </option>
                      {item.leviesList?.map((levy) => (
                        <option key={levy.id} value={levy.id}>
                          {levy.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Input */}
                  <div className="md:col-span-3">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1.5">
                      Bill Line Description
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleDescriptionChange(index, e.target.value)}
                      placeholder="Line item notes (pre-filled)"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>

                  {/* Amount Input */}
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide mb-1.5">
                      Amount (₦) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={item.amount}
                      onChange={(e) => handleAmountChange(index, e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 text-xs font-bold"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="md:col-span-1 flex items-end justify-center pb-1">
                    <button
                      type="button"
                      disabled={levyItems.length <= 1}
                      onClick={() => handleRemoveLevyItem(index)}
                      className="p-2 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-200 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Section */}
          <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-4">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Step 3: Billing Adjustments & Summary</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Subtotal Display */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Subtotal</span>
                <span className="text-sm font-black text-slate-800 block bg-slate-100/60 px-3 py-2 rounded-xl border border-slate-200/50">
                  {formatNaira(subtotal)}
                </span>
              </div>

              {/* Arrears Input */}
              <div className="space-y-1">
                <label htmlFor="arrears" className="block text-[10px] font-bold text-slate-450 uppercase tracking-wide">
                  Outstanding Arrears (₦)
                </label>
                <input
                  id="arrears"
                  type="number"
                  step="0.01"
                  value={arrears}
                  onChange={(e) => setArrears(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-amber-500 text-xs font-bold"
                />
              </div>

              {/* Penalty Input */}
              <div className="space-y-1">
                <label htmlFor="penalty" className="block text-[10px] font-bold text-slate-450 uppercase tracking-wide">
                  Late Penalty Fees (₦)
                </label>
                <input
                  id="penalty"
                  type="number"
                  step="0.01"
                  value={penalty}
                  onChange={(e) => setPenalty(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-amber-500 text-xs font-bold"
                />
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-450 block uppercase tracking-wide">Grand Total Due</span>
                <span className="text-2xl font-black text-amber-800 block mt-0.5">{formatNaira(grandTotal)}</span>
              </div>
              <div className="text-right max-w-sm">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">Amount in words</span>
                <p className="text-xs font-bold text-slate-655 italic mt-1 leading-snug">{amountInWords}</p>
              </div>
            </div>
          </div>

          {/* Due Date picker */}
          <div className="space-y-2 max-w-xs">
            <label htmlFor="dueDate" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider">
              Payment Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450">
                <Calendar className="h-4 w-4" />
              </div>
              <input
                id="dueDate"
                type="date"
                required
                value={dueDate}
                min={new Date().toISOString().split('T')[0]} // enforce today or later in UI
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-xs font-bold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-450 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 hover:shadow-amber-500/25 focus:outline-none flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Generating Demand Bill Notice...</span>
              </>
            ) : (
              <>
                <FileCheck className="h-4.5 w-4.5" />
                <span>Generate Demand Bill</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewDemandBillPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[300px] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <span className="text-xs uppercase font-semibold tracking-wider">Preparing Invoice Constructor...</span>
      </div>
    }>
      <NewDemandBillForm />
    </Suspense>
  );
}
