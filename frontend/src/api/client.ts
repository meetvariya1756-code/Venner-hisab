import type { Platform, BankAccount, Category, Party, CategorizationRule, Transaction, ParsePreviewResult, DashboardSummary, PlatformBreakdown, StatementSummary, PartyExpense, AccountChecklist, User, UserRole, KhatabookSummary, KhatabookAccount, KhatabookEntry, OwnerDashboard, AiChatResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Session token & device helpers ───────────────────────────
const SESSION_KEY = 'session_token';
const DEVICE_KEY = 'device_id';

export function getDeviceId(): string {
  let devId = localStorage.getItem(DEVICE_KEY);
  if (!devId) {
    devId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'device_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, devId);
  }
  return devId;
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem('isAuthenticated');
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('isAuthenticated');
}

// ── Core fetch wrapper ────────────────────────────────────────
async function fetchApi(url: string, options?: RequestInit) {
  const token = getSessionToken();
  const deviceId = getDeviceId();
  
  let headersObj: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, val]) => {
        headersObj[key] = val;
      });
    } else {
      headersObj = { ...(options.headers as Record<string, string>) };
    }
  }

  if (token) {
    headersObj['X-Session-Token'] = token;
  }
  headersObj['X-Device-ID'] = deviceId;

  const res = await fetch(url, { ...options, headers: headersObj });

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
  // ── Auth ────────────────────────────────────────────────────
  async login(credentials: { username: string; password: string }): Promise<{ success: boolean; session_token: string; expires_at: string; user: User }> {
    const deviceId = getDeviceId();
    const res = await fetchApi(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, device_id: deviceId }),
    });
    const data = await res.json();
    // Store token immediately so subsequent requests are authenticated
    if (data.session_token) {
      setSessionToken(data.session_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      sessionStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetchApi(`${API_BASE}/auth/logout`, { method: 'POST' });
    } finally {
      clearSessionToken();
    }
  },

  async validateSession(): Promise<{ valid: boolean; user: User; expires_at: string } | null> {
    try {
      const res = await fetchApi(`${API_BASE}/auth/validate`);
      const data = await res.json();
      if (data && data.valid && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        sessionStorage.setItem('user', JSON.stringify(data.user));
        return data;
      }
      clearSessionToken();
      return null;
    } catch {
      clearSessionToken();
      return null;
    }
  },

  async getUsers(): Promise<User[]> {
    const res = await fetchApi(`${API_BASE}/auth/users`);
    return res.json();
  },

  async createUser(data: { username: string; password: string; role: UserRole; full_name?: string }): Promise<User> {
    const res = await fetchApi(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Khatabook
  async getKhatabookSummary(): Promise<KhatabookSummary> {
    const res = await fetchApi(`${API_BASE}/khatabook/summary`);
    return res.json();
  },

  async getKhatabookAccounts(params?: { q?: string; filter_by?: string; sort_by?: string }): Promise<{ summary: KhatabookSummary; accounts: KhatabookAccount[] }> {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.filter_by) query.append('filter_by', params.filter_by);
    if (params?.sort_by) query.append('sort_by', params.sort_by);
    const res = await fetchApi(`${API_BASE}/khatabook/accounts?${query.toString()}`);
    return res.json();
  },

  async getKhatabookEntries(accountId: number): Promise<{ account: KhatabookAccount; entries: KhatabookEntry[] }> {
    const res = await fetchApi(`${API_BASE}/khatabook/accounts/${accountId}/entries`);
    return res.json();
  },

  async createKhatabookEntry(accountId: number, formData: FormData): Promise<any> {
    const res = await fetchApi(`${API_BASE}/khatabook/accounts/${accountId}/entries`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async updateKhatabookEntry(entryId: number, formData: FormData): Promise<any> {
    const res = await fetchApi(`${API_BASE}/khatabook/entries/${entryId}`, {
      method: 'PUT',
      body: formData,
    });
    return res.json();
  },

  async deleteKhatabookEntry(entryId: number): Promise<any> {
    const res = await fetchApi(`${API_BASE}/khatabook/entries/${entryId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async downloadKhatabookPDF(options: {
    accountId?: number | null;
    periodType?: 'all' | 'year' | 'month' | 'custom';
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    const params = new URLSearchParams();
    if (options.periodType) params.append('period_type', options.periodType);
    if (options.year) params.append('year', options.year.toString());
    if (options.month) params.append('month', options.month.toString());
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);

    const endpoint = options.accountId
      ? `${API_BASE}/khatabook/accounts/${options.accountId}/export/pdf?${params.toString()}`
      : `${API_BASE}/khatabook/export/pdf?${params.toString()}`;

    const res = await fetchApi(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to download PDF' }));
      throw new Error(err.detail || 'Failed to download PDF');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = 'Khatabook_Ledger.pdf';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async updateKhatabookAccountSettings(accountId: number, data: {
    credit_limit?: number;
    due_date?: string | null;
    upi_id?: string | null;
    phone_number?: string | null;
  }): Promise<any> {
    const formData = new FormData();
    if (data.credit_limit !== undefined) formData.append('credit_limit', data.credit_limit.toString());
    if (data.due_date !== undefined) formData.append('due_date', data.due_date || '');
    if (data.upi_id !== undefined) formData.append('upi_id', data.upi_id || '');
    if (data.phone_number !== undefined) formData.append('phone_number', data.phone_number || '');

    const res = await fetchApi(`${API_BASE}/khatabook/accounts/${accountId}/settings`, {
      method: 'PUT',
      body: formData,
    });
    return res.json();
  },

  async parseBillReceipt(file: File): Promise<{
    success: boolean;
    filename: string;
    detected_amount?: number | null;
    detected_date?: string | null;
    detected_description?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchApi(`${API_BASE}/khatabook/parse-bill-receipt`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async downloadSystemBackup(): Promise<void> {
    const res = await fetchApi(`${API_BASE}/export/backup/download`);
    if (!res.ok) {
      throw new Error('Failed to download system backup');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = 'Venner_Hisab_Backup.json';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

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

  async deleteStatement(statementId: number): Promise<any> {
    const res = await fetchApi(`${API_BASE}/statements/${statementId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete statement');
    }
    return res.json();
  },

  async deleteStatementByMonth(accountId: number, yearMonth: string): Promise<any> {
    const res = await fetchApi(`${API_BASE}/statements/account/${accountId}/month/${yearMonth}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete statement month');
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

  async getOwnerDashboard(): Promise<OwnerDashboard> {
    const res = await fetchApi(`${API_BASE}/reports/owner-dashboard`);
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

  async getMobileAccounts(): Promise<any[]> {
    const res = await fetchApi(`${API_BASE}/mobile/accounts`);
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

  // Screenshots API
  async uploadUPIScreenshot(formData: FormData): Promise<any> {
    const res = await fetchApi(`${API_BASE}/mobile/screenshots/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async getMobileScreenshots(accountId: number): Promise<any[]> {
    const res = await fetchApi(`${API_BASE}/mobile/screenshots/${accountId}`);
    return res.json();
  },

  async getKhatabookScreenshots(): Promise<any[]> {
    const res = await fetchApi(`${API_BASE}/khatabook/screenshots`);
    return res.json();
  },

  async deleteUPIScreenshot(screenshotId: number): Promise<any> {
    const res = await fetchApi(`${API_BASE}/khatabook/screenshots/${screenshotId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  getScreenshotUrl(filename: string): string {
    return `${API_BASE}/mobile/screenshots/file/${filename}`;
  },

  // Exports
  getExportUrl(format: 'xlsx' | 'csv', accountId?: number, categoryId?: number): string {
    const q = new URLSearchParams();
    q.append('format', format);
    if (accountId) q.append('account_id', accountId.toString());
    if (categoryId) q.append('category_id', categoryId.toString());
    return `${API_BASE}/export/transactions?${q.toString()}`;
  },

  // ── AI Assistant Chat ──────────────────────────────────────
  async sendChatMessage(message: string, contextAccountId?: number): Promise<AiChatResponse> {
    const res = await fetchApi(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context_account_id: contextAccountId }),
    });
    return res.json();
  },

  async getChatSuggestions(): Promise<{ suggestions: string[] }> {
    const res = await fetchApi(`${API_BASE}/chat/suggestions`);
    return res.json();
  }
};

