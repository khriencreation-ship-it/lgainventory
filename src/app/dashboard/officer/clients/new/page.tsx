'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  UserPlus, 
  ArrowLeft, 
  Loader2, 
  Check, 
  User, 
  Phone, 
  Mail, 
  MapPin 
} from 'lucide-react';
import Toast from '@/components/Toast';

export default function NewClientPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [ward, setWard] = useState('');
  const [address, setAddress] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError('');

    // Client-side validations
    if (!fullName.trim()) {
      setError('Please provide the client full name or business name.');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('Please provide a working contact phone number.');
      return;
    }
    if (!address.trim()) {
      setError('Please provide a physical address.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/officer/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone_number: phoneNumber,
          email_address: emailAddress || null,
          address: address,
          ward: ward || null
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create client portfolio');
      }

      setToastType('success');
      setToastMessage('Client registered successfully!');
      
      // Short delay for the toast to be seen before redirecting
      setTimeout(() => {
        router.push(`/dashboard/officer/clients/${data.client.id}`);
        router.refresh();
      }, 800);

    } catch (err: any) {
      setError(err.message || 'Failed to create client. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Header back button */}
      <div>
        <Link 
          href="/dashboard/officer/clients" 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Clients Directory</span>
        </Link>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Register New Client</h2>
        <p className="text-xs text-slate-400 font-medium">Create a client portfolio to generate demand bills and track payments.</p>
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/60 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Client Details Form</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Please fill out all the required fields below.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-xs rounded-xl p-4 mb-6 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-2">
              Full Name / Business Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Kolawole Davies or Davies Ventures"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="h-4.5 w-4.5" />
              </div>
              <input
                id="phoneNumber"
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label htmlFor="emailAddress" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Email Address <span className="text-slate-400 font-medium lowercase">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <input
                id="emailAddress"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="e.g. client@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Ward */}
          <div>
            <label htmlFor="ward" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Ward <span className="text-slate-400 font-medium lowercase">(optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <input
                id="ward"
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="e.g. Ward 5"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-[10px] font-black text-slate-455 uppercase tracking-wider mb-2">
              Physical Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 pt-3 flex items-start pointer-events-none text-slate-400">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <textarea
                id="address"
                required
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 14, Ring Road, Ibadan, Oyo State"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-455 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all text-sm resize-none"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-450 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 hover:shadow-amber-500/25 focus:outline-none flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Registering client...</span>
              </>
            ) : (
              <>
                <Check className="h-4.5 w-4.5" />
                <span>Create Client</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
