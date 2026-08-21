import React, { useState } from 'react';
import { Building2, Smartphone, BookOpen, LogOut, Shield, User as UserIcon, LayoutDashboard, Menu, X } from 'lucide-react';
import type { User } from '../../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isManager = user?.role === 'manager';
  const isOwner = user?.role === 'owner';

  const allTabs = [
    ...(isOwner ? [{ id: 'owner-dashboard', label: 'Owner Dashboard', icon: LayoutDashboard }] : []),
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

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
              Statement Analyzer
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Platform-Wise & Month-Wise Reconciliation</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
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

        {/* Desktop User Info & Logout */}
        {user && (
          <div className="hidden xl:flex items-center gap-3">
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* Mobile Hamburger Menu Toggle Button */}
        <div className="flex items-center gap-2 xl:hidden">
          {user && (
            <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate sm:max-w-none">
              {user.full_name || user.username}
            </span>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden mt-3 pt-3 border-t border-slate-200 space-y-3 pb-2 animate-in fade-in slide-in-from-top duration-200">
          <nav className="flex flex-col gap-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 text-left cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  {Icon ? (
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-slate-400'}`} />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Badge & Logout in Mobile Menu */}
          {user && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                {user.role === 'owner' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
                    <Shield className="w-3 h-3" /> Owner
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                    <UserIcon className="w-3 h-3" /> Manager
                  </span>
                )}
                <span className="font-semibold text-slate-800">{user.full_name || user.username}</span>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

