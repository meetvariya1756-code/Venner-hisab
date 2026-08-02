import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { 
  Smartphone, CheckCircle2, AlertCircle, FileText, KeyRound, ArrowRight, 
  Building2, User, Landmark, Phone, LogOut, Download, 
  ShieldCheck
} from 'lucide-react';

interface AuthSession {
  store_id: number;
  store_name: string;
  account_holder: string;
  bank_name: string;
  account_number: string;
  masked_account_number: string;
  account_type: string;
  opening_balance: number;
  currency: string;
  platform_name: string;
  phone_number: string | null;
  pdf_password?: string | null;
}

export const MobileUploadPortal: React.FC = () => {
  // Authentication State
  const [session, setSession] = useState<AuthSession | null>(null);
  const [inputStoreName, setInputStoreName] = useState<string>('');
  const [inputAccountHolder, setInputAccountHolder] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App Navigation State (two main tabs)
  const [activeTab, setActiveTab] = useState<'details' | 'upload'>('upload');

  // Statement Upload Form State
  const [yearMonth, setYearMonth] = useState<string>('2026-02');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState<string>('');
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<any | null>(null);

  // Statement History State
  const [statements, setStatements] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  useEffect(() => {
    // Restore session from localStorage if present
    const saved = localStorage.getItem('hisab_mobile_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.pdf_password) {
          setPassword(parsed.pdf_password);
        }
      } catch (e) {
        localStorage.removeItem('hisab_mobile_session');
      }
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadStatementHistory(session.store_id);
    }
  }, [session, uploadSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStoreName.trim()) {
      setAuthError('Please enter your Store Account Name.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const data = await api.authenticateMobileStore(inputStoreName.trim(), inputAccountHolder.trim());
      setSession(data);
      if (data.pdf_password) {
        setPassword(data.pdf_password);
      }
      localStorage.setItem('hisab_mobile_session', JSON.stringify(data));
      setActiveTab('upload');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Store Account not found.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('hisab_mobile_session');
    setInputStoreName('');
    setInputAccountHolder('');
    setUploadSuccess(null);
    setFile(null);
  };

  const loadStatementHistory = async (storeId: number) => {
    setHistoryLoading(true);
    try {
      const list = await api.getMobileAccountStatements(storeId);
      setStatements(list);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !session) {
      setUploadError('Please select a valid PDF bank statement file.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('account_id', session.store_id.toString());
    formData.append('year_month', yearMonth);
    formData.append('file', file);
    if (password) formData.append('password', password);
    formData.append('uploader_name', session.account_holder || session.store_name);

    try {
      const res = await api.mobileUploadStatement(formData);
      setUploadSuccess(res);
      loadStatementHistory(session.store_id);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload statement.');
    } finally {
      setUploadLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: LOGIN GATE SCREEN (If user is not yet authenticated)
  // -------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-indigo-600 selection:text-white">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl" />
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-indigo-200" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Store Portal Login</h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium">Enter your Store & Holder details to enter</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>{authError}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" /> Store Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. DAPPERDON, VIMS, VENNER NEW"
                value={inputStoreName}
                onChange={(e) => setInputStoreName(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all uppercase"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Enter your store name registered in the system</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" /> Account Holder Name
              </label>
              <input
                type="text"
                placeholder="e.g. Prajapati Gaurav Kiritbhai"
                value={inputAccountHolder}
                onChange={(e) => setInputAccountHolder(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Full name on the bank account (optional matching)</span>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white py-4 rounded-2xl font-extrabold text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  Verify & Enter Mobile App <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 font-medium">
            Multi-Account Statement Analyzer • Secure Mobile Sync
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: AUTHENTICATED MOBILE APP VIEW (With Bottom Navigation)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-between selection:bg-indigo-600 selection:text-white">
      {/* Mobile Device Frame Container */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col justify-between border-x border-slate-200">
        
        {/* Top App Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white p-4 sticky top-0 z-30 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                <Smartphone className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wider uppercase bg-indigo-500/40 px-2 py-0.5 rounded border border-indigo-300/30 text-indigo-100">
                    {session.store_name}
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                    VERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200 font-medium mt-0.5">
                  {session.account_holder || 'Store Account Holder'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 bg-white/10 hover:bg-rose-500/30 text-white rounded-xl transition-all border border-white/10 text-xs flex items-center gap-1 font-semibold"
              title="Switch Store / Logout"
            >
              <LogOut className="w-4 h-4 text-rose-300" />
              <span className="text-[10px]">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-5 flex-1 pb-24">
          
          {/* TAB 1: ACCOUNT HOLDER DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" /> Account Holder Details
                </h2>
                <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-lg">
                  {session.platform_name}
                </span>
              </div>

              {/* Store & Bank Details Card */}
              <div className="glass-card p-5 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-3xl space-y-3.5 shadow-sm">
                <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Store Account</span>
                    <span className="text-base font-black text-slate-900">{session.store_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold text-slate-400 block uppercase">Account Type</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {session.account_type}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2 text-slate-500 font-medium">
                      <User className="w-4 h-4 text-slate-400" /> Account Holder:
                    </span>
                    <span className="font-bold text-slate-900">{session.account_holder || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2 text-slate-500 font-medium">
                      <Landmark className="w-4 h-4 text-slate-400" /> Bank Name:
                    </span>
                    <span className="font-bold text-slate-900">{session.bank_name}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2 text-slate-500 font-medium">
                      <Landmark className="w-4 h-4 text-slate-400" /> Account Number:
                    </span>
                    <span className="font-mono font-bold text-slate-900">{session.masked_account_number}</span>
                  </div>

                  {session.phone_number && (
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-2 text-slate-500 font-medium">
                        <Phone className="w-4 h-4 text-slate-400" /> Phone Number:
                      </span>
                      <span className="font-bold text-emerald-700">{session.phone_number}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-700 pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">Opening Balance:</span>
                    <span className="font-black text-slate-900 text-sm">
                      ₹{session.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Uploaded Statements History */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Uploaded Statements History ({statements.length})
                </h3>

                {historyLoading ? (
                  <div className="text-center text-slate-400 text-xs py-6">Loading statement history...</div>
                ) : statements.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">No statements uploaded yet for this store.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {statements.map((stmt) => (
                      <div key={stmt.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{stmt.year_month}</span>
                            {stmt.uploaded_via_mobile && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold">
                                MOBILE UPLOAD
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{stmt.filename}</span>
                          <div className="flex gap-3 text-[10px] font-mono mt-1">
                            <span className="text-emerald-700 font-bold">IN: ₹{stmt.total_in.toLocaleString('en-IN')}</span>
                            <span className="text-rose-700 font-bold">OUT: ₹{stmt.total_out.toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <a
                          href={api.getDownloadStatementUrl(stmt.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all border border-indigo-100 shrink-0"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STATEMENT PDF UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> Statement PDF Upload
                </h2>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  {session.store_name}
                </span>
              </div>

              {uploadSuccess ? (
                <div className="text-center py-6 space-y-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Upload Successful & Synced!</h3>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    {uploadSuccess.message}
                  </p>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Store Name:</span>
                      <span className="font-bold text-slate-900">{session.store_name}</span>
                    </div>
                    {uploadSuccess.imported_months && uploadSuccess.imported_months.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Imported Month(s):</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {uploadSuccess.imported_months.map((m: string) => (
                            <span key={m} className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {uploadSuccess.skipped_months && uploadSuccess.skipped_months.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Skipped (Existing):</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {uploadSuccess.skipped_months.map((m: string) => (
                            <span key={m} className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transactions Extracted:</span>
                      <span className="font-bold text-slate-900">{uploadSuccess.transaction_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Received (IN):</span>
                      <span className="font-bold text-emerald-700">₹{uploadSuccess.total_in?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Paid (OUT):</span>
                      <span className="font-bold text-rose-700">₹{uploadSuccess.total_out?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUploadSuccess(null);
                      setFile(null);
                      setPassword('');
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-extrabold text-xs shadow-md transition-all mt-4 cursor-pointer"
                  >
                    Upload Another Statement
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit} className="space-y-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                  {uploadError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>{uploadError}</div>
                    </div>
                  )}

                  {/* Period Month Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Statement Month
                    </label>
                    <input
                      type="month"
                      value={yearMonth}
                      onChange={(e) => setYearMonth(e.target.value)}
                      className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Note: The correct month is automatically detected from transactions inside the PDF. This picker is only used as a fallback.
                    </span>
                  </div>

                  {/* Pick PDF File */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Choose Statement PDF File
                    </label>
                    <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl p-6 text-center transition-all">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="mobile-pdf-upload"
                      />
                      <label htmlFor="mobile-pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <FileText className="w-10 h-10 text-indigo-600" />
                        <span className="text-xs font-extrabold text-slate-900">
                          {file ? file.name : 'Tap here to select PDF statement'}
                        </span>
                        <span className="text-[10px] text-slate-500">Pick from WhatsApp or phone files</span>
                      </label>
                    </div>
                  </div>

                  {/* PDF Password Optional */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Statement PDF Password (if protected)
                    </label>
                    <input
                      type="password"
                      placeholder="Leave blank if not password protected"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-medium"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!file || uploadLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white py-4 rounded-2xl font-extrabold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer mt-2"
                  >
                    {uploadLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Extracting & Parsing Statement...</span>
                      </div>
                    ) : (
                      <>
                        Upload & Parse Statement <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM NAVIGATION MENU BAR (Fixed at bottom of mobile view) */}
        <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 px-6 py-2 z-40 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'text-indigo-600 font-extrabold bg-indigo-50'
                : 'text-slate-500 font-medium hover:text-slate-900'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px]">Holder Details</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'text-indigo-600 font-extrabold bg-indigo-50'
                : 'text-slate-500 font-medium hover:text-slate-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">PDF Upload</span>
          </button>
        </div>

      </div>
    </div>
  );
};
