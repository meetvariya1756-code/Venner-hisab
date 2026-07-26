import React, { useEffect, useState } from 'react';
import type { BankAccount, Platform } from '../../types';
import { api } from '../../api/client';
import { Plus, Building2, Upload, Trash2, Eye, EyeOff, User, Landmark, Edit } from 'lucide-react';

interface AccountsViewProps {
  onUploadClick: (accountId: number) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ onUploadClick }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [showFullAccount, setShowFullAccount] = useState<Record<number, boolean>>({});

  // Form State
  const [platformId, setPlatformId] = useState<number>(1);
  const [name, setName] = useState(''); // Store Name e.g., DAPPERDOM
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('Savings');
  const [openingBalance, setOpeningBalance] = useState('0.0');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accs, plats] = await Promise.all([
        api.getAccounts(),
        api.getPlatforms()
      ]);
      setAccounts(accs);
      setPlatforms(plats);
      if (plats.length > 0 && !platformId) {
        setPlatformId(plats[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAccountId(null);
    setName('');
    setAccountHolder('');
    setBankName('');
    setAccountNumber('');
    setAccountType('Savings');
    setOpeningBalance('0.0');
    if (platforms.length > 0) setPlatformId(platforms[0].id);
    setIsModalOpen(true);
  };

  const openEditModal = (acc: BankAccount) => {
    setEditingAccountId(acc.id);
    setPlatformId(acc.platform_id || (platforms[0]?.id || 1));
    setName(acc.name);
    setAccountHolder(acc.account_holder || 'Prajapati Kiritbhai');
    setBankName(acc.bank_name);
    setAccountNumber(acc.account_number);
    setAccountType(acc.account_type);
    setOpeningBalance(acc.opening_balance.toString());
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        platform_id: platformId,
        name: name.trim(),
        account_holder: accountHolder.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_type: accountType,
        opening_balance: parseFloat(openingBalance) || 0
      };

      if (editingAccountId) {
        await api.updateAccount(editingAccountId, payload);
      } else {
        await api.createAccount(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save bank account');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this bank account? All associated statements will be removed.')) {
      await api.deleteAccount(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bank Accounts Registry</h2>
          <p className="text-xs text-slate-500">Manage seller store accounts grouped by platform and bank</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 shadow-xs"
        >
          <Plus className="w-4 h-4" /> Add Store Bank Account
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading bank accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="glass-card p-12 text-center border-dashed border-slate-300 bg-white">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No Bank Accounts Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Get started by adding your first seller account (e.g. DAPPERDOM under Meesho for Prajapati Kiritbhai).
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold"
          >
            Create Account Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const isVisible = showFullAccount[acc.id];
            return (
              <div key={acc.id} className="glass-card p-5 bg-white flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all group">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 uppercase">
                      {acc.platform_name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(acc)}
                        title="Edit Account Details"
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        title="Delete Account"
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 mt-3">{acc.name}</h3>

                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{acc.account_holder || 'Prajapati Kiritbhai'}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-slate-500">
                      <Landmark className="w-3.5 h-3.5 text-slate-400" />
                      <span>{acc.bank_name}: {isVisible ? acc.account_number : acc.masked_account_number}</span>
                      <button
                        onClick={() => setShowFullAccount(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Opening Bal</span>
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{acc.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => onUploadClick(acc.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating / editing bank account */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 bg-white border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">
              {editingAccountId ? 'Edit Store Bank Account' : 'Add Store Bank Account'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Platform</label>
                <select
                  value={platformId}
                  onChange={(e) => setPlatformId(Number(e.target.value))}
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
                  placeholder="e.g. DAPPERDOM, VIMS, VENNER NEW"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prajapati Kiritbhai"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="glass-input w-full font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kotak Mahindra Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="glass-input w-full font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 7849353892"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="glass-input w-full font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
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
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="glass-input w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-semibold"
                >
                  {editingAccountId ? 'Update Details' : 'Create Store Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
