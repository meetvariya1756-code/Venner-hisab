import React, { useState, useEffect } from 'react';
import type { BankAccount, ParsePreviewResult } from '../../types';
import { api } from '../../api/client';
import { Upload, KeyRound, AlertTriangle, FileText, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface UploadStatementModalProps {
  accounts: BankAccount[];
  initialAccountId?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadStatementModal: React.FC<UploadStatementModalProps> = ({
  accounts,
  initialAccountId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [requiresPassword, setRequiresPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsePreviewResult | null>(null);

  // Sync selectedAccountId with initialAccountId or accounts list whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (initialAccountId && initialAccountId > 0) {
        setSelectedAccountId(initialAccountId);
      } else if (accounts.length > 0) {
        setSelectedAccountId(accounts[0].id);
      }
      setError(null);
    }
  }, [isOpen, initialAccountId, accounts]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setPreviewData(null);
      setRequiresPassword(false);
    }
  };

  const handleParsePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedAccountId || initialAccountId || accounts[0]?.id;
    
    if (!file) {
      setError('Please select a PDF bank statement file first.');
      return;
    }
    if (!targetId) {
      setError('Please select a target store bank account.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.parsePreview(targetId, file, password || undefined);
      setPreviewData(res);
    } catch (err: any) {
      if (err.message === 'PASSWORD_PROTECTED') {
        setRequiresPassword(true);
        setError('This PDF statement is password-protected. Please enter the password below.');
      } else {
        setError(err.message || 'Failed to parse statement PDF.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !file) return;

    setLoading(true);
    setError(null);
    try {
      await api.confirmImport(
        previewData.account_id,
        previewData.filename,
        previewData.file_hash,
        file,
        password || undefined
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden bg-white shadow-2xl border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Upload Bank Statement PDF</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 font-medium">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!previewData ? (
            <form onSubmit={handleParsePreview} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Target Store Bank Account
                </label>
                <select
                  value={selectedAccountId || accounts[0]?.id || ''}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                  className="glass-input w-full bg-white font-medium"
                  required
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="bg-white text-slate-900">
                      {acc.name} ({acc.bank_name} - {acc.masked_account_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Statement PDF File
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:border-indigo-400 transition-all">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload-input"
                  />
                  <label htmlFor="pdf-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-800">
                      {file ? file.name : 'Click to select bank statement PDF'}
                    </span>
                    <span className="text-xs text-slate-500">Supports Kotak, SBI & generic bank statement formats</span>
                  </label>
                </div>
              </div>

              {requiresPassword && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <label className="text-xs font-semibold text-amber-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    Enter PDF Password
                  </label>
                  <input
                    type="password"
                    placeholder="Statement Password (not stored)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input w-full bg-white"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!file || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing Statement PDF...</span>
                  </div>
                ) : (
                  <>
                    Parse & Preview Statement <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Preview Screen */
            <div className="space-y-5">
              {previewData.is_duplicate && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 font-medium">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                  <div>
                    <strong>Duplicate Warning:</strong> {previewData.duplicate_message}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Bank / Adapter</span>
                  <span className="font-semibold text-slate-900">{previewData.parsing_result.bank_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Period</span>
                  <span className="font-semibold text-indigo-700">{previewData.parsing_result.year_month}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Credits (IN)</span>
                  <span className="font-semibold text-emerald-700">
                    ₹{previewData.parsing_result.total_credits.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Debits (OUT)</span>
                  <span className="font-semibold text-rose-700">
                    ₹{previewData.parsing_result.total_debits.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Parsed Transactions ({previewData.parsing_result.transactions.length} rows)
                </h4>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl custom-scrollbar">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Narration / Description</th>
                        <th className="py-2 px-3 text-right">Debit (Dr)</th>
                        <th className="py-2 px-3 text-right">Credit (Cr)</th>
                        <th className="py-2 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewData.parsing_result.transactions.map((tx, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{tx.date}</td>
                          <td className="py-2 px-3 text-slate-900 max-w-xs truncate">{tx.narration}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">
                            {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            ₹{tx.balance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Back to Upload
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={previewData.is_duplicate || loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold text-xs transition-all disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {loading ? 'Importing...' : 'Confirm & Commit Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
