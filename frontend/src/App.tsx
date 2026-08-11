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
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isValidatingSession, setIsValidatingSession] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>(() => {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
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

  // ── 1. Check mobile portal query param & Validate Session on Mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'mobile') {
      setIsMobilePortal(true);
      setIsValidatingSession(false);
      return;
    }

    const checkSession = async () => {
      try {
        const result = await api.validateSession();
        if (result && result.valid && result.user) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsValidatingSession(false);
      }
    };

    checkSession();
  }, []);

  // ── 2. Sync cross-tab login / logout events ─────────────────────────
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'session_token' || e.key === 'user') {
        if (!e.newValue) {
          setUser(null);
        } else if (e.key === 'user' && e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            // ignore
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (user) {
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
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    sessionStorage.setItem('user', JSON.stringify(loggedInUser));

    if (loggedInUser.role === 'manager') {
      setActiveTab('khatabook');
    } else {
      setActiveTab('platforms');
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
    }
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

  if (isMobilePortal) {
    return <MobileUploadPortal />;
  }

  if (isValidatingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Validating session...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLoginSuccess} />;
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
