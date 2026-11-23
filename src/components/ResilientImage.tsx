import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackTitle }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-red-50/40 to-slate-200 text-slate-500 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Building2 className="w-8 h-8 text-red-600/70 mb-2" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-slate-700">{fallbackTitle || alt}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
