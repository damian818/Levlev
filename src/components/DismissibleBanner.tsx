import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DismissibleBannerProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'info' | 'warning' | 'emerald' | 'purple' | 'amber';
}

export const DismissibleBanner: React.FC<DismissibleBannerProps> = ({ 
  id, 
  children, 
  className = "", 
  variant = 'info' 
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`banner_dismissed_${id}`);
    setIsDismissed(dismissed === 'true');
    setIsInitialized(true);
  }, [id]);

  const handleDismiss = () => {
    localStorage.setItem(`banner_dismissed_${id}`, 'true');
    setIsDismissed(true);
  };

  if (!isInitialized || isDismissed) return null;

  const variantStyles = {
    info: "bg-[#121620] border-slate-800 text-slate-200",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-200",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-200",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative p-4 rounded-xl border shadow-sm flex items-start gap-3 group ${variantStyles[variant]} ${className}`}
      >
        <div className="flex-1">
          {children}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-slate-800/50 rounded-lg text-slate-400 hover:text-slate-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
