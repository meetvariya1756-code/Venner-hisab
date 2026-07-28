import React, { useEffect, useState } from 'react';
import type { AccountChecklist } from '../../types';
import { api } from '../../api/client';
import { Smartphone, CheckCircle2, Clock, Download, MessageSquare, RefreshCw, Search } from 'lucide-react';

export const MobileChecklistView: React.FC = () => {
  const [yearMonth, setYearMonth] = useState<string>('2026-02');
  const [checklist, setChecklist] = useState<AccountChecklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadChecklist(yearMonth);
  }, [yearMonth]);

  const loadChecklist = async (ym: string) => {
    setLoading(true);
    try {
      const data = await api.getMobileChecklist(ym);
      setChecklist(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsAppReminder = (item: AccountChecklist) => {
    // MAIN COMPANY NUMBER FOR REMINDERS
    // If you need to change the phone number in the future, change it right here:
    const MAIN_COMPANY_NO = "+91 83475 82055";
    
    const mobilePortalUrl = `${window.location.origin}/?portal=mobile`;
    const msg = `Hello ${item.account_holder || item.store_name},\n\nPlease upload your bank statement PDF for store *${item.store_name}* (${yearMonth}) using this mobile link:\n${mobilePortalUrl}\n\nIf you need help, contact us at ${MAIN_COMPANY_NO}.\nThank you!`;
    const encoded = encodeURIComponent(msg);
    const phone = item.phone_number ? item.phone_number.replace(/\D/g, '') : '';
    const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  };

  const receivedCount = checklist.filter(c => c.status === 'RECEIVED').length;
  const pendingCount = checklist.length - receivedCount;

  const filteredItems = checklist.filter(item => 
    item.store_name.toLowerCase().includes(search.toLowerCase()) ||
    (item.account_holder && item.account_holder.toLowerCase().includes(search.toLowerCase())) ||
    item.bank_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-600" /> Monthly Store Statement Upload Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time PDF uploads from store account holders via mobile app
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Statement Month</label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="glass-input bg-slate-50 font-bold text-xs py-1.5"
            />
          </div>

          <button
            onClick={async () => {
              try {
                const res = await api.sendEndOfMonthReminders(yearMonth);
                alert(`Automated End-of-Month Reminders Generated for ${res.pending_count} pending store accounts!`);
              } catch (e: any) {
                alert(e.message || 'Failed to send reminders');
              }
            }}
            className="mt-4 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Send Automated End-of-Month Reminders to all pending stores"
          >
            <MessageSquare className="w-4 h-4" /> Send Month-End Reminders
          </button>

          <button
            onClick={() => loadChecklist(yearMonth)}
            className="mt-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh Upload Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 bg-white border-l-4 border-l-slate-800">
          <span className="text-slate-500 text-xs font-semibold block uppercase">Total Store Accounts</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{checklist.length}</p>
          <span className="text-xs text-slate-500 mt-1 block">Configured store accounts</span>
        </div>

        <div className="glass-card p-5 bg-emerald-50/50 border border-emerald-200 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Statements Received & Parsed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">{receivedCount}</p>
          <span className="text-xs text-emerald-600 mt-1 block font-medium">Ready for monthly report</span>
        </div>

        <div className="glass-card p-5 bg-amber-50/50 border border-amber-200 border-l-4 border-l-amber-600">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
            <span>Pending Mobile Uploads</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-700 mt-2">{pendingCount}</p>
          <span className="text-xs text-amber-600 mt-1 block font-medium">Awaiting account holder submission</span>
        </div>
      </div>

      {/* Checklist Table */}
      <div className="glass-card bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Store Accounts Checklist for {yearMonth}</h3>
            {/* The Mobile App Portal link has been hidden as requested */}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search store or account holder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input w-full pl-9 py-1.5 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading checklist status...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Store Account</th>
                  <th className="py-3 px-4">Account Holder</th>
                  <th className="py-3 px-4">Bank</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Extracted IN (₹)</th>
                  <th className="py-3 px-4 text-right">Extracted OUT (₹)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">No store accounts found</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.account_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{item.store_name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{item.account_holder || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-500">{item.bank_name}</td>
                      <td className="py-3.5 px-4 text-center">
                        {item.status === 'RECEIVED' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md text-[10px] font-extrabold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            RECEIVED {item.uploaded_via_mobile ? '(MOBILE)' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-extrabold border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING UPLOAD
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {item.status === 'RECEIVED' ? `₹${item.total_in.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                        {item.status === 'RECEIVED' ? `₹${item.total_out.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {item.status === 'RECEIVED' && item.statement_id && (
                            <a
                              href={api.getDownloadStatementUrl(item.statement_id)}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 inline-flex items-center gap-1.5 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" /> Download PDF
                            </a>
                          )}

                          <button
                            onClick={() => handleSendWhatsAppReminder(item)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 inline-flex items-center gap-1.5 transition-all"
                            title="Send WhatsApp Reminder Link"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
