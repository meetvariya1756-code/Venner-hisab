import React, { useEffect, useState } from 'react';
import type { Platform, BankAccount } from '../../types';
import { api } from '../../api/client';
import { ShoppingBag, Plus, Building2, Upload, User, Landmark, ArrowUpRight, Edit, Phone } from 'lucide-react';

interface PlatformsViewProps {
  onSelectAccount: (accountId: number) => void;
  onUploadClick: (accountId: number) => void;
}

export const PlatformsView: React.FC<PlatformsViewProps> = ({ onSelectAccount, onUploadClick }) => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<number>(1);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [_loading, setLoading] = useState(true);

  // New Platform Form State
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  // Edit Account Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editPlatformId, setEditPlatformId] = useState<number>(1);
  const [editName, setEditName] = useState('');
  const [editAccountHolder, setEditAccountHolder] = useState('Prajapati Kiritbhai');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editBankName, setEditBankName] = useState('Kotak Mahindra Bank');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editAccountType, setEditAccountType] = useState('Savings');
  const [editOpeningBalance, setEditOpeningBalance] = useState('0.0');
  const [editPdfPassword, setEditPdfPassword] = useState('');

  useEffect(() => {
    loadPlatforms();
  }, []);

  useEffect(() => {
    if (selectedPlatformId) {
      loadAccounts(selectedPlatformId);
    }
  }, [selectedPlatformId]);

  const loadPlatforms = async () => {
    setLoading(true);
    try {
      const data = await api.getPlatforms();
      const list = Array.isArray(data) ? data : [];
      setPlatforms(list);
      const targetPlatId = selectedPlatformId || (list.length > 0 ? list[0].id : 1);
      if (list.length > 0 && (!selectedPlatformId || selectedPlatformId !== targetPlatId)) {
        setSelectedPlatformId(targetPlatId);
      }
      // Ensure accounts are loaded for target platform
      await loadAccounts(targetPlatId);
    } catch (e) {
      console.error(e);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async (platId: number) => {
    try {
      const data = await api.getAccounts(platId);
      setAccounts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatformName) return;
    try {
      const created = await api.createPlatform({ name: newPlatformName });
      setIsAddPlatformOpen(false);
      setNewPlatformName('');
      await loadPlatforms();
      setSelectedPlatformId(created.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create platform');
    }
  };

  const openEditModal = (acc: BankAccount) => {
    setEditingAccountId(acc.id);
    setEditPlatformId(acc.platform_id || selectedPlatformId);
    setEditName(acc.name);
    setEditAccountHolder(acc.account_holder || 'Prajapati Kiritbhai');
    setEditPhoneNumber(acc.phone_number || '');
    setEditBankName(acc.bank_name);
    setEditAccountNumber(acc.account_number);
    setEditAccountType(acc.account_type);
    setEditOpeningBalance(acc.opening_balance.toString());
    setEditPdfPassword(acc.pdf_password || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccountId) return;
    try {
      await api.updateAccount(editingAccountId, {
        platform_id: editPlatformId,
        name: editName.trim(),
        account_holder: editAccountHolder.trim(),
        phone_number: editPhoneNumber.trim(),
        bank_name: editBankName.trim(),
        account_number: editAccountNumber.trim(),
        account_type: editAccountType,
        opening_balance: parseFloat(editOpeningBalance) || 0,
        pdf_password: editPdfPassword.trim() || null
      });
      setIsEditModalOpen(false);
      loadPlatforms();
      loadAccounts(selectedPlatformId);
    } catch (err: any) {
      alert(err.message || 'Failed to update account details');
    }
  };

  const currentPlatform = platforms.find(p => p.id === selectedPlatformId);

  return (
    <div className="space-y-6 p-6">
      {/* Platform Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" /> E-Commerce Platforms & Store Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage accounts platform-wise (Meesho, Flipkart, Amazon)</p>
        </div>

        <button
          onClick={() => setIsAddPlatformOpen(true)}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4 text-indigo-600" /> Add New Platform
        </button>
      </div>

      {/* Platform Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar border-b border-slate-200">
        {platforms.map((p) => {
          const isActive = selectedPlatformId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPlatformId(p.id)}
              className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-white text-indigo-600 border-slate-300 shadow-xs border-b-2 border-b-indigo-600 -mb-[1px]'
                  : 'bg-slate-100/70 text-slate-600 border-transparent hover:bg-slate-200/50'
              }`}
            >
              <span>{p.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {p.account_count} accounts
              </span>
            </button>
          );
        })}
      </div>

      {/* Account Cards for Selected Platform */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            Accounts under {currentPlatform?.name || 'Platform'} ({accounts.length})
          </h3>
        </div>

        {accounts.length === 0 ? (
          <div className="glass-card p-12 text-center border-dashed border-slate-300 bg-white">
            <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800 text-sm">No Store Accounts under {currentPlatform?.name}</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your store accounts (e.g. DAPPERDOM, VIMS, VENNER NEW) to start uploading monthly bank statements.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="glass-card p-5 bg-white flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 uppercase">
                      {acc.name}
                    </span>
                    <button
                      onClick={() => openEditModal(acc)}
                      title="Edit Account Details"
                      className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{acc.account_holder || 'Prajapati Kiritbhai'}</span>
                    </div>
                    {acc.phone_number && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{acc.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                      <Landmark className="w-3.5 h-3.5 text-slate-500" />
                      <span>{acc.bank_name}: {acc.masked_account_number}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onSelectAccount(acc.id)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:underline"
                  >
                    View Statement Summary <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onUploadClick(acc.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Statement
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Platform Modal */}
      {isAddPlatformOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 bg-white border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Add E-Commerce Platform</h3>
            <form onSubmit={handleCreatePlatform} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Name</label>
                <input
                  type="text"
                  placeholder="e.g. Myntra, JioMart, Ajio"
                  value={newPlatformName}
                  onChange={(e) => setNewPlatformName(e.target.value)}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPlatformOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Save Platform
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 bg-white border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Edit Store Account Details</h3>
            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
                <select
                  value={editPlatformId}
                  onChange={(e) => setEditPlatformId(Number(e.target.value))}
                  className="glass-input w-full bg-white"
                  required
                >
                  {platforms.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. DAPPERDOM, VIMS"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="glass-input w-full font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prajapati Kiritbhai"
                  value={editAccountHolder}
                  onChange={(e) => setEditAccountHolder(e.target.value)}
                  className="glass-input w-full font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Holder's Phone Number (for WhatsApp / SMS Reminders)</label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="glass-input w-full font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kotak Mahindra Bank"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="glass-input w-full font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 7849353892"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    className="glass-input w-full font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={editAccountType}
                    onChange={(e) => setEditAccountType(e.target.value)}
                    className="glass-input w-full bg-white"
                  >
                    <option value="Savings">Savings</option>
                    <option value="Current">Current</option>
                    <option value="Overdraft">Overdraft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editOpeningBalance}
                    onChange={(e) => setEditOpeningBalance(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Statement PDF Password (if protected)</label>
                <input
                  type="text"
                  placeholder="e.g. VARIY09042006 (leave blank if not protected)"
                  value={editPdfPassword}
                  onChange={(e) => setEditPdfPassword(e.target.value)}
                  className="glass-input w-full text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  Update Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
