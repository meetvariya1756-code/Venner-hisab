import React from 'react';
import { Building2 } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
            Multi-Account Statement Analyzer
            <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
              Pro v1.0
            </span>
          </h1>
          <p className="text-xs text-slate-500">Platform-Wise & Month-Wise Bank Statement Reconciliation</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        {[
          { id: 'platforms', label: 'Platforms & Stores' },
          { id: 'summary', label: 'Monthly Statement Summary' },
          { id: 'accounts', label: 'Bank Accounts' },
          { id: 'transactions', label: 'All Transactions' },
          { id: 'parties', label: 'Parties & Payees' },
          { id: 'rules', label: 'Rules & Categories' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
