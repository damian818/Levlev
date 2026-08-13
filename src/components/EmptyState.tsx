import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
        <div className="relative p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-emerald-500/80">
          <Icon className="w-12 h-12" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};
