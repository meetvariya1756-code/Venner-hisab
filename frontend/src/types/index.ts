export interface Platform {
  id: number;
  name: string;
  code?: string;
  description?: string;
  account_count: number;
  created_at: string;
}

export interface BankAccount {
  id: number;
  platform_id?: number | null;
  platform_name?: string | null;
  name: string; // Store Name e.g., DAPPERDOM, VIMS
  account_holder?: string | null; // e.g., Prajapati Kiritbhai
  bank_name: string;
  account_number: string;
  masked_account_number: string;
  account_type: string;
  opening_balance: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  parent_id?: number | null;
  is_system: boolean;
  color: string;
}

export interface Party {
  id: number;
  name: string;
  category_id?: number | null;
  aliases: string;
  created_at: string;
}

export interface CategorizationRule {
  id: number;
  name: string;
  pattern: string;
  match_type: string;
  field: string;
  party_id?: number | null;
  category_id?: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: number;
  statement_id: number;
  account_id: number;
  date: string;
  narration: string;
  ref_no?: string | null;
  debit: number;
  credit: number;
  balance: number;
  page_number: number;
  party_id?: number | null;
  category_id?: number | null;
  is_categorized: boolean;
  review_status: string;
  party_name?: string | null;
  category_name?: string | null;
}

export interface StatementSummary {
  account_id: number;
  account_name: string;
  account_holder?: string;
  bank_name: string;
  account_number: string;
  platform_name: string;
  year_month: string;
  total_transactions: number;
  total_in: number;
  total_out: number;
  net: number;
  in_entries_count: number;
  out_entries_count: number;
  in_entries: {
    id: number;
    date: string;
    narration: string;
    ref_no?: string;
    amount: number;
    balance: number;
    category: string;
    party?: string;
    page_number: number;
  }[];
  out_entries: {
    id: number;
    date: string;
    narration: string;
    ref_no?: string;
    amount: number;
    balance: number;
    category: string;
    party?: string;
    page_number: number;
  }[];
}

export interface ParsePreviewResult {
  filename: string;
  file_hash: string;
  is_duplicate: boolean;
  duplicate_message: string;
  account_id: number;
  parsing_result: {
    bank_name: string;
    opening_balance: number;
    closing_balance: number;
    start_date: string;
    end_date: string;
    year_month: string;
    total_credits: number;
    total_debits: number;
    transactions: {
      date: string;
      narration: string;
      ref_no?: string;
      debit: number;
      credit: number;
      balance: number;
      page_number: number;
    }[];
    raw_rows: string[][];
  };
}

export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  net_result: number;
  accounts_count: number;
  platforms_count: number;
  statements_count: number;
  uncategorized_count: number;
  monthly_trend: {
    month: string;
    income: number;
    expense: number;
    net: number;
  }[];
}

export interface PlatformBreakdown {
  platforms: {
    platform_id: number;
    platform_name: string;
    account_count: number;
    total_in: number;
    total_out: number;
    net: number;
  }[];
}

export interface PartyExpense {
  party_name: string;
  total_expense: number;
  tx_count: number;
}
