import React, { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  className = '',
  size = 'md',
  rounded = 'rounded-full',
}) => {
  const [imgError, setImgError] = useState(false);

  // Get initials (up to 2 letters)
  const getInitials = (str: string) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  // Map sizes
  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  // Background color palette for initials based on name hash
  const colors = [
    'bg-indigo-600 text-white',
    'bg-blue-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
    'bg-violet-600 text-white',
    'bg-teal-600 text-white',
    'bg-rose-600 text-white',
  ];

  const getColorIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % colors.length;
  };

  const colorClass = colors[getColorIndex(name || 'User')];

  if (!src || imgError) {
    return (
      <div
        className={`${currentSizeClass} ${rounded} ${colorClass} font-bold flex items-center justify-center shrink-0 select-none shadow-2xs border border-white/20 ${className}`}
        title={name}
      >
        {initials || <User className="w-1/2 h-1/2" />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`${currentSizeClass} ${rounded} object-cover border border-slate-200 shrink-0 ${className}`}
    />
  );
};
