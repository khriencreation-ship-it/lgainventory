'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  ArrowLeft,
  Loader2,
  Save,
  KeyRound,
  AlertCircle,
  CheckCircle2,
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

export default function OfficerProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Personal Info Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState('');
  const [infoError, setInfoError] = useState('');



  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // 1. Fetch profile on load
  const fetchProfile = async () => {
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
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. Save Personal Info Changes
  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSaving(true);
    setInfoSuccess('');
    setInfoError('');

    try {
      const res = await fetch('/api/officer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_phone',
          phone_number: phoneNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone number');
      
      setInfoSuccess('Phone number updated successfully.');
      if (profile) {
        setProfile({ ...profile, phone_number: phoneNumber });
      }
    } catch (err: any) {
      setInfoError(err.message);
    } finally {
      setInfoSaving(false);
    }
  };


  // 5. Update Password
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
        body: JSON.stringify({
          action: 'change_password',
          currentPassword,
          newPassword,
          confirmPassword,
        }),
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Loading profile data...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm max-w-xl mx-auto">
        <AlertCircle className="h-10 w-10 text-rose-450 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">{error || 'Failed to load profile'}</h3>
        <button onClick={fetchProfile} className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition">
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header back button */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/officer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Profile & Signature</h2>
          <p className="text-xs text-slate-450 font-medium">Manage your operator details, signature credentials and password settings.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">

        {/* Section 1 — Personal Information */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <User className="h-4.5 w-4.5 text-slate-550" />
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
                <input
                  type="text"
                  value={profile.name}
                  disabled
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
                />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
                />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Role Type</label>
                <input
                  type="text"
                  value="Account Officer"
                  disabled
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
                />
                <span className="text-[9px] text-slate-400 font-medium mt-1 block">Managed by administrator</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Local Government</label>
                <input
                  type="text"
                  value={profile.lg_name || 'Not Assigned'}
                  disabled
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
                />
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
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-250 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={infoSaving}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {infoSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>


        {/* Section 3 — Change Password */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <KeyRound className="h-4.5 w-4.5 text-slate-550" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Update Password</h3>
          </div>

          <form onSubmit={handleUpdatePassword} className="p-6 space-y-6">
            {passSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}
            {passError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{passError}</span>
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
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-250 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
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
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-250 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
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
                  className="w-full px-4 py-2.5 text-xs font-semibold bg-white border border-slate-250 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passSaving}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                {passSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
