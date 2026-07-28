import type { Platform, BankAccount, Category, Party, CategorizationRule, Transaction, ParsePreviewResult, DashboardSummary, PlatformBreakdown, StatementSummary, PartyExpense, AccountChecklist } from '../types';

const API_BASE = '/api';

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMessage = 'API Request Failed';
    try {
      const text = await res.text();
      try {
        const errData = JSON.parse(text);
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errMessage = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            // Handle FastAPI validation errors
            errMessage = errData.detail.map((e: any) => e.msg).join(', ');
          } else {
            errMessage = JSON.stringify(errData.detail);
          }
        } else if (errData.message) {
          errMessage = errData.message;
        }
      } catch {
        if (text) errMessage = text;
      }
    } catch {
      // Fallback message
    }
    throw new Error(errMessage);
  }
  return res;
}


export const api = {
  // Platforms
  async getPlatforms(): Promise<Platform[]> {
    const res = await fetchApi(`${API_BASE}/platforms`);
    return res.json();
  },

  async createPlatform(data: { name: string; code?: string; description?: string }): Promise<Platform> {
    const res = await fetchApi(`${API_BASE}/platforms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Accounts
  async getAccounts(platformId?: number): Promise<BankAccount[]> {
    const q = platformId ? `?platform_id=${platformId}` : '';
    const res = await fetchApi(`${API_BASE}/accounts${q}`);
    return res.json();
  },

  async createAccount(data: {
    platform_id: number;
    name: string;
    account_holder?: string;
    phone_number?: string;
    bank_name: string;
    account_number: string;
    account_type: string;
    opening_balance: number;
    pdf_password?: string | null;
  }): Promise<BankAccount> {
    const res = await fetchApi(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateAccount(id: number, data: {
    platform_id: number;
    name: string;
    account_holder?: string;
    phone_number?: string;
    bank_name: string;
    account_number: string;
    account_type: string;
    opening_balance: number;
    pdf_password?: string | null;
  }): Promise<BankAccount> {
    const res = await fetchApi(`${API_BASE}/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteAccount(id: number): Promise<void> {
    await fetchApi(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
  },

  // Statements
  async parsePreview(accountId: number, file: File, password?: string): Promise<ParsePreviewResult> {
    const formData = new FormData();
    formData.append('account_id', accountId.toString());
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }

    const res = await fetchApi(`${API_BASE}/statements/parse-preview`, {
      method: 'POST',
      body: formData,
    });

    if (res.status === 401) {
      throw new Error('PASSWORD_PROTECTED');
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Parsing failed');
    }

    return res.json();
  },

  async confirmImport(accountId: number, filename: string, fileHash: string, file: File, password?: string): Promise<any> {
    const formData = new FormData();
    formData.append('account_id', accountId.toString());
    formData.append('filename', filename);
    formData.append('file_hash', fileHash);
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }

    const res = await fetchApi(`${API_BASE}/statements/confirm-import`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Import failed');
    }

    return res.json();
  },

  // Transactions
  async getTransactions(params?: {
    account_id?: number;
    statement_id?: number;
    category_id?: number;
    party_id?: number;
    is_categorized?: boolean;
    search?: string;
  }): Promise<Transaction[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          query.append(key, val.toString());
        }
      });
    }
    const res = await fetchApi(`${API_BASE}/transactions?${query.toString()}`);
    return res.json();
  },

  async updateTransaction(id: number, data: {
    category_id?: number | null;
    party_id?: number | null;
    create_rule?: boolean;
    rule_name?: string;
    pattern?: string;
  }): Promise<Transaction> {
    const res = await fetchApi(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Categories & Rules
  async getCategories(): Promise<Category[]> {
    const res = await fetchApi(`${API_BASE}/categories`);
    return res.json();
  },

  async createCategory(data: { name: string; type: string; color: string }): Promise<Category> {
    const res = await fetchApi(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getParties(): Promise<Party[]> {
    const res = await fetchApi(`${API_BASE}/parties`);
    return res.json();
  },

  async mergeParties(sourcePartyIds: number[], targetPartyId: number): Promise<Party> {
    const res = await fetchApi(`${API_BASE}/parties/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_party_ids: sourcePartyIds, target_party_id: targetPartyId }),
    });
    return res.json();
  },

  async getRules(): Promise<CategorizationRule[]> {
    const res = await fetchApi(`${API_BASE}/rules`);
    return res.json();
  },

  async createRule(data: { name: string; pattern: string; match_type: string; category_id?: number; party_id?: number }): Promise<CategorizationRule> {
    const res = await fetchApi(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Reports
  async getDashboard(yearMonth?: string): Promise<DashboardSummary> {
    const q = yearMonth ? `?year_month=${yearMonth}` : '';
    const res = await fetchApi(`${API_BASE}/reports/dashboard${q}`);
    return res.json();
  },

  async getPlatformBreakdown(): Promise<PlatformBreakdown> {
    const res = await fetchApi(`${API_BASE}/reports/platform-breakdown`);
    return res.json();
  },

  async getPartyExpenses(): Promise<PartyExpense[]> {
    const res = await fetchApi(`${API_BASE}/reports/party-expenses`);
    return res.json();
  },

  async getAccountStatementSummary(accountId: number, yearMonth: string): Promise<StatementSummary> {
    const res = await fetchApi(`${API_BASE}/reports/account-summary/${accountId}?year_month=${yearMonth}`);
    return res.json();
  },

  // Mobile Sync & Checklist Methods
  async authenticateMobileStore(storeName: string, accountHolder?: string): Promise<any> {
    const res = await fetchApi(`${API_BASE}/mobile/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_name: storeName, account_holder: accountHolder }),
    });
    return res.json();
  },

  async getMobileAccountStatements(accountId: number): Promise<any[]> {
    const res = await fetchApi(`${API_BASE}/mobile/statements/${accountId}`);
    return res.json();
  },

  async sendEndOfMonthReminders(yearMonth?: string): Promise<any> {
    const q = yearMonth ? `?year_month=${yearMonth}` : '';
    const res = await fetchApi(`${API_BASE}/mobile/send-reminders${q}`, {
      method: 'POST',
    });
    return res.json();
  },

  async getMobileChecklist(yearMonth: string): Promise<AccountChecklist[]> {
    const res = await fetchApi(`${API_BASE}/mobile/checklist?year_month=${yearMonth}`);
    return res.json();
  },

  async mobileUploadStatement(formData: FormData): Promise<any> {
    const res = await fetchApi(`${API_BASE}/mobile/upload`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  getDownloadStatementUrl(statementId: number): string {
    return `${API_BASE}/mobile/download/${statementId}`;
  },

  // Exports
  getExportUrl(format: 'xlsx' | 'csv', accountId?: number, categoryId?: number): string {
    const q = new URLSearchParams();
    q.append('format', format);
    if (accountId) q.append('account_id', accountId.toString());
    if (categoryId) q.append('category_id', categoryId.toString());
    return `${API_BASE}/export/transactions?${q.toString()}`;
  }
};
