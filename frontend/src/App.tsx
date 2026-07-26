import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { PlatformsView } from './components/platforms/PlatformsView';
import { StatementSummaryView } from './components/statements/StatementSummaryView';
import { AccountsView } from './components/accounts/AccountsView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { PartiesView } from './components/parties/PartiesView';
import { RulesView } from './components/rules/RulesView';
import { UploadStatementModal } from './components/statements/UploadStatementModal';
import { MobileUploadPortal } from './components/mobile/MobileUploadPortal';
import { MobileChecklistView } from './components/mobile/MobileChecklistView';
import type { BankAccount } from './types';
import { api } from './api/client';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('platforms');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadAccountId, setUploadAccountId] = useState<number>(0);
  const [isMobilePortal, setIsMobilePortal] = useState<boolean>(false);

  useEffect(() => {
    // Check if user opened the mobile upload portal link
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'mobile') {
      setIsMobilePortal(true);
    } else {
      loadAccounts();
    }
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAccountForSummary = (accountId: number) => {
    setSelectedAccountId(accountId);
    setActiveTab('summary');
  };

  const handleOpenUpload = (accId?: number) => {
    if (accounts.length === 0) {
      alert('Please create a bank account first before uploading a statement.');
      setActiveTab('accounts');
      return;
    }
    setUploadAccountId(accId || accounts[0]?.id || 0);
    setIsUploadModalOpen(true);
  };

  // Render standalone mobile portal for account holders
  if (isMobilePortal) {
    return <MobileUploadPortal />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto pb-12">
        {activeTab === 'platforms' && (
          <PlatformsView
            onSelectAccount={handleSelectAccountForSummary}
            onUploadClick={handleOpenUpload}
          />
        )}

        {activeTab === 'summary' && (
          <StatementSummaryView
            initialAccountId={selectedAccountId}
            onUploadClick={handleOpenUpload}
          />
        )}

        {activeTab === 'mobile' && (
          <MobileChecklistView />
        )}

        {activeTab === 'accounts' && (
          <AccountsView onUploadClick={handleOpenUpload} />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView />
        )}

        {activeTab === 'parties' && (
          <PartiesView />
        )}

        {activeTab === 'rules' && (
          <RulesView />
        )}
      </main>

      <UploadStatementModal
        accounts={accounts}
        initialAccountId={uploadAccountId}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          loadAccounts();
          setActiveTab('summary');
        }}
      />
    </div>
  );
}

export default App;
