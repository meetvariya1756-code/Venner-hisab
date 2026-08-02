import { useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { PlatformsView } from './components/platforms/PlatformsView';
import { StatementSummaryView } from './components/statements/StatementSummaryView';
import { AccountsView } from './components/accounts/AccountsView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { PartiesView } from './components/parties/PartiesView';
import { RulesView } from './components/rules/RulesView';
import { KhatabookView } from './components/khatabook/KhatabookView';
import { UploadStatementModal } from './components/statements/UploadStatementModal';
import { MobileUploadPortal } from './components/mobile/MobileUploadPortal';
import { MobileChecklistView } from './components/mobile/MobileChecklistView';
import { Login } from './components/auth/Login';
import type { BankAccount, User } from './types';
import { api } from './api/client';

export function App() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed: User = JSON.parse(storedUser);
        if (parsed.role === 'manager') {
          return 'khatabook';
        }
      } catch {
        // fallback
      }
    }
    return 'platforms';
  });

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
    } else if (user) {
      loadAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'manager' && activeTab !== 'khatabook') {
      setActiveTab('khatabook');
    }
  }, [user, activeTab]);

  const loadAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    sessionStorage.setItem('user', JSON.stringify(loggedInUser));
    sessionStorage.setItem('isAuthenticated', 'true');

    if (loggedInUser.role === 'manager') {
      setActiveTab('khatabook');
    } else {
      setActiveTab('platforms');
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('isAuthenticated');
  };

  const handleSelectAccountForSummary = (accountId: number) => {
    setSelectedAccountId(accountId);
    setActiveTab('summary');
  };

  const handleOpenUpload = async (accId?: number) => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
      if (data.length === 0) {
        alert('Please create a bank account first before uploading a statement.');
        setActiveTab('accounts');
        return;
      }
      setUploadAccountId(accId || data[0]?.id || 0);
      setIsUploadModalOpen(true);
    } catch (e) {
      console.error(e);
      alert('Failed to load accounts before uploading.');
    }
  };

  if (!user) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  // Render standalone mobile portal for account holders
  if (isMobilePortal) {
    return <MobileUploadPortal />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {user.role === 'manager' ? (
          <KhatabookView />
        ) : (
          <>
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

            {activeTab === 'khatabook' && (
              <KhatabookView />
            )}
          </>
        )}
      </main>

      {user.role === 'owner' && (
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
      )}
    </div>
  );
}

export default App;
