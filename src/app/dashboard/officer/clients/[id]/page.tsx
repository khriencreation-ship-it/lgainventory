'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Edit3, 
  FileText, 
  Receipt,
  Plus, 
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  FileCheck
} from 'lucide-react';
import SlideOver from '@/components/SlideOver';
import Toast from '@/components/Toast';

interface ClientRecord {
  id: string;
  reference_number: string;
  full_name: string;
  phone_number: string;
  email_address?: string | null;
  address: string;
  ward?: string | null;
  created_at: string;
}

interface DemandBillRecord {
  id: string;
  bill_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'paid' | 'unpaid' | 'overdue' | 'partially_paid';
  created_at: string;
  due_date: string;
  generated_by_name: string;
  levy_items: any;
}

interface ReceiptRecord {
  receipt_id: string;
  receipt_number: string;
  amount_paid: number;
  date_paid: string;
  generated_by_name: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [demandBills, setDemandBills] = useState<DemandBillRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Form State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWard, setEditWard] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Fetch client details
  const fetchClientDetails = async () => {
    try {
      const res = await fetch(`/api/officer/clients/${clientId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve client details');
      }

      setClient(data.client);
      setDemandBills(data.demandBills || []);
      setReceipts(data.receipts || []);
      
      // Initialize edit fields
      if (data.client) {
        setEditName(data.client.full_name);
        setEditPhone(data.client.phone_number);
        setEditEmail(data.client.email_address || '');
        setEditWard(data.client.ward || '');
        setEditAddress(data.client.address);
      }
    } catch (err: any) {
      setToastType('error');
      setToastMessage(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClientDetails();
    }
  }, [clientId]);

  // Handle Edit submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editName.trim()) {
      setEditError('Please enter full name or business name.');
      return;
    }
    if (!editPhone.trim()) {
      setEditError('Please enter phone number.');
      return;
    }
    if (!editAddress.trim()) {
      setEditError('Please enter address.');
      return;
    }

    setEditLoading(true);

    try {
      const res = await fetch(`/api/officer/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editName,
          phone_number: editPhone,
          email_address: editEmail || null,
          address: editAddress,
          ward: editWard || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update client profile');
      }

      setClient(data.client);
      setToastType('success');
      setToastMessage('Client profile updated successfully!');
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update client.');
    } finally {
      setEditLoading(false);
    }
  };

  // Currency formatter
  const formatNaira = (amount: number) => {
    return '₦' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
        <span className="text-xs uppercase font-semibold tracking-wider">Loading client record...</span>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200/60 shadow-sm text-center">
        <h3 className="text-lg font-bold text-slate-800">Client Not Found</h3>
        <p className="text-xs text-slate-400 mt-2">The requested client record does not exist or you do not have permission to view it.</p>
        <Link 
          href="/dashboard/officer/clients"
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Directory</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard/officer/clients" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Clients Directory</span>
        </Link>
      </div>

      {/* Client Info Card */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-0.5 uppercase tracking-wider">
              {client.reference_number}
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight pt-1">{client.full_name}</h1>
          </div>
          
          <button
            onClick={() => setIsEditOpen(true)}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          {/* Phone */}
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Phone Number</span>
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{client.phone_number}</span>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Email Address</span>
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="truncate">{client.email_address || 'Not Provided'}</span>
            </div>
          </div>

          {/* Date Added */}
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Date Registered</span>
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>
                {new Date(client.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Ward */}
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ward</span>
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>{client.ward || 'Not Provided'}</span>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1 md:col-span-2 lg:col-span-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Address</span>
            <div className="flex items-start gap-2 text-slate-700 font-semibold">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2" title={client.address}>{client.address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demand Bills Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-550" />
            <h2 className="text-base font-bold text-slate-850">Demand Bills</h2>
          </div>
          <Link
            href={`/dashboard/officer/demand-bills/new?clientId=${client.id}`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Generate Demand Bill</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-450 uppercase tracking-wider">
                  <th className="py-4 px-6">Bill Reference</th>
                  <th className="py-4 px-6">Billed</th>
                  <th className="py-4 px-6">Paid</th>
                  <th className="py-4 px-6">Balance Due</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
                {demandBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold text-xs">
                      No demand bills have been generated for this client yet.
                    </td>
                  </tr>
                ) : (
                  demandBills.map((bill) => {
                    let statusBadgeClass = "";
                    let statusText: string = bill.status;

                    if (bill.status === 'paid') {
                      statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      statusText = "Paid";
                    } else if (bill.status === 'partially_paid') {
                      statusBadgeClass = "bg-indigo-50 text-indigo-700 border-indigo-100";
                      statusText = "Partially Paid";
                    } else if (bill.status === 'unpaid') {
                      statusBadgeClass = "bg-red-50 text-red-700 border-red-100";
                      statusText = "Not Paid";
                    } else {
                      statusBadgeClass = "bg-amber-50 text-amber-700 border-amber-100";
                      statusText = "Overdue";
                    }

                    return (
                      <tr key={bill.id} className="hover:bg-slate-50/30 transition-colors duration-150">
                        <td className="py-4 px-6 font-bold text-slate-850">
                          {bill.bill_number}
                        </td>
                        <td className="py-4 px-6 font-extrabold text-slate-900">
                          {formatNaira(bill.total_amount)}
                        </td>
                        <td className="py-4 px-6 font-semibold text-emerald-700">
                          {formatNaira(bill.amount_paid)}
                        </td>
                        <td className="py-4 px-6 font-bold text-indigo-700">
                          {formatNaira(bill.balance_due)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${statusBadgeClass}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-505 font-medium text-xs">
                          {new Date(bill.due_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Link
                            href={`/dashboard/officer/demand-bills/${bill.id}`}
                            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-750 text-xs font-bold rounded-xl transition-colors inline-block cursor-pointer"
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

      {/* Receipts Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-slate-550" />
          <h2 className="text-base font-bold text-slate-850">Receipts</h2>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-455 uppercase tracking-wider">
                  <th className="py-4 px-6">Receipt Ref No</th>
                  <th className="py-4 px-6">Amount Paid</th>
                  <th className="py-4 px-6">Date Paid</th>
                  <th className="py-4 px-6">Generated By</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-655">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold text-xs">
                      No receipts yet.
                    </td>
                  </tr>
                ) : (
                  receipts.map((receipt) => (
                    <tr key={receipt.receipt_id} className="hover:bg-slate-50/30 transition-colors duration-150">
                      <td className="py-4 px-6 font-bold text-slate-850 flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{receipt.receipt_number}</span>
                      </td>
                      <td className="py-4 px-6 font-extrabold text-slate-900">
                        {formatNaira(receipt.amount_paid)}
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs font-medium">
                        {new Date(receipt.date_paid).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-semibold">
                        {receipt.generated_by_name}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/dashboard/officer/receipts/${receipt.receipt_id}`}
                          className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors inline-block cursor-pointer"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SlideOver Panel to Edit Client */}
      <SlideOver
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Client Profile"
        icon={<Edit3 className="h-5 w-5 text-amber-600" />}
      >
        {editError && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-xs font-semibold rounded-xl p-4 mb-5">
            {editError}
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="editName" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Full Name / Business Name <span className="text-red-500">*</span>
            </label>
            <input
              id="editName"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="editPhone" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              id="editPhone"
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="editEmail" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Email Address <span className="text-slate-400 font-medium lowercase">(optional)</span>
            </label>
            <input
              id="editEmail"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Ward */}
          <div>
            <label htmlFor="editWard" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Ward <span className="text-slate-400 font-medium lowercase">(optional)</span>
            </label>
            <input
              id="editWard"
              type="text"
              value={editWard}
              onChange={(e) => setEditWard(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="editAddress" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Physical Address <span className="text-red-500">*</span>
            </label>
            <textarea
              id="editAddress"
              required
              rows={3}
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-450 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {editLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
