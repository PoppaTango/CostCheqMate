export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  annualBudget: number;
  bankAccountId?: string | null;
}

export interface Expense {
  id: string;
  amount: number;
  merchant?: string | null;
  description?: string | null;
  date: string;
  categoryId: string;
  receiptUrl?: string | null;
  receiptKey?: string | null;
  category?: Category;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  note?: string | null;
  cheqsAwarded?: number;
}

export interface OcrDraft {
  merchant: string;
  date: string;
  amount: string;
  error?: string;
}
