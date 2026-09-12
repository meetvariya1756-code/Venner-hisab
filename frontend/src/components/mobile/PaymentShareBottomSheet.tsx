import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  CheckCircle2, 
  FileText, 
  Building2, 
  Copy, 
  Check, 
  AlertCircle
} from 'lucide-react';

export interface PaymentStatementOption {
  id: string;
  accountName: string;
  statementPeriod: string;
  amount: number;
  type: 'debit' | 'credit';
  payee: string;
  date: string;
  referenceId: string;
}

interface PaymentShareBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialPaymentData?: {
    amount: number;
    recipient: string;
    date: string;
    upiId: string;
    googleTxnId: string;
  };
}

const DEFAULT_STATEMENTS: PaymentStatementOption[] = [
  {
    id: 'stmt-1',
    accountName: 'State Bank of India (8586)',
    statementPeriod: 'Aug 2026 Monthly Statement',
    amount: 737,
    type: 'debit',
    payee: 'Dhru Petroleum',
    date: '26 Aug 2026, 11:09 pm',
    referenceId: '623876821695'
  },
  {
    id: 'stmt-2',
    accountName: 'HDFC Current Account (1204)',
    statementPeriod: 'Vendor Settlements Aug 2026',
    amount: 1450,
    type: 'debit',
    payee: 'Reliable Fuel Station',
    date: '25 Aug 2026, 04:15 pm',
    referenceId: '772910482910'
  },
  {
    id: 'stmt-3',
    accountName: 'ICICI Khatabook Account (4401)',
    statementPeriod: 'Daily Ledger Reconciliation',
    amount: 737,
    type: 'debit',
    payee: 'Dhru Petroleum',
    date: '26 Aug 2026, 11:10 pm',
    referenceId: 'CICAgLJI_VRbA'
  }
];

export const PaymentShareBottomSheet: React.FC<PaymentShareBottomSheetProps> = ({
  isOpen,
  onClose,
  initialPaymentData = {
    amount: 737,
    recipient: 'Dhru Petroleum',
    date: '26 Aug 2026, 11:09 pm',
    upiId: 'paytmqr6sludqr@otys',
    googleTxnId: 'CICAgLJI_VRbA'
  }
}) => {
  const [selectedStatementId, setSelectedStatementId] = useState<string>('stmt-1');
  const [copied, setCopied] = useState<boolean>(false);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const selectedStatement = DEFAULT_STATEMENTS.find(s => s.id === selectedStatementId) || DEFAULT_STATEMENTS[0];

  const shareTextContent = `📄 Payment Details & Statement Link
----------------------------------------
To: ${initialPaymentData.recipient}
Amount: ₹${initialPaymentData.amount}
Date: ${initialPaymentData.date}
UPI ID: ${initialPaymentData.upiId}
Txn ID: ${initialPaymentData.googleTxnId}

Linked Statement: ${selectedStatement.accountName}
Statement Period: ${selectedStatement.statementPeriod}
Ref ID: ${selectedStatement.referenceId}
----------------------------------------
Shared via Venner Hisab Mobile Portal`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Receipt - ₹${initialPaymentData.amount} to ${initialPaymentData.recipient}`,
          text: shareTextContent,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } catch (err) {
        console.log('Share dismissed or failed:', err);
      }
    } else {
      // Fallback copy to clipboard
      try {
        await navigator.clipboard.writeText(shareTextContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (e) {
        console.error('Clipboard copy failed:', e);
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareTextContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm transition-opacity p-0 sm:p-4">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Sheet Drawer Container */}
      <div className="relative w-full max-w-lg bg-slate-900 text-slate-100 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Mobile Grab Bar */}
        <div className="w-full flex flex-col items-center pt-3 pb-1 cursor-grab">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Share Payment Screenshot</h2>
              <p className="text-xs text-slate-400">Select statement details to attach below</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Screenshot / Payment Receipt Preview Card */}
          <div className="relative bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Payment Completed
              </span>
              <span className="text-[11px] text-slate-400">{initialPaymentData.date}</span>
            </div>

            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600/30 text-purple-300 font-bold text-lg mb-2 border border-purple-500/30">
                {initialPaymentData.recipient.charAt(0)}
              </div>
              <p className="text-xs text-slate-400">To {initialPaymentData.recipient}</p>
              <h3 className="text-3xl font-extrabold text-white mt-0.5 tracking-tight">
                ₹{initialPaymentData.amount}
              </h3>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">UPI ID:</span>
                <span className="font-mono text-slate-300">{initialPaymentData.upiId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Txn ID:</span>
                <span className="font-mono text-slate-300">{initialPaymentData.googleTxnId}</span>
              </div>
            </div>
          </div>

          {/* Section: Select Linked Statement / Account Entry */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                Linked Statement Details
              </h4>
              <span className="text-[10px] text-indigo-400 font-medium">Select 1 option</span>
            </div>

            <div className="space-y-2.5">
              {DEFAULT_STATEMENTS.map((stmt) => {
                const isSelected = stmt.id === selectedStatementId;
                return (
                  <div
                    key={stmt.id}
                    onClick={() => setSelectedStatementId(stmt.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-950/50'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {stmt.accountName}
                        </p>
                        <p className="text-[11px] text-slate-400">{stmt.statementPeriod}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Ref: {stmt.referenceId} • ₹{stmt.amount}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700 flex items-center justify-center" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Selecting a statement links your receipt screenshot directly with your bank statement reconciliation record before sharing.
            </span>
          </div>

        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 space-y-2">
          {shareSuccess && (
            <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-medium">
              Shared successfully!
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied Details!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handleShare}
              className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Screenshot</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
