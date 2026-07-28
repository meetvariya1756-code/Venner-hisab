import React, { useEffect, useState } from 'react';
import type { Transaction, Category, Party, BankAccount } from '../../types';
import { api } from '../../api/client';
import { Search, Download, AlertCircle, BookmarkPlus } from 'lucide-react';

interface TransactionsViewProps {
  initialFilters?: { category_id?: number; search?: string; is_categorized?: boolean };
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ initialFilters }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialFilters?.search || '');
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(initialFilters?.category_id);
  const [uncategorizedOnly, setUncategorizedOnly] = useState<boolean>(initialFilters?.is_categorized === false);

  // Rule Creation Modal State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState<number>(0);
  const [rulePartyId, setRulePartyId] = useState<number>(0);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [search, selectedAccountId, selectedCategoryId, uncategorizedOnly]);

  const loadMeta = async () => {
    try {
      const [cats, prts, accs] = await Promise.all([
        api.getCategories(),
        api.getParties(),
        api.getAccounts()
      ]);
      setCategories(cats);
      setParties(prts);
      setAccounts(accs);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions({
        search: search || undefined,
        account_id: selectedAccountId,
        category_id: selectedCategoryId,
        is_categorized: uncategorizedOnly ? false : undefined
      });
      setTransactions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineCategorize = async (txId: number, categoryId: number) => {
    try {
      await api.updateTransaction(txId, { category_id: categoryId });
      loadTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  const openRuleModal = (tx: Transaction) => {
    setEditingTx(tx);
    // Suggest keyword pattern from narration (first 2 words)
    const words = tx.narration.split(' ').slice(0, 3).join(' ');
    setRulePattern(words);
    setRuleCategoryId(tx.category_id || categories[0]?.id || 0);
    setRulePartyId(tx.party_id || 0);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    try {
      await api.updateTransaction(editingTx.id, {
        category_id: ruleCategoryId,
        party_id: rulePartyId || undefined,
        create_rule: true,
        pattern: rulePattern,
        rule_name: `Rule: ${rulePattern}`
      });
      setEditingTx(null);
      loadTransactions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Transaction Ledger & Categorization Queue
          </h2>
          <p className="text-xs text-slate-500">Review, categorize, and export normalized transactions</p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.getExportUrl('xlsx', selectedAccountId, selectedCategoryId)}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel (.xlsx)
          </a>
          <a
            href={api.getExportUrl('csv', selectedAccountId, selectedCategoryId)}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search narration, reference number, UPI ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-9"
          />
        </div>

        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : undefined)}
          className="glass-input bg-white"
        >
          <option value="">All Bank Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.bank_name})</option>
          ))}
        </select>

        <select
          value={selectedCategoryId || ''}
          onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="glass-input bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => setUncategorizedOnly(!uncategorizedOnly)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
            uncategorizedOnly
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-white text-slate-500 border-slate-200 hover:text-white'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Review Queue (Uncategorized)
        </button>
      </div>

      {/* Transactions Grid */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No matching transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Narration / Description</th>
                  <th className="py-3.5 px-4">Ref / Chq No</th>
                  <th className="py-3.5 px-4 text-right">Debit (Dr)</th>
                  <th className="py-3.5 px-4 text-right">Credit (Cr)</th>
                  <th className="py-3.5 px-4 text-right">Balance</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-slate-50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-100 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900 truncate" title={tx.narration}>
                        {tx.narration}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Stmt Pg {tx.page_number}</span>
                        {tx.party_name && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                            Party: {tx.party_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {tx.ref_no || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-rose-400">
                      {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                      {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ₹{tx.balance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={tx.category_id || ''}
                        onChange={(e) => handleInlineCategorize(tx.id, Number(e.target.value))}
                        className={`text-xs rounded-lg px-2 py-1 font-semibold border ${
                          tx.category_id
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="" className="bg-white text-slate-600">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id} className="bg-white text-slate-800">{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openRuleModal(tx)}
                        title="Save as Rule for Future Imports"
                        className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
                      >
                        <BookmarkPlus className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rule Creator Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-indigo-400" />
              Create Auto-Categorization Rule
            </h3>
            <p className="text-xs text-slate-500">
              Future statement imports containing this narration pattern will automatically map to this category.
            </p>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Narration Pattern (Keyword)</label>
                <input
                  type="text"
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  className="glass-input w-full font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Category</label>
                <select
                  value={ruleCategoryId}
                  onChange={(e) => setRuleCategoryId(Number(e.target.value))}
                  className="glass-input w-full bg-white"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Associate Party (Optional)</label>
                <select
                  value={rulePartyId}
                  onChange={(e) => setRulePartyId(Number(e.target.value))}
                  className="glass-input w-full bg-white"
                >
                  <option value={0}>None</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  Save & Apply Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
