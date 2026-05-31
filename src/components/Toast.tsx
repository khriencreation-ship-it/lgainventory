'use client';

import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, Check, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'error', onClose, duration = 5000 }: ToastProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (message) {
      setIsRendered(true);
      setIsFadingOut(false);

      // Start the slide-out fade-out 300ms before duration expires
      const fadeOutTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, duration - 300);

      const closeTimer = setTimeout(() => {
        onClose();
      }, duration);

      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(closeTimer);
      };
    } else {
      setIsRendered(false);
    }
  }, [message, duration, onClose]);

  if (!isRendered || !message) return null;

  const bgClass = type === 'error'
    ? 'bg-red-50 border-red-200 text-red-800 shadow-red-100/50'
    : type === 'success'
    ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-100/50'
    : 'bg-blue-50 border-blue-200 text-blue-800 shadow-blue-100/50';

  const iconClass = type === 'error'
    ? 'text-red-500'
    : type === 'success'
    ? 'text-amber-600'
    : 'text-blue-500';

  const Icon = type === 'error' ? ShieldAlert : type === 'success' ? Check : Info;

  const handleManualClose = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  return (
    <div
      style={{ pointerEvents: 'auto' }}
      className={`fixed bottom-6 right-6 z-[9999] flex items-start gap-3 px-4 py-3.5 border rounded-2xl shadow-xl max-w-sm w-full transition-all duration-300 transform ${
        isFadingOut
          ? 'translate-y-12 scale-95 opacity-0'
          : 'translate-y-0 scale-100 opacity-100'
      } animate-toast-in ${bgClass}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${iconClass} mt-0.5`} />
      <div className="flex-1 text-xs font-semibold leading-relaxed pr-1">{message}</div>
      <button
        type="button"
        onClick={handleManualClose}
        className="text-slate-400 hover:text-slate-600 transition p-0.5 shrink-0 cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
