'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Loader2, Building2, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

function LgaLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const role = data.user.role;
      if (role === 'super_admin') {
        throw new Error('This portal is for Local Government officials only. Please use the Super Admin portal.');
      }

      let targetRedirect = redirect;
      if (!targetRedirect) {
        if (role === 'lg_chairman' || role === 'lg_admin') {
          targetRedirect = '/dashboard/chairman';
        } else if (role === 'lg_account_officer' || role === 'lg_officer' || role === 'treasurer' || role === 'lg_treasurer') {
          targetRedirect = '/dashboard/officer';
        } else {
          targetRedirect = '/';
        }
      }

      router.push(targetRedirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4 sm:px-6">
      {/* Brand Header for Mobile */}
      <div className="flex flex-col mb-8 md:hidden">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-orange-600 mb-3">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Local Government</h1>
        <p className="text-sm text-slate-500 mt-1">Revenue Management Platform</p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-150/45 transition-all duration-300">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-3 bg-orange-50 border border-orange-100 text-orange-600 rounded-xl hidden sm:block">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">LGA Officer Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">Access your local government workspace.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Work Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-5 w-5" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@lga.gov.ng"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-5 w-5" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all duration-200 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 active:bg-orange-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md shadow-orange-500/10 hover:shadow-orange-500/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying account...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>

      <div className="text-center mt-8 text-xs text-slate-450">
        <p>© {new Date().getFullYear()} Local Government Authorities.</p>
      </div>
    </div>
  );
}

export default function LgaLoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row relative overflow-hidden">
      {/* Left split: Image (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-slate-950 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 z-0">
          <Image
            src="/company-bookkeeper-analyzing-financial-statistics-laptop-screen-corporate-accounting-service-concept-business-analyst-looking-diagrams-charts-computer-modern-workspace.jpg"
            alt="Revenue Platform Landscape"
            fill
            className="object-cover"
            priority
          />
          {/* Lighter Live Dark Overlay */}
          <div className="absolute inset-0 bg-slate-950/45 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-955/80 via-slate-950/45 to-slate-955/15 z-10"></div>
        </div>

        {/* Overlay Content */}
        <div className="z-20 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-550 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">
            LG
          </div>
          <div>
            <span className="font-extrabold text-white text-base tracking-tight block">Local Government Portal</span>
            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">Revenue Management System</span>
          </div>
        </div>

        <div className="z-20 max-w-lg space-y-4">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight shadow-sm">
            Digitizing municipal revenue operations nationwide.
          </h2>
        </div>

        {/* Empty space for structural padding since footer text was removed */}
        <div className="z-20 min-h-[20px]"></div>
      </div>

      {/* Right split: Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center py-12 px-6 bg-slate-50 border-l border-slate-100 relative">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="text-xs uppercase font-semibold tracking-wider">Loading form...</span>
          </div>
        }>
          <LgaLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
