import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  annualBudget: number;
  userId: string;
  isDefault: boolean;
  cloudFolderId?: string | null;
  cloudFolderName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  date: Date;
  categoryId: string;
  userId: string;
  receiptUrl: string | null;
  receiptKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: Category;
}

export interface IncomeSetting {
  id: string;
  netAmountPerPay: number;
  frequency: string;
  userId: string;
}

export interface UserSettings {
  currency: string;
  fiscalYearStart: number;
}

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
];

export const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "🛒", color: "#22c55e" },
  { name: "Dining Out", icon: "🍽️", color: "#f97316" },
  { name: "Transportation", icon: "🚗", color: "#3b82f6" },
  { name: "Housing", icon: "🏠", color: "#8b5cf6" },
  { name: "Utilities", icon: "💡", color: "#eab308" },
  { name: "Entertainment", icon: "🎬", color: "#ec4899" },
  { name: "Healthcare", icon: "🏥", color: "#ef4444" },
  { name: "Shopping", icon: "🛍️", color: "#06b6d4" },
  { name: "Personal Care", icon: "💆", color: "#d946ef" },
  { name: "Insurance", icon: "🛡️", color: "#64748b" },
  { name: "Savings", icon: "💰", color: "#10b981" },
  { name: "Other", icon: "📦", color: "#6366f1" },
];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const FREQUENCIES = [
  { value: "weekly", label: "Weekly", annualMultiplier: 52 },
  { value: "bi-weekly", label: "Bi-Weekly", annualMultiplier: 26 },
  { value: "semi-monthly", label: "Semi-Monthly", annualMultiplier: 24 },
  { value: "monthly", label: "Monthly", annualMultiplier: 12 },
];
