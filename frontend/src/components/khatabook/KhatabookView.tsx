import { useEffect, useState } from 'react';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Send,
  MessageSquare,
  FileSpreadsheet,
  Building2,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  X,
  Upload,
  Trash2,
  FileText,
  Check,
  Camera,
  Image,
  Eye
} from 'lucide-react';
import { api } from '../../api/client';
import type { KhatabookAccount, KhatabookEntry, KhatabookSummary } from '../../types';

export function KhatabookView() {
  const [summary, setSummary] = useState<KhatabookSummary>({
    total_give: 0,
    total_get: 0,
    accounts_count: 0
  });
  const [accounts, setAccounts] = useState<KhatabookAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<KhatabookAccount | null>(null);
  const [entries, setEntries] = useState<KhatabookEntry[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'give' | 'get'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'oldest'>('recent');

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Slide-Over Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KhatabookEntry | null>(null);
  const [drawerType, setDrawerType] = useState<'GAVE' | 'GOT'>('GAVE');

  // Form Fields
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBillFile, setFormBillFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Screenshots State
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [screenshotsList, setScreenshotsList] = useState<any[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [viewingScreenshotUrl, setViewingScreenshotUrl] = useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null);

  const loadScreenshots = async () => {
    setLoadingScreenshots(true);
    try {
      const data = await api.getKhatabookScreenshots();
      setScreenshotsList(data);
    } catch (e) {
      console.error('Failed to load screenshots', e);
    } finally {
      setLoadingScreenshots(false);
    }
  };

  const handleDeleteScreenshot = async (screenshotId: number) => {
    if (!confirm("Are you sure you want to delete this screenshot? This will also remove it from the store holder's device.")) return;
    try {
      await api.deleteUPIScreenshot(screenshotId);
      loadScreenshots();
    } catch (e: any) {
      alert(e.message || "Failed to delete screenshot");
    }
  };

  useEffect(() => {
    if (isLeftDrawerOpen) {
      loadScreenshots();
    }
  }, [isLeftDrawerOpen]);

  useEffect(() => {
    loadAccounts();
  }, [searchQuery, filterBy, sortBy]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const data = await api.getKhatabookAccounts({
        q: searchQuery,
        filter_by: filterBy,
        sort_by: sortBy
      });
      setSummary(data.summary);
      setAccounts(data.accounts);

      if (data.accounts.length > 0) {
        if (!selectedAccountId || !data.accounts.some(a => a.id === selectedAccountId)) {
          setSelectedAccountId(data.accounts[0].id);
        }
      } else {
        setSelectedAccountId(null);
        setSelectedAccount(null);
        setEntries([]);
      }
    } catch (e) {
      console.error('Failed to load Khatabook accounts', e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountEntries(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadAccountEntries = async (accId: number) => {
    setLoadingEntries(true);
    try {
      const res = await api.getKhatabookEntries(accId);
      setSelectedAccount(res.account);
      setEntries(res.entries);
    } catch (e) {
      console.error('Failed to load Khatabook entries', e);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleOpenAddDrawer = (type: 'GAVE' | 'GOT') => {
    setEditingEntry(null);
    setDrawerType(type);
    setFormAmount('');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormBillFile(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (entry: KhatabookEntry) => {
    setEditingEntry(entry);
    setDrawerType(entry.entry_type);
    setFormAmount(entry.amount.toString());
    setFormDescription(entry.description || '');
    setFormDate(entry.entry_date || new Date().toISOString().split('T')[0]);
    setFormBillFile(null);
    setIsDrawerOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('entry_type', drawerType);
      formData.append('amount', amt.toString());
      formData.append('description', formDescription);
      formData.append('entry_date', formDate);
      if (formBillFile) {
        formData.append('bill_file', formBillFile);
      }

      if (editingEntry) {
        await api.updateKhatabookEntry(editingEntry.id, formData);
      } else {
        await api.createKhatabookEntry(selectedAccountId, formData);
      }

      setIsDrawerOpen(false);
      await loadAccountEntries(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry || !selectedAccountId) return;
    if (!confirm('Are you sure you want to delete this entry?')) return;

    setSubmitting(true);
    try {
      await api.deleteKhatabookEntry(editingEntry.id);
      setIsDrawerOpen(false);
      await loadAccountEntries(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendWhatsAppReminder = (account: KhatabookAccount) => {
    const phone = account.phone_number ? account.phone_number.replace(/\D/g, '') : '';
    const message = encodeURIComponent(
      `Dear ${account.name},\nThis is a payment reminder for your account balance: ₹${account.net_balance.toLocaleString('en-IN')}.\nStatus: ${account.status}.\nThank you!`
    );
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  const handleSendSMSReminder = (account: KhatabookAccount) => {
    const phone = account.phone_number ? account.phone_number.replace(/\D/g, '') : '';
    const message = encodeURIComponent(
      `Dear ${account.name}, payment reminder balance: Rs.${account.net_balance}. Status: ${account.status}.`
    );
    if (phone) {
      window.open(`sms:${phone}?body=${message}`, '_blank');
    } else {
      alert(`Phone number not configured for ${account.name}`);
    }
  };

  return (
    <div className="space-y-6 pt-4 relative">
      {/* Top Header & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Give Card */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl p-5 shadow-lg shadow-rose-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingDown className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-100 flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4 bg-white/20 rounded-full p-0.5" />
              You'll Give
            </span>
            <span className="text-xs bg-white/20 text-white font-semibold px-2.5 py-0.5 rounded-full">
              Payables
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight">
              ₹{summary.total_give.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-rose-100 mt-2 flex items-center justify-between">
            <span>Total payables to suppliers</span>
            <button
              onClick={() => setFilterBy('give')}
              className="underline hover:text-white font-medium"
            >
              View Payables
            </button>
          </p>
        </div>

        {/* Total Get Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 bg-white/20 rounded-full p-0.5" />
              You'll Get
            </span>
            <span className="text-xs bg-white/20 text-white font-semibold px-2.5 py-0.5 rounded-full">
              Receivables
            </span>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight">
              ₹{summary.total_get.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs text-emerald-100 mt-2 flex items-center justify-between">
            <span>Total receivables from customers</span>
            <button
              onClick={() => setFilterBy('get')}
              className="underline hover:text-white font-medium"
            >
              View Receivables
            </button>
          </p>
        </div>

        {/* Ledger Overview */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Khatabook Ledger Status
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                {summary.accounts_count} Accounts
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{Math.abs(summary.total_get - summary.total_give).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-bold ${summary.total_get >= summary.total_give ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.total_get >= summary.total_give ? 'Net Positive Balance' : 'Net Payable Balance'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Manual Ledger Management</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLeftDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>UPI Screenshots</span>
              </button>
              <button
                onClick={loadAccounts}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Ledger</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dual-Pane Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Master Pane: Search, Filter, Account List */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[680px]">
          {/* Header Controls */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search for customers or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-xs"
              />
            </div>

            {/* Filter and Sort Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'give', label: "You'll Give" },
                  { id: 'get', label: "You'll Get" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterBy(tab.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                      filterBy === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="highest">Highest Amount</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Account Master List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingAccounts ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-xs">Loading ledger accounts...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full space-y-2">
                <Building2 className="w-8 h-8 text-slate-300" />
                <span className="text-xs font-medium">No accounts found</span>
              </div>
            ) : (
              accounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isGive = account.status === "YOU'LL GIVE";

                return (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`p-3.5 transition-all cursor-pointer flex items-center justify-between hover:bg-slate-50 ${
                      isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600 pl-2.5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs ${
                        isGive ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}>
                        {account.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          {account.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {account.last_activity_date}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-extrabold text-xs ${isGive ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ₹{account.abs_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 uppercase ${
                        isGive ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {account.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Pane: Account Ledger Entries & Actions */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[680px] relative">
          {selectedAccount ? (
            <>
              {/* Account Detail Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm ${
                    selectedAccount.status === "YOU'LL GIVE" ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}>
                    {selectedAccount.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      {selectedAccount.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Net Balance: <span className={`font-bold ${selectedAccount.status === "YOU'LL GIVE" ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedAccount.status}: ₹{selectedAccount.abs_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Reminder Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendWhatsAppReminder(selectedAccount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleSendSMSReminder(selectedAccount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>SMS</span>
                  </button>
                </div>
              </div>

              {/* Entries Table Header */}
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>ENTRIES</span>
                <div className="flex items-center gap-16 pr-4">
                  <span className="text-rose-600">YOU GAVE</span>
                  <span className="text-emerald-600">YOU GOT</span>
                </div>
              </div>

              {/* Ledger Entries List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingEntries ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-xs">Loading ledger entries...</span>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                    <FileSpreadsheet className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-xs font-medium">No ledger entries added yet.</span>
                    <p className="text-[11px] text-slate-400 mt-1">Use "You Gave ₹" or "You Got ₹" below to add entries.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => handleOpenEditDrawer(entry)}
                        className="p-3.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs group flex items-start justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">
                              {entry.formatted_date_time || entry.entry_date}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            Balance: ₹{entry.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          {entry.description && (
                            <div className="text-xs text-slate-700 font-medium pt-0.5 whitespace-pre-wrap">
                              {entry.description}
                            </div>
                          )}
                          {entry.bill_image_url && (
                            <a
                              href={entry.bill_image_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold pt-1"
                            >
                              <FileText className="w-3 h-3" /> View Attached Bill
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-12 pr-2 pt-1">
                          {/* YOU GAVE (Red) */}
                          <div className="text-right w-20">
                            {entry.you_gave > 0 ? (
                              <span className="font-extrabold text-sm text-rose-600">
                                ₹{entry.you_gave.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </div>

                          {/* YOU GOT (Green) */}
                          <div className="text-right w-20">
                            {entry.you_got > 0 ? (
                              <span className="font-extrabold text-sm text-emerald-600">
                                ₹{entry.you_got.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Action Controls: You Gave / You Got Buttons */}
              <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleOpenAddDrawer('GAVE')}
                  className="w-full py-3 px-4 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  <span>You Gave ₹</span>
                </button>
                <button
                  onClick={() => handleOpenAddDrawer('GOT')}
                  className="w-full py-3 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  <span>You Got ₹</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full space-y-3">
              <Building2 className="w-12 h-12 text-slate-300" />
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Select an account</h4>
                <p className="text-xs text-slate-400 mt-0.5">Click an account to view and manage entries</p>
              </div>
            </div>
          )}

          {/* Right Slide-Over Drawer Panel (Add / Edit Entry) */}
          {isDrawerOpen && (
            <div className="absolute inset-0 bg-black/40 z-50 flex justify-end transition-opacity animate-in fade-in">
              <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    {editingEntry ? '< Edit Entry' : drawerType === 'GAVE' ? 'Add New Entry (You Gave)' : 'Add New Entry (You Got)'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {editingEntry && (
                      <button
                        type="button"
                        onClick={handleDeleteEntry}
                        title="Delete Entry"
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Form Body */}
                <form id="entryForm" onSubmit={handleSaveEntry} className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Amount Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">₹</span>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Enter Amount"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Description Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Enter Details (Item Name, Bill No, Quantity, etc)"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    ></textarea>
                  </div>

                  {/* Date Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Attach Bill Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Attach Bill <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFormBillFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Upload className="w-7 h-7 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700">Click to upload</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Only PNG or JPG file format supported</span>
                      {formBillFile && (
                        <div className="mt-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {formBillFile.name}
                        </div>
                      )}
                    </label>
                  </div>
                </form>

                {/* Drawer Footer Save Button */}
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                  <button
                    type="submit"
                    form="entryForm"
                    disabled={submitting}
                    className={`w-full py-3 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${
                      drawerType === 'GAVE'
                        ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </span>
                    ) : (
                      <span>Save Entry</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Left Slide-Over Drawer (View UPI Screenshots) */}
      {isLeftDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-start transition-opacity animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200 relative border-r border-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" /> UPI Screenshots History
              </h3>
              <button
                onClick={() => setIsLeftDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingScreenshots ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-64">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-xs">Loading screenshots...</span>
                </div>
              ) : screenshotsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-64 space-y-2">
                  <Image className="w-10 h-10 text-slate-300" />
                  <h4 className="font-bold text-slate-700 text-xs">No screenshots found</h4>
                  <p className="text-[11px] text-slate-400">Account holders have not uploaded any UPI screenshots yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {screenshotsList.map((item) => {
                    const isExpanded = expandedAccountId === item.account_id;
                    return (
                      <div key={item.account_id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 transition-all">
                        {/* Account Accordion Header */}
                        <div
                          onClick={() => setExpandedAccountId(isExpanded ? null : item.account_id)}
                          className="p-4 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100"
                        >
                          <div>
                            <h4 className="font-black text-xs text-slate-900">{item.account_holder}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{item.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">
                              {item.screenshot_count} Screenshots
                            </span>
                            <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Screenshots List */}
                        {isExpanded && (
                          <div className="p-3 bg-slate-50/50 divide-y divide-slate-200/60 max-h-96 overflow-y-auto">
                            {item.screenshots.map((s: any) => (
                              <div key={s.id} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                                <div>
                                  <div className="font-bold text-slate-800">{s.upload_date}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold">{s.upload_time}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setViewingScreenshotUrl(s.image_url)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg border border-indigo-100 transition-all cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Screen</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteScreenshot(s.id)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-100 transition-all cursor-pointer"
                                    title="Delete Screenshot"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 font-medium">
              Only owners can view payment verification screenshots.
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Screenshot Image Modal View */}
      {viewingScreenshotUrl && (
        <div className="fixed inset-0 bg-black/75 z-55 flex items-center justify-center p-4 transition-opacity animate-in fade-in">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setViewingScreenshotUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 hover:bg-slate-900/80 text-white rounded-full transition-all cursor-pointer z-50"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable image container */}
            <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-2 min-h-96">
              <img
                src={viewingScreenshotUrl}
                alt="UPI Receipt Full Size"
                className="max-w-full max-h-[70vh] object-contain shadow-md rounded-lg"
              />
            </div>

            {/* Footer metadata */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs">
              <span className="font-extrabold text-slate-800">UPI Payment Receipt Screenshot</span>
              <a
                href={viewingScreenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-extrabold underline"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
