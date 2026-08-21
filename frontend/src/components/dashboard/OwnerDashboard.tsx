import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Download,
  Trophy,
  RefreshCw,
  LayoutDashboard,
  Calendar,
  Layers,
} from 'lucide-react';
import { api } from '../../api/client';
import type { OwnerDashboard as OwnerDashboardType, AccountAnalytics } from '../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Custom Recharts tooltip with Tailwind styling
const CurrencyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xl text-xs space-y-1.5 min-w-[150px]">
      <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between items-center gap-4">
          <span className="font-medium text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}:
          </span>
          <span className="font-bold" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Medal badge ───────────────────────────────────────────────────────────────

const MedalBadge = ({ rank }: { rank: number }) => {
  const styles: Record<number, { bg: string; text: string; icon: string }> = {
    1: { bg: 'bg-amber-100', text: 'text-amber-800', icon: '🥇' },
    2: { bg: 'bg-slate-100', text: 'text-slate-800', icon: '🥈' },
    3: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🥉' },
  };
  const s = styles[rank] ?? { bg: 'bg-slate-50', text: 'text-slate-500', icon: `#${rank}` };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${s.bg} ${s.text} text-xs font-bold flex-shrink-0 shadow-xs`}>
      {s.icon}
    </span>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  sub: string;
  accentClass: string;
  bgIconClass: string;
  iconColorClass: string;
  Icon: React.ElementType;
}

const KpiCard: React.FC<KpiProps> = ({ label, value, sub, accentClass, bgIconClass, iconColorClass, Icon }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-l-4 ${accentClass}`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">{label}</span>
      <div className={`w-9 h-9 rounded-xl ${bgIconClass} flex items-center justify-center transition-transform duration-300 hover:scale-105`}>
        <Icon size={16} className={iconColorClass} />
      </div>
    </div>
    <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-3">{value}</p>
    <p className="text-xs text-slate-400 mt-1">{sub}</p>
  </div>
);

// ── Section heading ───────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode; sub?: string; icon?: React.ElementType; iconClass?: string }> = ({ children, sub, icon: Icon, iconClass }) => (
  <div className="mb-5">
    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
      {Icon && <Icon className={`w-4 h-4 ${iconClass || 'text-indigo-600'}`} />}
      {children}
    </h3>
    {sub && <p className="text-xs text-slate-400 mt-1 font-medium">{sub}</p>}
  </div>
);

// ── Card wrapper ──────────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs ${className || ''}`}>
    {children}
  </div>
);

// ── Top account list item ─────────────────────────────────────────────────────

