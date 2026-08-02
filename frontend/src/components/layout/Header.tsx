import React from 'react';
import { Building2, Smartphone, BookOpen, LogOut, Shield, User as UserIcon } from 'lucide-react';
import type { User } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const isManager = user?.role === 'manager';

  const allTabs = [
    { id: 'platforms', label: 'Platforms & Stores' },
    { id: 'summary', label: 'Monthly Statement Summary' },
    { id: 'mobile', label: 'Mobile Sync & Tracker', icon: Smartphone },
    { id: 'accounts', label: 'Bank Accounts' },
    { id: 'transactions', label: 'All Transactions' },
    { id: 'khatabook', label: 'Khatabook', icon: BookOpen },
  ];

  const visibleTabs = isManager
    ? allTabs.filter(tab => tab.id === 'khatabook')
    : allTabs;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
            Statement Analyzer
          </h1>
          <p className="text-xs text-slate-500">Platform-Wise & Month-Wise Bank Statement Reconciliation</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            {user.role === 'owner' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
                <Shield className="w-3 h-3" /> Owner
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                <UserIcon className="w-3 h-3" /> Manager
              </span>
            )}
            <span className="font-semibold text-slate-700">{user.full_name || user.username}</span>
          </div>

          <button
            onClick={onLogout}
            title="Sign Out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
};
