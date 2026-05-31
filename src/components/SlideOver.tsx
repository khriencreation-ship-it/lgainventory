'use client';

import React from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function SlideOver({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer
}: SlideOverProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
      ></div>

      {/* Panel content */}
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 text-slate-800 flex flex-col z-10 p-6 shadow-2xl h-full justify-between animate-slide-in">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Drawer Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-650 p-1 cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Children */}
          <div className="flex-1 overflow-y-auto py-6">
            {children}
          </div>
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
