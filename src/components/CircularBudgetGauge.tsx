import React from 'react';

interface CircularBudgetGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  isOver?: boolean;
  showLabel?: boolean;
  subLabel?: string;
  className?: string;
}

export function CircularBudgetGauge({
  percentage,
  size = 54,
  strokeWidth = 5,
  isOver = false,
  showLabel = true,
  subLabel,
  className = '',
}: CircularBudgetGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  // Determine stroke color according to utilization level
  let strokeColor = '#10b981'; // emerald-500
  let trackColor = '#1e293b'; // slate-800
  let textColor = 'text-emerald-400';

  if (isOver || percentage >= 100) {
    strokeColor = '#f43f5e'; // rose-500
    textColor = 'text-rose-400';
  } else if (percentage >= 85) {
    strokeColor = '#f97316'; // orange-500
    textColor = 'text-orange-400';
  } else if (percentage >= 70) {
    strokeColor = '#f59e0b'; // amber-500
    textColor = 'text-amber-400';
  }

  return (
    <div className={`relative flex items-center justify-center inline-flex select-none ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 origin-center"
        aria-hidden="true"
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-[11px] font-black font-mono leading-none ${textColor}`}>
            {percentage > 999 ? '999%+' : `${Math.round(percentage)}%`}
          </span>
          {subLabel && (
            <span className="text-[8px] text-slate-400 leading-none mt-0.5 font-medium">
              {subLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
