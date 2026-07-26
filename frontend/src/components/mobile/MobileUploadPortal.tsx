import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { BankAccount } from '../../types';
import { Smartphone, CheckCircle2, AlertCircle, FileText, KeyRound, ArrowRight, Building2, User } from 'lucide-react';

export const MobileUploadPortal: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [yearMonth, setYearMonth] = useState<string>('2026-02');
  const [uploaderName, setUploaderName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
      if (data.length > 0) {
        setSelectedAccountId(data[0].id);
        setUploaderName(data[0].account_holder || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAccountChange = (id: number) => {
    setSelectedAccountId(id);
    const acc = accounts.find(a => a.id === id);
    if (acc) {
      setUploaderName(acc.account_holder || '');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedAccountId) {
      setError('Please select your store account and PDF file.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('account_id', selectedAccountId.toString());
    formData.append('year_month', yearMonth);
    formData.append('file', file);
    if (password) formData.append('password', password);
    if (uploaderName) formData.append('uploader_name', uploaderName);

    try {
      const res = await api.mobileUploadStatement(formData);
      setUploadSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Failed to upload statement.');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 selection:bg-indigo-600 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Mobile Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white text-center relative">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/20">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">Store Statement Upload Portal</h1>
          <p className="text-xs text-indigo-100 mt-1">Upload your monthly bank statement PDF directly from your phone</p>
        </div>

        {/* Portal Body */}
        <div className="p-6 space-y-5 flex-1">
          {uploadSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Upload Completed & Synced!</h2>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                {uploadSuccess.message}
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Store:</span>
                  <span className="font-bold text-slate-900">{selectedAccount?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transactions Extracted:</span>
                  <span className="font-bold text-slate-900">{uploadSuccess.transaction_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Received (IN):</span>
                  <span className="font-bold text-emerald-700">₹{uploadSuccess.total_in.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Paid (OUT):</span>
                  <span className="font-bold text-rose-700">₹{uploadSuccess.total_out.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setUploadSuccess(null);
                  setFile(null);
                  setPassword('');
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold text-xs shadow-md transition-all mt-4"
              >
                Upload Another Statement
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>{error}</div>
                </div>
              )}

              {/* Step 1: Select Store Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" /> Select Store Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank_name} - {acc.masked_account_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Statement Month */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Statement Period (Month)
                </label>
                <input
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              {/* Step 3: Your Name / Account Holder */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" /> Your Name (Account Holder)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prajapati Kiritbhai"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Step 4: Pick PDF File */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Statement PDF File
                </label>
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl p-5 text-center transition-all">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="mobile-pdf-file"
                  />
                  <label htmlFor="mobile-pdf-file" className="cursor-pointer flex flex-col items-center gap-1.5">
                    <FileText className="w-8 h-8 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      {file ? file.name : 'Tap here to choose PDF file'}
                    </span>
                    <span className="text-[10px] text-slate-500">Pick from WhatsApp or phone files</span>
                  </label>
                </div>
              </div>

              {/* Step 5: PDF Password (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Statement PDF Password (if protected)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty if no password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!file || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-extrabold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Syncing & Extracting PDF...</span>
                  </div>
                ) : (
                  <>
                    Upload & Sync Statement <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 font-medium">
          Multi-Account Statement Sync System • Direct Phone Upload
        </div>
      </div>
    </div>
  );
};
