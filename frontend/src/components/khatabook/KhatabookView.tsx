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
  Check,
  Camera,
  Image,
  Eye,
  Download,
  FileText,
  QrCode,
  Copy,
  Sliders,
  AlertTriangle,
  Sparkles,
  Clock,
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
  const [showAllStatement, setShowAllStatement] = useState(false);
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
  const [formDate, setFormDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [formBillFile, setFormBillFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Screenshots State
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [screenshotsList, setScreenshotsList] = useState<any[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);
  const [viewingScreenshotUrl, setViewingScreenshotUrl] = useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null);
  const [screenshotGroupBy, setScreenshotGroupBy] = useState<'account' | 'month' | 'day'>('account');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedSubKey, setExpandedSubKey] = useState<string | null>(null);

  // Download PDF Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<'selected' | 'all'>('selected');
  const [pdfPeriodType, setPdfPeriodType] = useState<'month' | 'year' | 'custom'>('month');
  const [pdfYear, setPdfYear] = useState<number>(() => new Date().getFullYear());
  const [pdfMonth, setPdfMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [pdfStartDate, setPdfStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [pdfEndDate, setPdfEndDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Account Settings Modal State (Credit Limits, Due Dates, UPI ID)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsCreditLimit, setSettingsCreditLimit] = useState('');
  const [settingsDueDate, setSettingsDueDate] = useState('');
  const [settingsUpiId, setSettingsUpiId] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // UPI QR Code & Share Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);

  // Smart OCR / Receipt Extraction State
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);
  const [ocrDetectedMsg, setOcrDetectedMsg] = useState<string | null>(null);
  const handleDownloadLedgerPDF = async () => {
    setIsDownloadingPdf(true);
    try {
      const targetAccId = pdfScope === 'all' || !selectedAccount ? null : selectedAccount.id;
      await api.downloadKhatabookPDF({
        accountId: targetAccId,
        periodType: pdfPeriodType,
        year: pdfYear,
        month: pdfMonth,
        startDate: pdfStartDate,
        endDate: pdfEndDate,
      });
      setIsPdfModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF ledger');
    } finally {
      setIsDownloadingPdf(false);
    }
  };


  const handleOpenSettingsModal = (acc: KhatabookAccount) => {
    setSettingsCreditLimit(acc.credit_limit ? acc.credit_limit.toString() : '');
    setSettingsDueDate(acc.due_date || '');
    setSettingsUpiId(acc.upi_id || '');
    setSettingsPhone(acc.phone_number || '');
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setSavingSettings(true);
    try {
      await api.updateKhatabookAccountSettings(selectedAccount.id, {
        credit_limit: settingsCreditLimit ? parseFloat(settingsCreditLimit) : 0,
        due_date: settingsDueDate || null,
        upi_id: settingsUpiId || null,
        phone_number: settingsPhone || null,
      });
      setIsSettingsModalOpen(false);
      await loadAccounts();
      if (selectedAccountId) await loadAccountEntries(selectedAccountId);
    } catch (err: any) {
      alert(err.message || 'Failed to save account settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBillFileChange = async (file: File | null) => {
    setFormBillFile(file);
    setOcrDetectedMsg(null);
    if (!file) return;

    setIsParsingReceipt(true);
    try {
      const ocrRes = await api.parseBillReceipt(file);
      if (ocrRes.success && ocrRes.detected_amount) {
        if (!formAmount || formAmount === '0') {
          setFormAmount(ocrRes.detected_amount.toString());
        }
        if (ocrRes.detected_date) {
          setFormDate(ocrRes.detected_date);
        }
        setOcrDetectedMsg(`Detected ₹${ocrRes.detected_amount.toLocaleString('en-IN')}`);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsParsingReceipt(false);
    }
  };

  const getWhatsAppSlipText = (acc: KhatabookAccount) => {
    const isGive = acc.status === "YOU'LL GIVE";
    const statusLine = isGive 
      ? `We owe you: ₹${acc.abs_net.toLocaleString('en-IN')}` 
      : `Payment due: ₹${acc.abs_net.toLocaleString('en-IN')}`;
    const dueLine = acc.due_date ? `\nPayment Due Date: ${acc.due_date}` : '';
    const upiLine = acc.upi_id ? `\nPay via UPI ID: ${acc.upi_id}` : '';
    
    return `*Venner Hisab Statement*\n` +
           `Customer / Store: *${acc.name}*\n` +
           `Net Balance: *₹${acc.abs_net.toLocaleString('en-IN')}*\n` +
           `Status: *${statusLine}*${dueLine}${upiLine}\n\n` +
           `Please review your ledger and confirm. Thank you!`;
  };

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

  // Flatten all screenshots with account details
  const getFlattenedScreenshots = () => {
    const list: any[] = [];
    screenshotsList.forEach(item => {
      if (item.screenshots) {
        item.screenshots.forEach((s: any) => {
          list.push({
            ...s,
            account_id: item.account_id,
            name: item.name,
            account_holder: item.account_holder
          });
        });
      }
    });
    return list;
  };

  const getMonthName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[monthNum - 1]} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getDayLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[monthNum - 1]} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Group by Month Helper
  const getGroupedByMonth = () => {
    const flattened = getFlattenedScreenshots();
    const groups: { [month: string]: { [accountId: number]: { account_id: number, name: string, account_holder: string, screenshots: any[] } } } = {};

    flattened.forEach(s => {
      const monthLabel = getMonthName(s.upload_date);
      if (!groups[monthLabel]) groups[monthLabel] = {};
      if (!groups[monthLabel][s.account_id]) {
        groups[monthLabel][s.account_id] = {
          account_id: s.account_id,
          name: s.name,
          account_holder: s.account_holder,
          screenshots: []
        };
      }
      groups[monthLabel][s.account_id].screenshots.push(s);
    });

    // Sort months descending
    return Object.keys(groups).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    }).map(month => {
      const accounts = Object.values(groups[month]).map(acc => ({
        ...acc,
        screenshot_count: acc.screenshots.length
      }));
      const totalCount = accounts.reduce((sum, item) => sum + item.screenshot_count, 0);
      return {
        month,
        totalCount,
        accounts
      };
    });
  };

  // Group by Day Helper
  const getGroupedByDay = () => {
    const flattened = getFlattenedScreenshots();
    const groups: { [day: string]: { [accountId: number]: { account_id: number, name: string, account_holder: string, screenshots: any[] } } } = {};

    flattened.forEach(s => {
      const dayLabel = getDayLabel(s.upload_date);
      if (!groups[dayLabel]) groups[dayLabel] = {};
      if (!groups[dayLabel][s.account_id]) {
        groups[dayLabel][s.account_id] = {
          account_id: s.account_id,
          name: s.name,
          account_holder: s.account_holder,
          screenshots: []
        };
      }
      groups[dayLabel][s.account_id].screenshots.push(s);
    });

    // Sort days descending
    return Object.keys(groups).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    }).map(day => {
      const accounts = Object.values(groups[day]).map(acc => ({
        ...acc,
        screenshot_count: acc.screenshots.length
      }));
      const totalCount = accounts.reduce((sum, item) => sum + item.screenshot_count, 0);
      return {
        day,
        totalCount,
        accounts
      };
    });
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
        if (selectedAccountId && !data.accounts.some(a => a.id === selectedAccountId)) {
          setSelectedAccountId(null);
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
    setFormDate(new Date().toLocaleDateString('en-CA'));
    setFormBillFile(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (entry: KhatabookEntry) => {
    setEditingEntry(entry);
    setDrawerType(entry.entry_type);
    setFormAmount(entry.amount.toString());
    setFormDescription(entry.description || '');
    setFormDate(entry.entry_date || new Date().toLocaleDateString('en-CA'));
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

  const activeAccount = selectedAccountId ? accounts.find(a => a.id === selectedAccountId) : null;
  const displayGive = activeAccount ? activeAccount.total_out : summary.total_give;
  const displayGet = activeAccount ? activeAccount.total_in : summary.total_get;
  const displayNet = activeAccount ? activeAccount.abs_net : Math.abs(summary.total_get - summary.total_give);
  const isNetPositive = activeAccount ? activeAccount.status === "YOU'LL GET" : summary.total_get >= summary.total_give;
  const displayStatus = activeAccount 
    ? (activeAccount.status === "YOU'LL GET" ? 'Net Positive Balance' : 'Net Payable Balance')
    : (summary.total_get >= summary.total_give ? 'Net Positive Balance' : 'Net Payable Balance');

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
              ₹{displayGive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
              ₹{displayGet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                {selectedAccountId ? '1 Account Selected' : `${summary.accounts_count} Accounts`}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ₹{displayNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-bold ${isNetPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {displayStatus}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => {
                setPdfScope(selectedAccount ? 'selected' : 'all');
                setIsPdfModalOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              title="Download Khatabook PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => setIsLeftDrawerOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              title="View UPI Screenshots"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Screenshots</span>
            </button>
            <button
              onClick={loadAccounts}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-all shadow-2xs hover:shadow-xs cursor-pointer"
              title="Refresh Ledger Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dual-Pane Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Master Pane: Search, Filter, Account List */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:h-[760px] h-[480px]">
          {/* Header Controls */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
            {/* All Account Statement Button */}
            <button
              onClick={() => {
                setShowAllStatement(true);
                setSelectedAccountId(null);
                setSelectedAccount(null);
                setEntries([]);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                showAllStatement && selectedAccountId === null
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                  : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${
                  showAllStatement && selectedAccountId === null ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  ALL
                </div>
                <span>All Account Statement</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold ${showAllStatement && selectedAccountId === null ? 'text-rose-200' : 'text-rose-500'}`}>Give</span>
                  <span className={`text-[10px] font-black ${showAllStatement && selectedAccountId === null ? 'text-white' : 'text-slate-800'}`}>₹{summary.total_give.toLocaleString('en-IN')}</span>
                </div>
                <span className={showAllStatement && selectedAccountId === null ? 'text-white/30' : 'text-slate-300'}>|</span>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold ${showAllStatement && selectedAccountId === null ? 'text-emerald-200' : 'text-emerald-600'}`}>Get</span>
                  <span className={`text-[10px] font-black ${showAllStatement && selectedAccountId === null ? 'text-white' : 'text-slate-800'}`}>₹{summary.total_get.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </button>

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
              <>
                {accounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isGive = account.status === "YOU'LL GIVE";

                return (
                  <div
                    key={account.id}
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setShowAllStatement(false);
                    }}
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
                          {account.is_overdue && (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue {account.days_overdue}d
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {account.last_activity_date}
                          </span>
                          {account.credit_limit && account.credit_limit > 0 && (
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Limit: ₹{account.credit_limit.toLocaleString('en-IN')}
                            </span>
                          )}
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
              })}
              </>
            )}
          </div>
        </div>

        {/* Right Detail Pane: Account Ledger Entries & Actions */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:h-[760px] min-h-[500px] relative">
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
                      <button
                        onClick={() => handleOpenSettingsModal(selectedAccount)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Credit Limits & Due Date"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Net Balance: <span className={`font-bold ${selectedAccount.status === "YOU'LL GIVE" ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {selectedAccount.status}: ₹{selectedAccount.abs_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPdfScope('selected');
                      setIsPdfModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    title="Download Ledger PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    onClick={() => handleSendWhatsAppReminder(selectedAccount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleSendSMSReminder(selectedAccount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>SMS</span>
                  </button>
                </div>
              </div>

              {/* Credit Limit & Overdue Banner (if configured) */}
              {(selectedAccount.credit_limit || selectedAccount.due_date) && (
                <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    {selectedAccount.credit_limit && selectedAccount.credit_limit > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Credit Limit:</span>
                        <span className="font-extrabold text-slate-800">
                          ₹{selectedAccount.credit_limit.toLocaleString('en-IN')}
                        </span>
                        <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              (selectedAccount.credit_used_percent || 0) > 90 ? 'bg-rose-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, selectedAccount.credit_used_percent || 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold">{selectedAccount.credit_used_percent || 0}% used</span>
                      </div>
                    ) : null}

                    {selectedAccount.due_date ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-semibold">Due Date:</span>
                        <span className={`font-bold ${selectedAccount.is_overdue ? 'text-rose-600' : 'text-slate-800'}`}>
                          {selectedAccount.due_date}
                        </span>
                        {selectedAccount.is_overdue && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-black uppercase">
                            Overdue {selectedAccount.days_overdue} Days
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleOpenSettingsModal(selectedAccount)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                  >
                    Edit Limits
                  </button>
                </div>
              )}

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
                            <div className="pt-2 flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Receipt Screenshot:</span>
                              <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer relative group bg-slate-50">
                                <img
                                  src={entry.bill_image_url}
                                  alt="Receipt Attachment"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingScreenshotUrl(entry.bill_image_url ?? null);
                                  }}
                                  className="w-full h-full object-cover transition-opacity hover:opacity-90"
                                />
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingScreenshotUrl(entry.bill_image_url ?? null);
                                  }}
                                  className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                >
                                  <Eye className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
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
          ) : showAllStatement ? (
            /* ── All Account Statement Panel ─────────────────── */
            <div className="p-6 overflow-y-auto h-full flex flex-col gap-5">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">All Account Statement</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Combined Give & Get totals across all accounts</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPdfScope('all');
                      setIsPdfModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All PDF</span>
                  </button>
                  <span className="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">
                    {accounts.length} Accounts
                  </span>
                </div>
              </div>

              {/* Summary Give / Get Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Total Give */}
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Total Give</span>
                  </div>
                  <span className="text-2xl font-extrabold text-rose-600 mt-1">
                    ₹{summary.total_give.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-rose-400 font-medium">You owe to others</p>
                </div>

                {/* Total Get */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Total Get</span>
                  </div>
                  <span className="text-2xl font-extrabold text-emerald-600 mt-1">
                    ₹{summary.total_get.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-emerald-400 font-medium">Others owe to you</p>
                </div>
              </div>

              {/* Net Balance */}
              <div className={`rounded-2xl p-4 border flex items-center justify-between ${
                summary.total_get >= summary.total_give
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Net Balance</p>
                  <span className={`text-xl font-extrabold ${
                    summary.total_get >= summary.total_give ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    ₹{Math.abs(summary.total_get - summary.total_give).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-full ${
                  summary.total_get >= summary.total_give
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}>
                  {summary.total_get >= summary.total_give ? "YOU'LL GET" : "YOU'LL GIVE"}
                </span>
              </div>

              {/* Per-Account Breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider">Account-wise Breakdown</h4>
                {accounts.map(account => {
                  const isGive = account.status === "YOU'LL GIVE";
                  return (
                    <div
                      key={account.id}
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        setShowAllStatement(false);
                      }}
                      className="p-3.5 border border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                          isGive ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}>
                          {account.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h5 className="font-black text-xs text-slate-800">{account.name}</h5>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-rose-500 font-semibold">Give: ₹{account.total_out.toLocaleString('en-IN')}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-[10px] text-emerald-600 font-semibold">Get: ₹{account.total_in.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-extrabold text-xs ${isGive ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{account.abs_net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <p className={`text-[9px] font-black uppercase mt-0.5 ${isGive ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {account.status}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Default: No account selected, no all statement ─ */
            <div className="p-6 h-full flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Select an Account</h3>
                <p className="text-xs text-slate-500 mt-1">Click on any account on the left to view its ledger entries, or use the <span className="font-bold text-indigo-600">All Account Statement</span> button to see the combined totals.</p>
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

                  {/* Attach Bill Dropzone with Smart OCR */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Attach Bill / Receipt Photo</span>
                      {isParsingReceipt && (
                        <span className="text-indigo-600 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-3 h-3" /> Auto-detecting details...
                        </span>
                      )}
                    </label>
                    <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/30">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBillFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Upload className="w-7 h-7 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700">Click to upload receipt</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Auto-fills amount & date from photo</span>
                      {formBillFile && (
                        <div className="mt-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {formBillFile.name}
                        </div>
                      )}
                      {ocrDetectedMsg && (
                        <div className="mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {ocrDetectedMsg}
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

            {/* Group By Filter */}
            <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500">Group By:</span>
              <div className="flex bg-slate-200/60 rounded-xl p-0.5 border border-slate-200/30">
                <button
                  onClick={() => setScreenshotGroupBy('account')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    screenshotGroupBy === 'account' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Account
                </button>
                <button
                  onClick={() => setScreenshotGroupBy('month')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    screenshotGroupBy === 'month' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setScreenshotGroupBy('day')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    screenshotGroupBy === 'day' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Day
                </button>
              </div>
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
                  {/* ACCOUNT-WISE GROUPING */}
                  {screenshotGroupBy === 'account' && screenshotsList.map((item) => {
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
                                  {s.description && (
                                    <div className="text-[11px] font-semibold text-indigo-900 mt-1 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-md max-w-[220px] truncate" title={s.description}>
                                      {s.description}
                                    </div>
                                  )}
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

                  {/* MONTH-WISE GROUPING */}
                  {screenshotGroupBy === 'month' && getGroupedByMonth().map((item) => {
                    const isMonthExpanded = expandedMonth === item.month;
                    return (
                      <div key={item.month} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 transition-all mb-3">
                        {/* Month Accordion Header */}
                        <div
                          onClick={() => setExpandedMonth(isMonthExpanded ? null : item.month)}
                          className="p-4 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100"
                        >
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900">{item.month}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                              {item.totalCount} Screenshots
                            </span>
                            <span className="text-slate-400 text-xs">{isMonthExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Accounts List for Month */}
                        {isMonthExpanded && (
                          <div className="p-3 bg-slate-50/50 space-y-2 max-h-96 overflow-y-auto">
                            {item.accounts.map((acc) => {
                              const subKey = `${item.month}_${acc.account_id}`;
                              const isSubExpanded = expandedSubKey === subKey;
                              return (
                                <div key={acc.account_id} className="border border-slate-200/60 rounded-xl bg-white overflow-hidden">
                                  <div
                                    onClick={() => setExpandedSubKey(isSubExpanded ? null : subKey)}
                                    className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100"
                                  >
                                    <div>
                                      <h5 className="font-black text-xs text-slate-800">{acc.account_holder}</h5>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{acc.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black">
                                        {acc.screenshot_count} Screenshots
                                      </span>
                                      <span className="text-slate-400 text-[10px]">{isSubExpanded ? '▲' : '▼'}</span>
                                    </div>
                                  </div>

                                  {/* Screenshots for Account under Month */}
                                  {isSubExpanded && (
                                    <div className="p-2 bg-slate-50/50 divide-y divide-slate-200/40">
                                      {acc.screenshots.map((s: any) => (
                                        <div key={s.id} className="py-2 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                                          <div>
                                            <div className="font-bold text-slate-800">{s.upload_date}</div>
                                            <div className="text-[10px] text-slate-400 font-semibold">{s.upload_time}</div>
                                            {s.description && (
                                              <div className="text-[11px] font-semibold text-indigo-900 mt-1 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-md max-w-[220px] truncate" title={s.description}>
                                                {s.description}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => setViewingScreenshotUrl(s.image_url)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg border border-indigo-100 transition-all cursor-pointer"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              <span>View</span>
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
                    );
                  })}

                  {/* DAY-WISE GROUPING */}
                  {screenshotGroupBy === 'day' && getGroupedByDay().map((item) => {
                    const isDayExpanded = expandedDay === item.day;
                    return (
                      <div key={item.day} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 transition-all mb-3">
                        {/* Day Accordion Header */}
                        <div
                          onClick={() => setExpandedDay(isDayExpanded ? null : item.day)}
                          className="p-4 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100"
                        >
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900">{item.day}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">
                              {item.totalCount} Screenshots
                            </span>
                            <span className="text-slate-400 text-xs">{isDayExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Accounts List for Day */}
                        {isDayExpanded && (
                          <div className="p-3 bg-slate-50/50 space-y-2 max-h-96 overflow-y-auto">
                            {item.accounts.map((acc) => {
                              const subKey = `${item.day}_${acc.account_id}`;
                              const isSubExpanded = expandedSubKey === subKey;
                              return (
                                <div key={acc.account_id} className="border border-slate-200/60 rounded-xl bg-white overflow-hidden">
                                  <div
                                    onClick={() => setExpandedSubKey(isSubExpanded ? null : subKey)}
                                    className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-b border-slate-100"
                                  >
                                    <div>
                                      <h5 className="font-black text-xs text-slate-800">{acc.account_holder}</h5>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{acc.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black">
                                        {acc.screenshot_count} Screenshots
                                      </span>
                                      <span className="text-slate-400 text-[10px]">{isSubExpanded ? '▲' : '▼'}</span>
                                    </div>
                                  </div>

                                  {/* Screenshots for Account under Day */}
                                  {isSubExpanded && (
                                    <div className="p-2 bg-slate-50/50 divide-y divide-slate-200/40">
                                      {acc.screenshots.map((s: any) => (
                                        <div key={s.id} className="py-2 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                                          <div>
                                            <div className="font-bold text-slate-800">{s.upload_date}</div>
                                            <div className="text-[10px] text-slate-400 font-semibold">{s.upload_time}</div>
                                            {s.description && (
                                              <div className="text-[11px] font-semibold text-indigo-900 mt-1 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-md max-w-[220px] truncate" title={s.description}>
                                                {s.description}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => setViewingScreenshotUrl(s.image_url)}
                                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg border border-indigo-100 transition-all cursor-pointer"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              <span>View</span>
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

      {/* ── Download Ledger PDF Modal ─────────────────────────────── */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-rose-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Download Khatabook PDF</h3>
                  <p className="text-xs text-rose-100">Monthly, Yearly, or Custom Ledger Statement</p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Account Scope Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Account Scope
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPdfScope('selected')}
                    disabled={!selectedAccount}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      pdfScope === 'selected' && selectedAccount
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span>{selectedAccount ? selectedAccount.name : 'Select Account'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfScope('all')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      pdfScope === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All Accounts ({accounts.length})</span>
                  </button>
                </div>
              </div>

              {/* Period Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Select Statement Period
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-center">
                  {[
                    { id: 'month', label: 'Monthly' },
                    { id: 'year', label: 'Yearly' },
                    { id: 'custom', label: 'Custom' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPdfPeriodType(tab.id as any)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        pdfPeriodType === tab.id
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly Inputs */}
              {pdfPeriodType === 'month' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Month</label>
                    <select
                      value={pdfMonth}
                      onChange={(e) => setPdfMonth(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {[
                        { num: 1, name: 'January' },
                        { num: 2, name: 'February' },
                        { num: 3, name: 'March' },
                        { num: 4, name: 'April' },
                        { num: 5, name: 'May' },
                        { num: 6, name: 'June' },
                        { num: 7, name: 'July' },
                        { num: 8, name: 'August' },
                        { num: 9, name: 'September' },
                        { num: 10, name: 'October' },
                        { num: 11, name: 'November' },
                        { num: 12, name: 'December' },
                      ].map(m => (
                        <option key={m.num} value={m.num}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Year</label>
                    <select
                      value={pdfYear}
                      onChange={(e) => setPdfYear(Number(e.target.value))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {[2027, 2026, 2025, 2024, 2023].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Yearly Inputs */}
              {pdfPeriodType === 'year' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Year</label>
                  <select
                    value={pdfYear}
                    onChange={(e) => setPdfYear(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {[2027, 2026, 2025, 2024, 2023].map(y => (
                      <option key={y} value={y}>Full Calendar Year {y}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom Date Range Inputs */}
              {pdfPeriodType === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">From Date</label>
                    <input
                      type="date"
                      value={pdfStartDate}
                      onChange={(e) => setPdfStartDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">To Date</label>
                    <input
                      type="date"
                      value={pdfEndDate}
                      onChange={(e) => setPdfEndDate(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Preview Summary Note */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Report Scope:</span>
                <span className="font-extrabold text-slate-900">
                  {pdfScope === 'all' ? 'All Accounts Combined' : (selectedAccount?.name || 'Selected Account')}
                  {' • '}
                  {pdfPeriodType === 'month' && `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][pdfMonth - 1]} ${pdfYear}`}
                  {pdfPeriodType === 'year' && `Year ${pdfYear}`}
                  {pdfPeriodType === 'custom' && `${pdfStartDate} to ${pdfEndDate}`}
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                disabled={isDownloadingPdf}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadLedgerPDF}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-rose-200 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDownloadingPdf ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── UPI Payment QR & WhatsApp Slip Modal ───────────────── */}
      {isQrModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">UPI Payment & WhatsApp Slip</h3>
                  <p className="text-xs text-indigo-100">{selectedAccount.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-center">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 inline-block mx-auto shadow-inner">
                {/* Dynamic QR Code for UPI Intent */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    `upi://pay?pa=${selectedAccount.upi_id || 'venner@okhdfcbank'}&pn=${encodeURIComponent(
                      selectedAccount.name
                    )}&am=${selectedAccount.abs_net}&cu=INR&tn=${encodeURIComponent('Venner Hisab Settlement')}`
                  )}`}
                  alt="UPI Payment QR Code"
                  className="w-44 h-44 mx-auto rounded-lg"
                />
                <p className="text-[11px] font-extrabold text-slate-700 mt-2">
                  Scan to Pay ₹{selectedAccount.abs_net.toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-slate-400">
                  UPI ID: {selectedAccount.upi_id || 'venner@okhdfcbank'}
                </span>
              </div>

              {/* Formatted WhatsApp Slip Preview */}
              <div className="text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap">
                {getWhatsAppSlipText(selectedAccount)}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getWhatsAppSlipText(selectedAccount));
                  setCopiedSlip(true);
                  setTimeout(() => setCopiedSlip(false), 2000);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedSlip ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSlip ? 'Copied Slip!' : 'Copy Slip'}</span>
              </button>
              <button
                onClick={() => handleSendWhatsAppReminder(selectedAccount)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Account Settings Modal ───────────────────────── */}
      {isSettingsModalOpen && selectedAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-700 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Account & Credit Settings</h3>
                  <p className="text-xs text-indigo-100">{selectedAccount.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Credit Limit (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={settingsCreditLimit}
                  onChange={(e) => setSettingsCreditLimit(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Set maximum allowable credit balance for this customer.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={settingsDueDate}
                  onChange={(e) => setSettingsDueDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Overdue warnings will trigger if unpaid after this date.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Vendor UPI ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. customer@okhdfcbank"
                  value={settingsUpiId}
                  onChange={(e) => setSettingsUpiId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Used for 1-click UPI QR Code generation.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
