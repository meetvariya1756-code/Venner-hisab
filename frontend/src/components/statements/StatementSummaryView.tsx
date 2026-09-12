import React, { useEffect, useState } from 'react';
import type { BankAccount, StatementSummary, Platform } from '../../types';
import { api } from '../../api/client';
import { FileText, ArrowDownLeft, ArrowUpRight, Upload, Search, Trash2 } from 'lucide-react';

interface StatementSummaryViewProps {
  initialAccountId?: number;
  onUploadClick: (accountId: number) => void;
}

export const StatementSummaryView: React.FC<StatementSummaryViewProps> = ({
  initialAccountId,
  onUploadClick
}) => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<number>(0);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(initialAccountId || 0);
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('2026-02');

  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [_loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (selectedPlatformId) {
      loadAccounts(selectedPlatformId);
    }
  }, [selectedPlatformId]);

  useEffect(() => {
    if (selectedAccountId && selectedYearMonth) {
      loadStatementSummary(selectedAccountId, selectedYearMonth);
    }
  }, [selectedAccountId, selectedYearMonth]);

  const loadMeta = async () => {
    try {
      const plats = await api.getPlatforms();
      setPlatforms(plats);
      if (plats.length > 0) {
        setSelectedPlatformId(plats[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAccounts = async (platId: number) => {
    try {
      const accs = await api.getAccounts(platId);
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      } else {
        setSelectedAccountId(0);
        setSummary(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadStatementSummary = async (accId: number, ym: string) => {
    setLoading(true);
    try {
      const data = await api.getAccountStatementSummary(accId, ym);
      setSummary(data);
    } catch (e) {
      console.error(e);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMonth = async () => {
    if (!selectedAccountId || !selectedYearMonth) return;
    const storeName = currentAccount?.name || 'this store account';
    if (!window.confirm(`Are you sure you want to delete the bank statement and month records for ${storeName} (${selectedYearMonth})?\n\nThis will permanently delete the uploaded PDF and remove all ${summary?.total_transactions || 0} imported transactions from the database.`)) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteStatementByMonth(selectedAccountId, selectedYearMonth);
      await loadStatementSummary(selectedAccountId, selectedYearMonth);
    } catch (err: any) {
      alert(err.message || 'Failed to delete statement month.');
    } finally {
      setDeleting(false);
    }
  };

  const currentAccount = accounts.find(a => a.id === selectedAccountId);

  const platformsInEntries = Array.from(new Set(
    [...(summary?.in_entries || []), ...(summary?.out_entries || [])]
      .map(tx => tx.party)
      .filter(party => party && typeof party === 'string' && party.trim() !== '')
  )).sort();

  // Filter entries based on activeTab and search
  const getDisplayEntries = () => {
    if (!summary) return [];
    let entries: any[] = [];
    const inTagged = summary.in_entries.map(e => ({ ...e, type: 'IN' }));
    const outTagged = summary.out_entries.map(e => ({ ...e, type: 'OUT' }));
    const allEntries = [...inTagged, ...outTagged].sort((a, b) => a.date.localeCompare(b.date));

    if (activeTab === 'IN') entries = summary.in_entries.map(e => ({ ...e, type: 'IN' }));
    else if (activeTab === 'OUT') entries = summary.out_entries.map(e => ({ ...e, type: 'OUT' }));
    else if (activeTab === 'OTHER') {
      entries = allEntries.filter(e => !e.party || !platformsInEntries.includes(e.party));
    } else if (activeTab.startsWith('PLATFORM:')) {
      const platformName = activeTab.split('PLATFORM:')[1];
      entries = allEntries.filter(e => e.party === platformName);
    } else {
      entries = allEntries;
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      return entries.filter(e => e.narration.toLowerCase().includes(s) || (e.ref_no && e.ref_no.toLowerCase().includes(s)));
    }
    return entries;
  };

  const displayEntries = getDisplayEntries();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Top Filter Controls Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" /> Monthly Account Statement Summary
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Select platform, store account, and month to view complete IN & OUT records</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* Select Platform */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Platform</label>
            <select
              value={selectedPlatformId}
              onChange={(e) => setSelectedPlatformId(Number(e.target.value))}
              className="glass-input bg-slate-50 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-200"
            >
              {platforms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Select Account / Store */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Store Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="glass-input bg-slate-50 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-200 min-w-[200px]"
            >
              {accounts.length === 0 ? (
                <option value={0}>No accounts found</option>
              ) : (
                accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.bank_name})</option>
                ))
              )}
            </select>
          </div>

          {/* Select Month */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Statement Period</label>
            <input
              type="month"
              value={selectedYearMonth}
              onChange={(e) => setSelectedYearMonth(e.target.value)}
              className="glass-input bg-slate-50 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-200"
            />
          </div>

          {selectedAccountId > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUploadClick(selectedAccountId)}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Upload PDF
              </button>

              {summary && summary.total_transactions > 0 && (
                <button
                  onClick={handleDeleteMonth}
                  disabled={deleting}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  title="Delete statement and remove all transactions for this month from database"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  {deleting ? 'Deleting Month...' : 'Delete Month'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!summary || summary.total_transactions === 0 ? (
        <div className="glass-card p-12 text-center bg-white border-dashed border-slate-300 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No Bank Statement Found for this Period</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No imported transactions found for {currentAccount?.name || 'this account'} for period {selectedYearMonth}. Please upload the bank statement PDF.
          </p>
          {selectedAccountId > 0 && (
            <button
              onClick={() => onUploadClick(selectedAccountId)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Upload Statement for {selectedYearMonth}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Summary Metric Cards (Responsive Grid: 1 col mobile, 2 col sm, 3 col lg, 6 col 2xl) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            {/* Total Transactions */}
            <div className="glass-card p-4 sm:p-5 bg-white border-l-4 border-l-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-slate-500 text-[11px] font-extrabold uppercase tracking-wider block truncate">Total Transactions</span>
              <p className="text-xl xl:text-2xl font-black text-slate-900 mt-2 font-mono">{summary.total_transactions}</p>
              <span className="text-[11px] text-slate-400 mt-1.5 block font-medium">Entries in statement</span>
            </div>

            {/* Opening Balance */}
            <div className="glass-card p-4 sm:p-5 bg-amber-50/40 border border-amber-200/80 border-l-4 border-l-amber-600 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-amber-800 text-[11px] font-extrabold uppercase tracking-wider block truncate">Opening Balance</span>
              <p className="text-xl xl:text-2xl font-black text-amber-700 mt-2 font-mono truncate" title={`₹${(summary.opening_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                ₹{(summary.opening_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-amber-700/80 mt-1.5 block font-medium">Start of {selectedYearMonth}</span>
            </div>

            {/* Total Amount Received (IN) */}
            <div className="glass-card p-4 sm:p-5 bg-emerald-50/40 border border-emerald-200/80 border-l-4 border-l-emerald-600 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider">
                <span className="truncate">Total Received (IN)</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
              </div>
              <p className="text-xl xl:text-2xl font-black text-emerald-700 mt-2 font-mono truncate" title={`₹${summary.total_in.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                ₹{summary.total_in.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-600 mt-1.5 block font-medium truncate">
                {summary.in_entries_count} Credit / Settlement Entries
              </span>
            </div>

            {/* Total Amount Paid (OUT) */}
            <div className="glass-card p-4 sm:p-5 bg-rose-50/40 border border-rose-200/80 border-l-4 border-l-rose-600 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-rose-800 text-[11px] font-extrabold uppercase tracking-wider">
                <span className="truncate">Total Paid (OUT)</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
              </div>
              <p className="text-xl xl:text-2xl font-black text-rose-700 mt-2 font-mono truncate" title={`₹${summary.total_out.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                ₹{summary.total_out.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-rose-600 mt-1.5 block font-medium truncate">
                {summary.out_entries_count} Debit / Withdrawal Entries
              </span>
            </div>

            {/* Net Cash Balance Shift */}
            <div className="glass-card p-4 sm:p-5 bg-indigo-50/40 border border-indigo-200/80 border-l-4 border-l-indigo-600 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-indigo-900 text-[11px] font-extrabold uppercase tracking-wider block truncate">Net Cash Balance Shift</span>
              <p className={`text-xl xl:text-2xl font-black mt-2 font-mono truncate ${summary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} title={`₹${summary.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                ₹{summary.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-indigo-700/80 mt-1.5 block font-medium">Net Received vs Paid</span>
            </div>

            {/* Closing Balance */}
            <div className="glass-card p-4 sm:p-5 bg-sky-50/40 border border-sky-200/80 border-l-4 border-l-sky-600 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-sky-800 text-[11px] font-extrabold uppercase tracking-wider block truncate">Closing Balance</span>
              <p className="text-xl xl:text-2xl font-black text-sky-700 mt-2 font-mono truncate" title={`₹${(summary.closing_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                ₹{(summary.closing_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-sky-700 mt-1.5 block font-medium">End of {selectedYearMonth}</span>
            </div>
          </div>

          {/* Transaction Filter Tabs & List */}
          <div className="glass-card bg-white rounded-2xl overflow-hidden shadow-xs border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Entries ({summary.total_transactions})
                </button>
                <button
                  onClick={() => setActiveTab('IN')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-100/50'
                  }`}
                >
                  IN Entries ({summary.in_entries_count})
                </button>
                <button
                  onClick={() => setActiveTab('OUT')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  OUT Entries ({summary.out_entries_count})
                </button>
                {platformsInEntries.map(platform => {
                  const pEntries = [...(summary?.in_entries || []), ...(summary?.out_entries || [])].filter(e => e.party === platform);
                  return (
                    <button
                      key={`PLATFORM:${platform}`}
                      onClick={() => setActiveTab(`PLATFORM:${platform}`)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        activeTab === `PLATFORM:${platform}` ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-700 hover:bg-indigo-100/50'
                      }`}
                    >
                      {platform as string} All Entries ({pEntries.length})
                    </button>
                  );
                })}
                {(() => {
                  const otherCount = [...(summary?.in_entries || []), ...(summary?.out_entries || [])].filter(e => !e.party || !platformsInEntries.includes(e.party)).length;
                  if (otherCount === 0) return null;
                  return (
                    <button
                      onClick={() => setActiveTab('OTHER')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        activeTab === 'OTHER' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100/50'
                      }`}
                    >
                      Other Entries ({otherCount})
                    </button>
                  );
                })()}
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter narration, UPI, ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="glass-input w-full pl-9 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Complete Transaction Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100/90 text-slate-600 font-extrabold uppercase tracking-wider border-b-2 border-slate-200 text-[11px] whitespace-nowrap">
                  <tr>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4 min-w-[280px]">Narration / Description</th>
                    <th className="py-4 px-4 whitespace-nowrap">Ref / Chq No</th>
                    <th className="py-4 px-4 text-center whitespace-nowrap">Type</th>
                    <th className="py-4 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                    <th className="py-4 px-4 text-right whitespace-nowrap">Balance (₹)</th>
                    <th className="py-4 px-4 whitespace-nowrap">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">No matching entries found</td>
                    </tr>
                  ) : (
                    displayEntries.map((tx, idx) => {
                      const isIN = tx.type === 'IN' || summary.in_entries.some(e => e.id === tx.id);
                      return (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-4 px-4 font-mono text-slate-600 font-bold whitespace-nowrap align-middle text-xs">{tx.date}</td>
                          <td className="py-4 px-4 max-w-md align-middle">
                            <div className="font-bold text-slate-900 text-xs leading-relaxed" title={tx.narration}>
                              {tx.narration}
                            </div>
                            {tx.party && (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md font-bold mt-1.5 inline-flex items-center gap-1 shadow-2xs">
                                Party: {tx.party}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-500 text-xs font-semibold whitespace-nowrap align-middle">{tx.ref_no || '-'}</td>
                          <td className="py-4 px-4 text-center whitespace-nowrap align-middle">
                            <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs ${
                              isIN ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-300/80' : 'bg-rose-100/90 text-rose-800 border border-rose-300/80'
                            }`}>
                              {isIN ? 'IN (CREDIT)' : 'OUT (DEBIT)'}
                            </span>
                          </td>
                          <td className={`py-4 px-4 text-right font-mono font-black text-xs sm:text-sm whitespace-nowrap align-middle ${
                            isIN ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isIN ? `+ ₹${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `- ₹${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                          </td>
                          <td className="py-4 px-4 text-right font-mono font-extrabold text-slate-800 text-xs sm:text-sm whitespace-nowrap align-middle">
                            ₹{tx.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap align-middle">
                            <span className="text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-200/80 inline-flex items-center whitespace-nowrap shadow-2xs">
                              {tx.category}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {displayEntries.length > 0 && (() => {
                  const totalIn = displayEntries
                    .filter(e => e.type === 'IN' || summary.in_entries.some((x: any) => x.id === e.id))
                    .reduce((sum, e) => sum + (e.amount || 0), 0);
                  const totalOut = displayEntries
                    .filter(e => e.type === 'OUT' && !summary.in_entries.some((x: any) => x.id === e.id))
                    .reduce((sum, e) => sum + (e.amount || 0), 0);
                  const netVal = totalIn - totalOut;

                  let totalsHeader = 'ALL ENTRIES';
                  let netHeader = 'NET BALANCE / PAYOUT';

                  if (activeTab === 'ALL') {
                    totalsHeader = 'ALL ENTRIES';
                    netHeader = 'NET BALANCE / PAYOUT';
                  } else if (activeTab === 'IN') {
                    totalsHeader = 'IN ENTRIES (RECEIVED)';
                    netHeader = 'TOTAL IN RECEIVED';
                  } else if (activeTab === 'OUT') {
                    totalsHeader = 'OUT ENTRIES (PAID)';
                    netHeader = 'TOTAL OUT PAID';
                  } else if (activeTab === 'OTHER') {
                    totalsHeader = 'OTHER ENTRIES (UPI, ATM & OTHERS)';
                    netHeader = 'NET OTHER PAYOUT / BALANCE';
                  } else if (activeTab.startsWith('PLATFORM:')) {
                    const pName = activeTab.split('PLATFORM:')[1].toUpperCase();
                    totalsHeader = pName;
                    netHeader = `NET ${pName} PAYOUT`;
                  }

                  return (
                    <tfoot className="bg-indigo-50/60 border-t-2 border-indigo-200">
                      <tr>
                        <td colSpan={4} className="py-4 px-4 text-right uppercase text-indigo-900 font-black text-xs tracking-wider">
                          TOTALS FOR {totalsHeader}:
                        </td>
                        <td className="py-4 px-4 text-right text-emerald-700 font-black font-mono text-sm whitespace-nowrap">
                          + ₹{totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right text-rose-700 font-black font-mono text-sm whitespace-nowrap">
                          - ₹{totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4"></td>
                      </tr>
                      <tr className="border-t border-indigo-100">
                        <td colSpan={4} className="py-4 px-4 text-right uppercase text-slate-600 font-black text-xs tracking-wider">
                          {netHeader}:
                        </td>
                        <td colSpan={2} className={`py-4 px-4 text-right font-black font-mono text-base whitespace-nowrap ${netVal >= 0 ? 'text-indigo-900' : 'text-rose-700'}`}>
                          ₹{netVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4"></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
