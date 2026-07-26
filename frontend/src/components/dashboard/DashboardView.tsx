import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { DashboardSummary, PlatformBreakdown } from '../../types';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, ShoppingBag, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface DashboardViewProps {
  onDrillDown: (filters: { category_id?: number; search?: string; is_categorized?: boolean }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onDrillDown }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [platforms, setPlatforms] = useState<PlatformBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, platRes] = await Promise.all([
        api.getDashboard(),
        api.getPlatformBreakdown()
      ]);
      setSummary(sumRes);
      setPlatforms(platRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        Loading financial overview...
      </div>
    );
  }

  const PLATFORM_COLORS: Record<string, string> = {
    Meesho: '#ec4899',
    Flipkart: '#2563eb',
    Amazon: '#f59e0b',
    Other: '#10b981',
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Consolidated Financial Summary
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Reconciling {summary.accounts_count} Store Accounts across {summary.platforms_count} E-Commerce Platforms
          </p>
        </div>
        
        {summary.uncategorized_count > 0 && (
          <button
            onClick={() => onDrillDown({ is_categorized: false })}
            className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <AlertCircle className="w-4 h-4 text-amber-600" />
            {summary.uncategorized_count} Uncategorized Transactions
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 bg-white border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Received (IN)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            ₹{summary.total_income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Credits across all statements</p>
        </div>

        <div className="glass-card p-5 bg-white border-l-4 border-l-rose-600">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Paid (OUT)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-700 mt-2">
            ₹{summary.total_expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Debits & withdrawals</p>
        </div>

        <div className="glass-card p-5 bg-white border-l-4 border-l-indigo-600">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Net Surplus</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-extrabold mt-2 ${summary.net_result >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₹{summary.net_result.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Net profit / deficit</p>
        </div>

        <div className="glass-card p-5 bg-white border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Statements Processed</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {summary.statements_count}
          </p>
          <p className="text-xs text-slate-500 mt-1">Across {summary.accounts_count} accounts</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 glass-card p-6 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Monthly Cash Flow Trend</h3>
              <p className="text-xs text-slate-500">IN (Received) vs OUT (Paid) over time</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.monthly_trend}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: any) => `₹${Number(v)/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                />
                <Area type="monotone" dataKey="income" name="IN (Received)" stroke="#10b981" fillOpacity={1} fill="url(#incomeGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="OUT (Paid)" stroke="#ef4444" fillOpacity={1} fill="url(#expenseGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Marketplace Platform Breakdown */}
        <div className="glass-card p-6 bg-white flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              Platform Revenue Summary
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Meesho vs Flipkart vs Amazon vs Direct</p>
          </div>

          <div className="my-4 space-y-3">
            {platforms?.platforms.map((p) => (
              <div
                key={p.platform_id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS[p.platform_name] || '#6366f1' }}
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{p.platform_name}</span>
                    <span className="text-[10px] text-slate-500">{p.account_count} accounts</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-emerald-700 block">
                    IN: ₹{p.total_in.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-rose-600 font-semibold block">
                    OUT: ₹{p.total_out.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
