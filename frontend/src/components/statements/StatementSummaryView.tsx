import React, { useEffect, useState } from 'react';
import type { BankAccount, StatementSummary, Platform } from '../../types';
import { api } from '../../api/client';
import { FileText, ArrowDownLeft, ArrowUpRight, Upload, Search } from 'lucide-react';

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
    <div className="space-y-6 p-6">
      {/* Top Filter Controls Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> Monthly Account Statement Summary
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Select platform, store account, and month to view complete IN & OUT records</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Select Platform */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Platform</label>
            <select
              value={selectedPlatformId}
              onChange={(e) => setSelectedPlatformId(Number(e.target.value))}
              className="glass-input bg-slate-50 font-semibold text-xs py-1.5"
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
              className="glass-input bg-slate-50 font-semibold text-xs py-1.5"
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
              className="glass-input bg-slate-50 font-semibold text-xs py-1.5"
            />
          </div>

          {selectedAccountId > 0 && (
            <div className="pt-4">
              <button
                onClick={() => onUploadClick(selectedAccountId)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" /> Upload PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {!summary || summary.total_transactions === 0 ? (
        <div className="glass-card p-12 text-center bg-white border-dashed border-slate-300">
          <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No Bank Statement Found for this Period</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No imported transactions found for {currentAccount?.name || 'this account'} for period {selectedYearMonth}. Please upload the bank statement PDF.
          </p>
          {selectedAccountId > 0 && (
            <button
              onClick={() => onUploadClick(selectedAccountId)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Upload Statement for {selectedYearMonth}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 bg-white border-l-4 border-l-slate-800">
              <span className="text-slate-500 text-xs font-semibold block uppercase">Total Transactions</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">{summary.total_transactions}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">Entries in statement</span>
            </div>

            <div className="glass-card p-5 bg-emerald-50/50 border border-emerald-200 border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                <span>Total Amount Received (IN)</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 mt-2">
                ₹{summary.total_in.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                {summary.in_entries_count} Credit / Settlement Entries
              </span>
            </div>

            <div className="glass-card p-5 bg-rose-50/50 border border-rose-200 border-l-4 border-l-rose-600">
              <div className="flex items-center justify-between text-rose-800 text-xs font-semibold">
                <span>Total Amount Paid (OUT)</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-extrabold text-rose-700 mt-2">
                ₹{summary.total_out.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-rose-600 mt-1 block font-medium">
                {summary.out_entries_count} Debit / Withdrawal Entries
              </span>
            </div>

            <div className="glass-card p-5 bg-indigo-50/50 border border-indigo-200 border-l-4 border-l-indigo-600">
              <span className="text-indigo-900 text-xs font-semibold block uppercase">Net Cash Balance Shift</span>
              <p className={`text-2xl font-extrabold mt-2 ${summary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{summary.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-indigo-700 mt-1 block font-medium">Net Received vs Paid</span>
            </div>
          </div>

          {/* Transaction Filter Tabs & List */}
          <div className="glass-card bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Entries ({summary.total_transactions})
                </button>
                <button
                  onClick={() => setActiveTab('IN')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-100/50'
                  }`}
                >
                  IN Entries (Received) ({summary.in_entries_count})
                </button>
                <button
                  onClick={() => setActiveTab('OUT')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  OUT Entries (Paid) ({summary.out_entries_count})
                </button>
                {platformsInEntries.map(platform => {
                  const pEntries = [...(summary?.in_entries || []), ...(summary?.out_entries || [])].filter(e => e.party === platform);
                  return (
                    <button
                      key={`PLATFORM:${platform}`}
                      onClick={() => setActiveTab(`PLATFORM:${platform}`)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
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
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeTab === 'OTHER' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100/50'
                      }`}
                    >
                      Other Entries ({otherCount})
                    </button>
                  );
                })()}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter narration, UPI, ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="glass-input w-full pl-9 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Complete Transaction Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Narration / Description</th>
                    <th className="py-3 px-4">Ref / Chq No</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-right">Balance (₹)</th>
                    <th className="py-3 px-4">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">No matching entries found</td>
                    </tr>
                  ) : (
                    displayEntries.map((tx, idx) => {
                      const isIN = tx.type === 'IN' || summary.in_entries.some(e => e.id === tx.id);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                          <td className="py-3 px-4 max-w-sm">
                            <div className="font-semibold text-slate-900 truncate" title={tx.narration}>
                              {tx.narration}
                            </div>
                            {tx.party && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block">
                                Party: {tx.party}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{tx.ref_no || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              isIN ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isIN ? 'IN (CREDIT)' : 'OUT (DEBIT)'}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-mono font-bold ${
                            isIN ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isIN ? `+ ₹${tx.amount.toLocaleString('en-IN')}` : `- ₹${tx.amount.toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            ₹{tx.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded text-[11px] font-medium border border-slate-200">
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
                    <tfoot className="bg-indigo-50/50 border-t-2 border-indigo-200">
                      <tr>
                        <td colSpan={4} className="py-4 px-4 text-right uppercase text-indigo-900 font-black text-xs tracking-wider">
                          TOTALS FOR {totalsHeader}:
                        </td>
                        <td className="py-4 px-4 text-right text-emerald-700 font-bold font-mono text-sm">
                          + ₹{totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right text-rose-700 font-bold font-mono text-sm">
                          - ₹{totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4"></td>
                      </tr>
                      <tr className="border-t border-indigo-100">
                        <td colSpan={4} className="py-4 px-4 text-right uppercase text-slate-500 font-bold text-xs tracking-wider">
                          {netHeader}:
                        </td>
                        <td colSpan={2} className={`py-4 px-4 text-right font-black font-mono text-base ${netVal >= 0 ? 'text-indigo-900' : 'text-rose-700'}`}>
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
