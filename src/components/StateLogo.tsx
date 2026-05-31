'use client';

import React, { useState } from 'react';

interface StateLogoProps {
  logoUrl?: string | null;
  code: string;
  name: string;
  className?: string;
  fallbackSizeClass?: string;
}

export default function StateLogo({
  logoUrl,
  code,
  name,
  className = "w-7 h-7 rounded-lg object-cover border border-slate-100 shadow-sm shrink-0 bg-white",
  fallbackSizeClass = "w-7 h-7 text-[10px]"
}: StateLogoProps) {
  const [error, setError] = useState(false);

  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={`${name} Logo`}
        className={className}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${fallbackSizeClass} rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center font-extrabold shadow-sm uppercase shrink-0`}>
      {code.slice(0, 2)}
    </div>
  );
}
