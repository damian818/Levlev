import React from 'react';

export const AppPreview: React.FC = () => {
  return (
    <section className="py-16 px-4 max-w-6xl mx-auto">
      <h3 className="text-2xl font-bold text-white text-center mb-10">See LevLev in Action</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <img src="/assets/images/dashboard_preview_1786150416027.jpg" alt="Dashboard" className="w-full h-auto rounded-xl" />
        </div>
        <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <img src="/assets/images/analytics_preview_1786150432307.jpg" alt="Analytics" className="w-full h-auto rounded-xl" />
        </div>
        <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <img src="/assets/images/accounts_preview_1786150446819.jpg" alt="Accounts" className="w-full h-auto rounded-xl" />
        </div>
      </div>
    </section>
  );
};