const TopAccountRow: React.FC<{ acc: AccountAnalytics; rank: number; valueKey: 'total_credit' | 'total_debit'; max: number }> =
  ({ acc, rank, valueKey, max }) => {
    const value = acc[valueKey];
    const pct = max > 0 ? (value / max) * 100 : 0;
    const isCredit = valueKey === 'total_credit';
    const textColor = isCredit ? 'text-emerald-600' : 'text-rose-600';
    const barBg = isCredit ? 'bg-emerald-500' : 'bg-rose-500';
    return (
      <div className="flex items-center gap-3.5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-2 rounded-lg transition-colors duration-150">
        <MedalBadge rank={rank} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate m-0">
            {acc.name}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">{acc.platform_name} · {acc.bank_name}</p>
          <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden w-full max-w-[150px]">
            <div className={`h-full ${barBg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className={`text-xs font-extrabold ${textColor} flex-shrink-0`}>{fmt(value)}</span>
      </div>
    );
  };

// ── Main component ────────────────────────────────────────────────────────────

export const OwnerDashboard: React.FC = () => {
  const [data, setData] = useState<OwnerDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getOwnerDashboard();
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide">Loading Financial Analytics...</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm font-bold text-rose-500">{error ?? 'No dashboard data available'}</p>
        <button
          onClick={load}
          className="mt-4 px-5 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors text-xs font-bold shadow-xs cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { overview, account_summary, monthly_trend, yearly_summary, top_credit_accounts, top_debit_accounts } = data;

  // Compute max for progress bars
  const maxCredit = top_credit_accounts[0]?.total_credit ?? 1;
  const maxDebit = top_debit_accounts[0]?.total_debit ?? 1;
  const maxYearlyCredit = Math.max(...yearly_summary.map(y => y.credit), 1);

  // Account horizontal bar chart data (top 10)
  const accChartData = [...account_summary]
    .sort((a, b) => (b.total_credit + b.total_debit) - (a.total_credit + a.total_debit))
    .slice(0, 10)
    .map(a => ({
      name: a.name.length > 11 ? a.name.slice(0, 11) + '…' : a.name,
      Credit: a.total_credit,
      Debit: a.total_debit,
    }));

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #owner-dashboard-root, #owner-dashboard-root * { visibility: visible; }
          #owner-dashboard-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          #owner-dashboard-print-btn { display: none !important; }
          .no-print { display: none !important; }
          @page { margin: 12mm; size: A4 landscape; }
        }
      `}</style>

      <div id="owner-dashboard-root" className="py-6 space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 md:p-8 text-white shadow-lg shadow-indigo-950/20 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/15 shadow-inner">
              <LayoutDashboard size={22} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white m-0">Analytics Dashboard</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Consolidated financials · {overview.accounts_count} accounts · {overview.statements_count} statements
              </p>
            </div>
          </div>
          <div id="owner-dashboard-print-btn" className="flex items-center gap-2.5">
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw size={13} className="text-slate-300" /> Refresh
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-transparent rounded-xl text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Download size={13} /> Export PDF Report
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Credit (In)"
            value={fmt(overview.total_credit)}
            sub="Consolidated receipts & deposits"
            accentClass="border-l-emerald-500"
            bgIconClass="bg-emerald-50"
            iconColorClass="text-emerald-600"
            Icon={TrendingUp}
          />
          <KpiCard
            label="Total Debit (Out)"
            value={fmt(overview.total_debit)}
            sub="Consolidated payouts & charges"
            accentClass="border-l-rose-500"
            bgIconClass="bg-rose-50"
            iconColorClass="text-rose-600"
            Icon={TrendingDown}
          />
          <KpiCard
            label="Net Cash Position"
            value={fmtFull(overview.net_balance)}
            sub={overview.net_balance >= 0 ? 'Surplus cash flow' : 'Deficit cash flow'}
            accentClass={overview.net_balance >= 0 ? 'border-l-indigo-500' : 'border-l-amber-500'}
            bgIconClass={overview.net_balance >= 0 ? 'bg-indigo-50' : 'bg-amber-50'}
            iconColorClass={overview.net_balance >= 0 ? 'text-indigo-600' : 'text-amber-600'}
            Icon={Wallet}
          />
          <KpiCard
            label="Processed Statements"
            value={String(overview.statements_count)}
            sub={`${overview.transactions_count.toLocaleString()} reconciled entries`}
            accentClass="border-l-purple-500"
            bgIconClass="bg-purple-50"
            iconColorClass="text-purple-600"
            Icon={Building2}
          />
        </div>

        {/* ── Charts Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Monthly Trend */}
          <Card className="lg:col-span-3">
            <SectionTitle sub="Monthly cash flow trends across all registered accounts" icon={Calendar}>
              Monthly Trend Analysis
            </SectionTitle>
            {monthly_trend.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs font-semibold">No monthly transaction data available</div>
            ) : (
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthly_trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
                    <Bar dataKey="credit" name="Total In" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="debit" name="Total Out" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Line type="monotone" dataKey="net" name="Net Flow" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2, fill: '#4f46e5' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Account horizontal bar chart */}
          <Card className="lg:col-span-2">
            <SectionTitle sub="Volume-wise breakdown of top 10 store accounts" icon={Layers}>
              Account-wise Analysis
            </SectionTitle>
            {accChartData.length === 0 ? (
              <div className="py-24 text-center text-slate-400 text-xs font-semibold">No active bank accounts found</div>
            ) : (
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accChartData} layout="vertical" margin={{ top: 0, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={9} width={75} tickLine={false} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
                    <Bar dataKey="Credit" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={12} />
                    <Bar dataKey="Debit" fill="#ef4444" radius={[0, 3, 3, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* ── Yearly + Top Performers Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Yearly Summary */}
          <Card>
            <SectionTitle sub="Consolidated year-wise financial flow summary" icon={Building2}>
              Yearly Summary
            </SectionTitle>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Year</th>
                    <th className="py-3 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Credit</th>
                    <th className="py-3 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Debit</th>
                    <th className="py-3 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Net Flow</th>
                    <th className="py-3 px-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-center">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {yearly_summary.map((y) => {
                    const pct = Math.round((y.credit / maxYearlyCredit) * 100);
                    return (
                      <tr key={y.year} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3 font-extrabold text-indigo-700 text-sm">{y.year}</td>
                        <td className="py-3.5 px-3 text-right">
                          <div>
                            <span className="text-emerald-600 font-extrabold">{fmt(y.credit)}</span>
                            <div className="h-1 bg-emerald-50 rounded-full mt-1.5 overflow-hidden w-24 ml-auto">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right text-rose-600 font-bold">{fmt(y.debit)}</td>
                        <td className={`py-3.5 px-3 text-right font-extrabold ${y.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {y.net >= 0 ? '+' : ''}{fmt(y.net)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-500 font-semibold">{y.tx_count.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Top Performers */}
          <Card>
            <SectionTitle sub="Highest credit & debit accounts at a glance" icon={Trophy} iconClass="text-amber-500">
              Top Performing Accounts
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase border-b border-slate-100 pb-2 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Top Credit Volume
                </p>
                {top_credit_accounts.map((acc, i) => (
                  <TopAccountRow key={acc.id} acc={acc} rank={i + 1} valueKey="total_credit" max={maxCredit} />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-rose-600 tracking-widest uppercase border-b border-slate-100 pb-2 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Top Debit Volume
                </p>
                {top_debit_accounts.map((acc, i) => (
                  <TopAccountRow key={acc.id} acc={acc} rank={i + 1} valueKey="total_debit" max={maxDebit} />
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Complete Account Summary Table ── */}
        <Card>
          <SectionTitle sub="Comprehensive statement reconciliation for all registered bank accounts" icon={Layers}>
            Complete Account Summary
          </SectionTitle>
          <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Account</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Holder</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Bank Name</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Platform</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Total In</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Total Out</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Net Flow</th>
                  <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Txns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {account_summary.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                    <td className="py-3 px-4 font-bold text-slate-800 truncate max-w-[140px]">{acc.name}</td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[120px] font-medium">{acc.account_holder}</td>
                    <td className="py-3 px-4 text-slate-400 font-medium">{acc.bank_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 text-indigo-700 uppercase tracking-wide border border-indigo-100/50">
                        {acc.platform_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-extrabold">{fmt(acc.total_credit)}</td>
                    <td className="py-3 px-4 text-right text-rose-500 font-bold">{fmt(acc.total_debit)}</td>
                    <td className={`py-3 px-4 text-right font-extrabold ${acc.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {acc.net >= 0 ? '+' : ''}{fmt(acc.net)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-semibold">{acc.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50/40 border-t-2 border-indigo-200/80 font-black">
                  <td colSpan={4} className="py-3.5 px-4 text-indigo-900 font-extrabold uppercase text-[10px] tracking-wider">GRAND TOTAL</td>
                  <td className="py-3.5 px-4 text-right text-emerald-600 font-black text-sm">{fmtFull(overview.total_credit)}</td>
                  <td className="py-3.5 px-4 text-right text-rose-600 font-black text-sm">{fmtFull(overview.total_debit)}</td>
                  <td className={`py-3.5 px-4 text-right font-black text-sm ${overview.net_balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {overview.net_balance >= 0 ? '+' : ''}{fmtFull(overview.net_balance)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-indigo-900 font-extrabold text-sm">{overview.transactions_count.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

      </div>
    </>
  );
};
