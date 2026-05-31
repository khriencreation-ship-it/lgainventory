'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  User,
  ArrowLeft,
  Loader2,
  Save,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Upload,
  Trash2,
  PenLine,
  ShieldCheck,
} from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone_number: string | null;
  signature_url: string | null;
  lg_name: string | null;
}

export default function ChairmanProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal Info Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoError, setInfoError] = useState('');

  // Signature State
  const [sigUploading, setSigUploading] = useState(false);
  const [sigDeleting, setSigDeleting] = useState(false);
  const [sigSuccess, setSigSuccess] = useState('');
  const [sigError, setSigError] = useState('');
  const [sigDragging, setSigDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/officer/profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile(data.user);
      setPhoneNumber(data.user.phone_number || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSaving(true);
    setInfoSuccess('');
    setInfoError('');

    try {
      const res = await fetch('/api/officer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_phone', phone_number: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone number');
      setInfoSuccess('Phone number updated successfully.');
      if (profile) setProfile({ ...profile, phone_number: phoneNumber });
    } catch (err: any) {
      setInfoError(err.message);
    } finally {
      setInfoSaving(false);
    }
  };

  const uploadSignature = async (file: File) => {
    setSigUploading(true);
    setSigSuccess('');
    setSigError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/officer/profile/signature', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSigSuccess('Signature uploaded successfully.');
      if (profile) setProfile({ ...profile, signature_url: data.url });
    } catch (err: any) {
      setSigError(err.message);
    } finally {
      setSigUploading(false);
    }
  };

  const handleSigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadSignature(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSigDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadSignature(file);
  };

  const handleDeleteSignature = async () => {
    if (!confirm('Remove your signature image? This cannot be undone.')) return;
    setSigDeleting(true);
    setSigSuccess('');
    setSigError('');
    try {
      const res = await fetch('/api/officer/profile/signature', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete signature');
      setSigSuccess('Signature removed successfully.');
      if (profile) setProfile({ ...profile, signature_url: null });
    } catch (err: any) {
      setSigError(err.message);
    } finally {
      setSigDeleting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSaving(true);
    setPassSuccess('');
    setPassError('');

    if (newPassword.length < 8) {
      setPassError('Password must be at least 8 characters');
      setPassSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match');
      setPassSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/officer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setPassSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message);
    } finally {
      setPassSaving(false);
    }
  };

  const getRoleName = (role: string) => {
    if (role === 'lg_chairman' || role === 'lg_admin') return 'LG Chairman';
    return role;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Loading profile data...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm max-w-xl mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-450 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">{error || 'Failed to load profile'}</h3>
        <button onClick={fetchProfile} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition">
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/chairman"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Profile &amp; Signature</h2>
        <p className="text-xs text-slate-450 font-medium mt-0.5">Manage your chairman details, official signature, and password settings.</p>
      </div>

      {/* Read-only notice */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
        <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-indigo-800">Chairman Account — Restricted Access</p>
          <p className="text-[10px] text-indigo-600 mt-0.5 leading-relaxed">
            As the LG Chairman, your account is read-only for most fields. You may update your phone number, official signature, and password.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* Section 1 — Personal Information */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-550" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Personal Information</h3>
          </div>

          <form onSubmit={handleSavePersonalInfo} className="p-6 space-y-6">
            {infoSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{infoSuccess}</span>
              </div>
            )}
            {infoError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{infoError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Full Name</label>
                <input type="text" value={profile.name} disabled className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed" />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Email Address</label>
                <input type="email" value={profile.email} disabled className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed" />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Role</label>
                <input type="text" value={getRoleName(profile.role)} disabled className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed" />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Local Government</label>
                <input type="text" value={profile.lg_name || 'Not Assigned'} disabled className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed" />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="phone_number" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">Phone Number</label>
                <input
                  id="phone_number"
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +234 803 123 4567"
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={infoSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {infoSaving ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Saving...</span></> : <><Save className="h-4 w-4" /><span>Save Changes</span></>}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2 — Official Signature */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-slate-550" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Official Signature</h3>
          </div>

          <div className="p-6 space-y-5">
            {sigSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" /><span>{sigSuccess}</span>
              </div>
            )}
            {sigError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{sigError}</span>
              </div>
            )}

            {profile.signature_url ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3">Current Signature</p>
                  <img
                    src={profile.signature_url}
                    alt="Official Signature"
                    className="max-h-24 object-contain border border-slate-200 rounded-xl bg-white p-2"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sigUploading}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Replace Signature</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSignature}
                    disabled={sigDeleting}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {sigDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors duration-200 ${
                  sigDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setSigDragging(true); }}
                onDragLeave={() => setSigDragging(false)}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-3">
                  {sigUploading ? (
                    <><Loader2 className="h-10 w-10 animate-spin text-indigo-500" /><p className="text-xs font-bold text-indigo-600">Uploading signature...</p></>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <PenLine className="h-7 w-7 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Drop your signature here</p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG accepted · Max 2MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                      >
                        Browse File
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleSigFileChange}
            />

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Your official signature will appear on all printed demand bills and receipts alongside the Council Treasurer's signature. Upload a clear, high-quality image of your handwritten signature on a plain white background.
            </p>
          </div>
        </div>

        {/* Section 3 — Change Password */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-550" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Update Password</h3>
          </div>

          <form onSubmit={handleUpdatePassword} className="p-6 space-y-6">
            {passSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" /><span>{passSuccess}</span>
              </div>
            )}
            {passError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{passError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 max-w-md">
              <div>
                <label htmlFor="current_password" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">Current Password</label>
                <input
                  id="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                />
              </div>
              <div>
                <label htmlFor="new_password" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">New Password (Min 8 characters)</label>
                <input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                />
              </div>
              <div>
                <label htmlFor="confirm_password" className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">Confirm New Password</label>
                <input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passSaving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {passSaving ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Updating...</span></> : <><KeyRound className="h-4 w-4" /><span>Update Password</span></>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
