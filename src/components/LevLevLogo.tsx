import React from 'react';

interface LevLevIconProps {
  className?: string;
  variant?: 'emerald' | 'white' | 'dark';
}

export const LevLevIcon: React.FC<LevLevIconProps> = ({
  className = 'w-8 h-8',
  variant = 'white',
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="heartGradEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="heartGradWhite" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>
        <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="40%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>

      {/* Heart Container */}
      <path
        d="M 50 88 C 22 68 8 50 8 32 C 8 18 19 8 32 8 C 40 8 47 12 50 18 C 53 12 60 8 68 8 C 81 8 92 18 92 32 C 92 50 78 68 50 88 Z"
        fill={
          variant === 'emerald'
            ? 'url(#heartGradEmerald)'
            : variant === 'dark'
            ? '#0F172A'
            : 'url(#heartGradWhite)'
        }
      />

      {/* Heartbeat Line transitioning to Ascending Trend Arrow */}
      <path
        d="M 18 58 L 27 58 L 34 43 L 43 72 L 50 42 L 56 53 L 73 26"
        stroke="url(#arrowGrad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrowhead Pointing Top-Right */}
      <path
        d="M 62 23 L 78 23 L 78 39 Z"
        fill="#EF4444"
        stroke="#EF4444"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const LevLevLogo: React.FC<{
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  badgeText?: string;
}> = ({ showSubtitle = true, size = 'md', className = '', badgeText }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="shrink-0 flex items-center justify-center filter drop-shadow-md">
        <LevLevIcon className={iconSizes[size]} variant="white" />
      </div>
      <div>
        <div className={`font-black tracking-tight leading-none flex items-center gap-1.5 ${textSizes[size]}`}>
          <span className="text-white">Lev</span>
          <span className="text-emerald-400">Lev</span>
          {badgeText && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {badgeText}
            </span>
          )}
        </div>
        {showSubtitle && (
          <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-1">
            Personal Finance, with Heart
          </p>
        )}
      </div>
    </div>
  );
};
