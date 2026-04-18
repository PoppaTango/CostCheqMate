"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloudFolderPicker } from "@/components/cloud-folder-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  User,
  DollarSign,
  Calendar,
  Tag,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Save,
  Building2,
  CreditCard,
  Wallet,
  PiggyBank,
  Banknote,
  Sparkles,
  CheckCircle2,
  Lock,
  Cloud,
  CloudOff,
  ExternalLink,
  Download,
  Unplug,
  FolderOpen,
  FolderSync,
  AlertCircle,
  HardDrive,
  ShoppingCart,
  Upload,
  ImageIcon,
  Briefcase,
  X,
  FolderPlus,
} from "lucide-react";
import Image from "next/image";
import { CURRENCIES, MONTHS, FREQUENCIES } from "@/lib/types";
import type { Category, IncomeSetting } from "@/lib/types";

interface UserSettings {
  id: string;
  name: string;
  email: string;
  currency: string;
  fiscalYearStart: number;
  accountType?: string;
  businessName?: string | null;
  businessLogoUrl?: string | null;
  needsWalkthrough?: boolean;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string | null;
  accountType: string;
}

interface AdditionalIncome {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  date: string;
}

const INCOME_SOURCES = [
  "E-Transfer",
  "Cash",
  "Side Hustle",
  "Gift",
  "Refund",
  "Bonus",
  "Tax Return",
  "Investment",
  "Other",
];

// Version history - full details for members
const VERSION_HISTORY = [
  {
    version: "1.7.0",
    date: "April 2026",
    changes: [
      "🆕 Mobile app-style tile navigation — Facebook-inspired Kanban menu for quick thumb access",
      "🆕 In-app PDF viewer — view receipt PDFs directly without downloading",
      "📱 Edit Expenses redesigned for mobile portrait — full data visible without flipping to landscape",
      "☁️ Year Folder picker fixed — create & select year folders for cloud receipt organization",
      "📋 What's New section now reflects latest improvements in real-time",
    ],
  },
  {
    version: "1.6.0",
    date: "April 2026",
    changes: [
      "☁️ Cloud Storage integration — link OneDrive or Google Drive to store receipt PDFs",
      "📂 Year Folder system — organize receipts by year with auto-created category subfolders",
      "📂 Deep folder navigation — browse and select any folder in your cloud drive",
      "🔒 Premium & Business tier Stripe payment integration",
      "🔒 Premium expiration warnings with easy renewal",
      "📊 Server-side storage tracking for users without cloud storage",
    ],
    hasPremium: true,
  },
  {
    version: "1.5.0",
    date: "March 2026",
    changes: [
      "🔍 Edge-detection algorithm for receipt scanning — auto-crop and straighten",
      "📱 Redesigned expense history for mobile portrait with stacked layout",
      "🏦 Bank Account allocation tracking on Pay Period Calendar",
      "👥 Referral system — invite friends and earn premium months",
      "🛡️ Enhanced signup security — rate limiting, honeypot, and bot detection",
      "📊 SEO overhaul with structured data and Open Graph metadata",
    ],
  },
  {
    version: "1.4.0",
    date: "March 2026",
    changes: [
      "Introducing Cheqs gamification system — earn rewards for using the app!",
      "Added 7-day login streak rewards (+100 Cheqs)",
      "New Edit Expenses module — view and modify all your expense entries",
      "Pay Period Calendar with sticky header for better navigation",
      "Added bug reporting system with Cheqs rewards",
      "🔒 Premium Feature: Smart category prediction based on your history",
    ],
    hasPremium: true,
  },
  {
    version: "1.3.0",
    date: "March 2026",
    changes: [
      "Added About page with feature overview",
      "Added Extra $ module for tracking additional income (e-transfers, cash, gifts)",
      "Expanded emoji selection to 130+ icons",
      "Added quick settings access from dashboard",
      "Improved mobile-friendly interface",
    ],
  },
  {
    version: "1.2.0",
    date: "March 2026",
    changes: [
      "Introduced Bank Account allocations for automatic transfer tracking",
      "Fixed Pay Period Report bank allocations calculation",
      "Added logo as browser favicon",
      "Enhanced neon color theme with colorblind-friendly palette",
    ],
  },
  {
    version: "1.1.0",
    date: "February 2026",
    changes: [
      "Upgraded receipt scanning to LLM Vision API for faster results",
      "Added Pay Period Calendar report",
      "Implemented First Pay Date setting for accurate pay period tracking",
      "Improved budget tracking accuracy",
    ],
  },
  {
    version: "1.0.0",
    date: "February 2026",
    changes: [
      "Initial release with core budgeting features",
      "Receipt scanning with OCR",
      "Budget tracking by category",
      "Spending reports and analytics",
      "Google SSO authentication",
    ],
  },
];

interface SettingsModuleProps {
  defaultTab?: string;
}

export default function SettingsModule({ defaultTab = "profile" }: SettingsModuleProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [income, setIncome] = useState<IncomeSetting | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [additionalIncomes, setAdditionalIncomes] = useState<AdditionalIncome[]>([]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Update tab when defaultTab prop changes (navigation from other modules)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Form states
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fiscalYearStart, setFiscalYearStart] = useState("1");
  const [netAmountPerPay, setNetAmountPerPay] = useState("");
  const [frequency, setFrequency] = useState("bi-weekly");
  const [firstPayDate, setFirstPayDate] = useState("");

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("📦");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [categoryBudget, setCategoryBudget] = useState("");
  const [categoryBankAccountId, setCategoryBankAccountId] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // Bank account dialog
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [savingBank, setSavingBank] = useState(false);

  // Additional income dialog
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [editingAdditionalIncome, setEditingAdditionalIncome] = useState<AdditionalIncome | null>(null);
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState("E-Transfer");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeDate, setIncomeDate] = useState("");
  const [savingAdditionalIncome, setSavingAdditionalIncome] = useState(false);

  // Cloud storage state
  const [cloudConnections, setCloudConnections] = useState<Array<{
    id: string;
    provider: string;
    accountEmail: string | null;
    accountName: string | null;
    isActive: boolean;
    connectedAt: string;
    yearFolderId?: string | null;
    yearFolderName?: string | null;
  }>>([]);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [yearFolderPickerOpen, setYearFolderPickerOpen] = useState(false);
  const [savingYearFolder, setSavingYearFolder] = useState(false);

  // Cloud folder mapping state
  const [cloudFolders, setCloudFolders] = useState<{ id: string; name: string }[]>([]);
  const [categoryCloudFolderId, setCategoryCloudFolderId] = useState<string | null>(null);
  const [categoryCloudFolderName, setCategoryCloudFolderName] = useState<string | null>(null);
  const [categoryFolderPickerOpen, setCategoryFolderPickerOpen] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [assigningFolder, setAssigningFolder] = useState<string | null>(null); // categoryId being assigned

  // Storage purchase
  const [purchasingStorage, setPurchasingStorage] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, incomeRes, categoriesRes, bankAccountsRes, additionalIncomesRes, cloudStorageRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/income"),
        fetch("/api/categories"),
        fetch("/api/bank-accounts"),
        fetch("/api/additional-income"),
        fetch("/api/cloud-storage/status"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
        setName(data?.name || "");
        setCurrency(data?.currency || "USD");
        setFiscalYearStart((data?.fiscalYearStart || 1).toString());
        setBusinessName(data?.businessName || "");
        setBusinessLogoUrl(data?.businessLogoUrl || null);
        setWalkthroughEnabled(data?.needsWalkthrough ?? false);
      }

      if (incomeRes.ok) {
        const data = await incomeRes.json();
        setIncome(data);
        setNetAmountPerPay((data?.netAmountPerPay || 0).toString());
        setFrequency(data?.frequency || "bi-weekly");
        if (data?.firstPayDate) {
          setFirstPayDate(new Date(data.firstPayDate).toISOString().split("T")[0]);
        }
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data ?? []);
      }

      if (bankAccountsRes.ok) {
        const data = await bankAccountsRes.json();
        setBankAccounts(data ?? []);
      }

      if (additionalIncomesRes.ok) {
        const data = await additionalIncomesRes.json();
        setAdditionalIncomes(data ?? []);
      }

      if (cloudStorageRes.ok) {
        const data = await cloudStorageRes.json();
        setCloudConnections(data.connections ?? []);
        // Auto-fetch cloud folders if connected
        if ((data.connections ?? []).some((c: { isActive: boolean }) => c.isActive)) {
          fetchCloudFolders();
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, fiscalYearStart: parseInt(fiscalYearStart) }),
      });

      if (res.ok) {
        toast({ title: "Profile updated", description: "Your settings have been saved." });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Save profile error:", error);
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fetchCloudFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/cloud-storage/folders");
      if (res.ok) {
        const data = await res.json();
        setCloudFolders(data.folders ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoadingFolders(false); }
  };

  const handleQuickAssignFolder = async (categoryId: string, folderId: string | null, folderName: string | null) => {
    setAssigningFolder(categoryId);
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudFolderId: folderId, cloudFolderName: folderName }),
      });
      if (res.ok) {
        setCategories(prev => prev.map(c =>
          c.id === categoryId ? { ...c, cloudFolderId: folderId, cloudFolderName: folderName } : c
        ));
        toast({ title: folderId ? "Folder linked" : "Folder unlinked", description: `${folderName || "Cloud folder"} ${folderId ? "assigned" : "removed"}.` });
      }
    } catch { toast({ title: "Error", description: "Failed to assign folder.", variant: "destructive" }); }
    finally { setAssigningFolder(null); }
  };

  const handlePurchaseStorage = async (tier: string) => {
    setPurchasingStorage(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "storage_addon", storagePlanId: tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Error", description: data.error || "Failed to create checkout.", variant: "destructive" });
      }
    } catch { toast({ title: "Error", description: "Failed to process request.", variant: "destructive" }); }
    finally { setPurchasingStorage(false); }
  };

  const handleSaveIncome = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/income", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          netAmountPerPay: parseFloat(netAmountPerPay) || 0,
          frequency,
          firstPayDate: firstPayDate || null,
        }),
      });

      if (res.ok) {
        toast({ title: "Income updated", description: "Your income settings have been saved." });
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Save income error:", error);
      toast({ title: "Error", description: "Failed to save income settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openCategoryDialog = (category?: Category & { bankAccountId?: string | null }) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryIcon(category.icon);
      setCategoryColor(category.color);
      setCategoryBudget(category.annualBudget.toString());
      setCategoryBankAccountId(category.bankAccountId || null);
      setCategoryCloudFolderId(category.cloudFolderId || null);
      setCategoryCloudFolderName(category.cloudFolderName || null);
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryIcon("📦");
      setCategoryColor("#6366f1");
      setCategoryBudget("");
      setCategoryBankAccountId(null);
      setCategoryCloudFolderId(null);
      setCategoryCloudFolderName(null);
    }
    // Fetch cloud folders if connected
    if (cloudConnections.some(c => c.isActive) && cloudFolders.length === 0) {
      fetchCloudFolders();
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: "Error", description: "Category name is required.", variant: "destructive" });
      return;
    }

    setSavingCategory(true);
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : "/api/categories";
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName,
          icon: categoryIcon,
          color: categoryColor,
          annualBudget: parseFloat(categoryBudget) || 0,
          bankAccountId: categoryBankAccountId,
          cloudFolderId: categoryCloudFolderId,
          cloudFolderName: categoryCloudFolderName,
        }),
      });

      if (res.ok) {
        toast({
          title: editingCategory ? "Category updated" : "Category created",
          description: `${categoryName} has been ${editingCategory ? "updated" : "added"}.`,
        });
        setCategoryDialogOpen(false);
        fetchData();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error?.error || "Failed to save category.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Save category error:", error);
      toast({ title: "Error", description: "Failed to save category.", variant: "destructive" });
    } finally {
      setSavingCategory(false);
    }
  };

  // Bank account functions
  const openBankDialog = (account?: BankAccount) => {
    if (account) {
      setEditingBankAccount(account);
      setBankName(account.bankName);
      setAccountName(account.accountName);
      setAccountNumber(account.accountNumber || "");
      setAccountType(account.accountType);
    } else {
      setEditingBankAccount(null);
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      setAccountType("checking");
    }
    setBankDialogOpen(true);
  };

  const handleSaveBankAccount = async () => {
    if (!bankName.trim() || !accountName.trim()) {
      toast({ title: "Error", description: "Bank name and account name are required.", variant: "destructive" });
      return;
    }

    setSavingBank(true);
    try {
      const url = editingBankAccount ? `/api/bank-accounts/${editingBankAccount.id}` : "/api/bank-accounts";
      const method = editingBankAccount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName,
          accountName,
          accountNumber: accountNumber || null,
          accountType,
        }),
      });

      if (res.ok) {
        toast({
          title: editingBankAccount ? "Account updated" : "Account created",
          description: `${accountName} has been ${editingBankAccount ? "updated" : "added"}.`,
        });
        setBankDialogOpen(false);
        fetchData();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error?.error || "Failed to save bank account.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Save bank account error:", error);
      toast({ title: "Error", description: "Failed to save bank account.", variant: "destructive" });
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBankAccount = async (account: BankAccount) => {
    if (!confirm(`Are you sure you want to delete "${account.accountName}"? Categories linked to this account will be unlinked.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Account deleted", description: `${account.accountName} has been removed.` });
        fetchData();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Delete bank account error:", error);
      toast({ title: "Error", description: "Failed to delete bank account.", variant: "destructive" });
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "checking": return <CreditCard className="h-5 w-5" />;
      case "savings": return <PiggyBank className="h-5 w-5" />;
      case "suspense": return <Wallet className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This will also delete all expenses in this category.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Category deleted", description: `${category.name} has been removed.` });
        fetchData();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Delete category error:", error);
      toast({ title: "Error", description: "Failed to delete category.", variant: "destructive" });
    }
  };

  // Additional Income functions
  const openIncomeDialog = (income?: AdditionalIncome) => {
    if (income) {
      setEditingAdditionalIncome(income);
      setIncomeAmount(income.amount.toString());
      setIncomeSource(income.source);
      setIncomeDescription(income.description || "");
      setIncomeDate(new Date(income.date).toISOString().split("T")[0]);
    } else {
      setEditingAdditionalIncome(null);
      setIncomeAmount("");
      setIncomeSource("E-Transfer");
      setIncomeDescription("");
      setIncomeDate(new Date().toISOString().split("T")[0]);
    }
    setIncomeDialogOpen(true);
  };

  const handleSaveAdditionalIncome = async () => {
    if (!incomeAmount || !incomeSource || !incomeDate) {
      toast({ title: "Error", description: "Amount, source, and date are required.", variant: "destructive" });
      return;
    }

    setSavingAdditionalIncome(true);
    try {
      const url = editingAdditionalIncome
        ? `/api/additional-income/${editingAdditionalIncome.id}`
        : "/api/additional-income";
      const method = editingAdditionalIncome ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(incomeAmount),
          source: incomeSource,
          description: incomeDescription || null,
          date: incomeDate,
        }),
      });

      if (res.ok) {
        toast({
          title: editingAdditionalIncome ? "Income updated" : "Income added",
          description: `${incomeSource} income has been ${editingAdditionalIncome ? "updated" : "recorded"}.`,
        });
        setIncomeDialogOpen(false);
        fetchData();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error?.error || "Failed to save income.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Save additional income error:", error);
      toast({ title: "Error", description: "Failed to save income.", variant: "destructive" });
    } finally {
      setSavingAdditionalIncome(false);
    }
  };

  const handleDeleteAdditionalIncome = async (income: AdditionalIncome) => {
    if (!confirm(`Are you sure you want to delete this ${income.source} income of $${income.amount}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/additional-income/${income.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Income deleted", description: "The income entry has been removed." });
        fetchData();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Delete additional income error:", error);
      toast({ title: "Error", description: "Failed to delete income.", variant: "destructive" });
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case "e-transfer": return "💸";
      case "cash": return "💵";
      case "side hustle": return "💼";
      case "gift": return "🎁";
      case "refund": return "🔄";
      case "bonus": return "🎉";
      case "tax return": return "📋";
      case "investment": return "📈";
      default: return "💰";
    }
  };

  const iconOptions = [
    // Food & Dining
    "🛒", "🍽️", "🍕", "🍔", "☕", "🍺", "🍷", "🥡", "🧁", "🍿",
    // Transportation
    "🚗", "⛽", "🚌", "✈️", "🚕", "🚲", "🛵", "🚇", "🚂", "🛳️",
    // Housing & Utilities
    "🏠", "💡", "🔌", "💧", "🔥", "🛋️", "🧹", "🏢", "🪴", "🔑",
    // Entertainment & Leisure
    "🎬", "🎮", "🎵", "📺", "🎭", "🎪", "🎲", "🎯", "🎸", "🎤",
    // Health & Fitness
    "🏥", "💊", "🏋️", "🧘", "🏃", "🩺", "💆", "🦷", "👓", "🧴",
    // Shopping & Personal
    "🛍️", "👗", "👔", "👟", "💄", "💍", "🎒", "👜", "⌚", "💎",
    // Finance & Savings
    "💰", "💵", "💳", "🏦", "📊", "📈", "🛡️", "💸", "🪙", "📉",
    // Relationships & Family
    "💑", "❤️", "💐", "🎁", "🎂", "👶", "👨‍👩‍👧", "👵", "🧸", "🍼",
    // Pets
    "🐾", "🐕", "🐈", "🐟", "🦜", "🐹", "🐰", "🦮", "🦴", "🪺",
    // Education & Work
    "🎓", "📚", "💻", "📱", "🖨️", "📝", "🎨", "📷", "🖥️", "🔧",
    // Travel & Vacation
    "🏖️", "⛷️", "🏕️", "🗺️", "🎢", "🏨", "🧳", "🌴", "⛵", "🎿",
    // Subscriptions & Services
    "📧", "📰", "🎧", "📡", "🔔", "📲", "🌐", "☁️", "🔒", "🛠️",
    // Miscellaneous
    "📦", "🧾", "📋", "🗂️", "🏷️", "📎", "✨", "🌟", "⭐", "🎉"
  ];
  const colorOptions = ["#22c55e", "#f97316", "#3b82f6", "#8b5cf6", "#eab308", "#ec4899", "#ef4444", "#06b6d4", "#d946ef", "#64748b", "#10b981", "#6366f1"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          Settings
        </h2>
        <p className="text-muted-foreground mt-1">
          Customize your expense tracking preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:w-full sm:grid sm:grid-cols-7 gap-1">
            <TabsTrigger value="profile" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <User className="h-4 w-4 mr-2 hidden sm:block" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="income" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <DollarSign className="h-4 w-4 mr-2 hidden sm:block" />
              Income
            </TabsTrigger>
            <TabsTrigger value="extra-income" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <Banknote className="h-4 w-4 mr-2 hidden sm:block" />
              Extra $
            </TabsTrigger>
            <TabsTrigger value="categories" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <Tag className="h-4 w-4 mr-2 hidden sm:block" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="bank-accounts" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <Building2 className="h-4 w-4 mr-2 hidden sm:block" />
              Banks
            </TabsTrigger>
            <TabsTrigger value="cloud-storage" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <Cloud className="h-4 w-4 mr-2 hidden sm:block" />
              Cloud
            </TabsTrigger>
            <TabsTrigger value="whats-new" className="whitespace-nowrap px-3 data-[state=active]:neon-glow">
              <Sparkles className="h-4 w-4 mr-2 hidden sm:block" />
              What&apos;s New
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Your name displayed in the app</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={settings?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <DollarSign className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {(CURRENCIES ?? []).map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.symbol} {curr.code} - {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>Currency for displaying amounts</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fiscalYear">Fiscal Year Start</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
                      <SelectTrigger>
                        <Calendar className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {(MONTHS ?? []).map((month, index) => (
                          <SelectItem key={index} value={(index + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>Month when your fiscal year begins</TooltipContent>
                </Tooltip>
              </div>

              {/* Walkthrough toggle */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-sm font-medium">User Setup Guide</Label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Show Setup Guide on Dashboard</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, a &quot;User Setup Guide&quot; tile appears on your home screen to help you configure your account.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={walkthroughEnabled}
                    onClick={async () => {
                      const newVal = !walkthroughEnabled;
                      setWalkthroughEnabled(newVal);
                      try {
                        await fetch("/api/settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ needsWalkthrough: newVal }),
                        });
                        toast({
                          title: newVal ? "Setup Guide Enabled" : "Setup Guide Hidden",
                          description: newVal
                            ? "The User Setup Guide tile is now visible on your dashboard."
                            : "The User Setup Guide tile has been removed from your dashboard.",
                        });
                      } catch {
                        setWalkthroughEnabled(!newVal); // revert on error
                        toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" });
                      }
                    }}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      walkthroughEnabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        walkthroughEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveProfile} disabled={saving} className="w-full" size="lg">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Profile
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save your profile changes</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          {/* Business Branding Card - only for business accounts */}
          {settings?.accountType === "business" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                  Business Branding
                </CardTitle>
                <CardDescription>Customize your business identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Business Name */}
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusinessName(e.target.value)}
                    placeholder="Your Business Name"
                  />
                </div>

                {/* Business Logo */}
                <div className="space-y-3">
                  <Label>Business Logo</Label>
                  <p className="text-xs text-muted-foreground">PNG only • Min 200×200px • Max 5MB. Replaces the CheqMate logo in your dashboard.</p>

                  {businessLogoUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                        <Image src={businessLogoUrl} alt="Business logo" fill className="object-contain" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Replace Logo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={uploadingLogo}
                          onClick={async () => {
                            try {
                              setUploadingLogo(true);
                              const res = await fetch("/api/business/logo", { method: "DELETE" });
                              if (!res.ok) throw new Error("Failed to delete logo");
                              setBusinessLogoUrl(null);
                              toast({ title: "Logo removed" });
                            } catch {
                              toast({ title: "Error", description: "Could not remove logo", variant: "destructive" });
                            } finally {
                              setUploadingLogo(false);
                            }
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload your business logo</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG • 200×200px minimum</p>
                    </div>
                  )}

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";

                      if (file.type !== "image/png") {
                        toast({ title: "Invalid format", description: "Only PNG files are allowed", variant: "destructive" });
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: "File too large", description: "Maximum size is 5MB", variant: "destructive" });
                        return;
                      }

                      const img = document.createElement("img");
                      const objUrl = URL.createObjectURL(file);
                      const dimensionsOk = await new Promise<boolean>((resolve) => {
                        img.onload = () => { URL.revokeObjectURL(objUrl); resolve(img.naturalWidth >= 200 && img.naturalHeight >= 200); };
                        img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(false); };
                        img.src = objUrl;
                      });
                      if (!dimensionsOk) {
                        toast({ title: "Too small", description: "Logo must be at least 200×200 pixels", variant: "destructive" });
                        return;
                      }

                      try {
                        setUploadingLogo(true);
                        const presignRes = await fetch("/api/business/logo", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
                        });
                        if (!presignRes.ok) {
                          const err = await presignRes.json().catch(() => ({}));
                          throw new Error(err.error || "Failed to get upload URL");
                        }
                        const { uploadUrl, cloud_storage_path, signedHeaders } = await presignRes.json();

                        const uploadHeaders: Record<string, string> = { "Content-Type": "image/png" };
                        if (signedHeaders?.includes("content-disposition")) {
                          uploadHeaders["Content-Disposition"] = "attachment";
                        }
                        const uploadRes = await fetch(uploadUrl, { method: "PUT", headers: uploadHeaders, body: file });
                        if (!uploadRes.ok) throw new Error("Upload failed");

                        const confirmRes = await fetch("/api/business/logo", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ cloud_storage_path }),
                        });
                        if (!confirmRes.ok) throw new Error("Failed to confirm upload");
                        const { publicUrl } = await confirmRes.json();

                        setBusinessLogoUrl(publicUrl);
                        toast({ title: "Logo uploaded!", description: "Your business logo has been saved" });
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : "Could not upload logo";
                        toast({ title: "Upload failed", description: message, variant: "destructive" });
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                  {uploadingLogo && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading logo...
                    </div>
                  )}
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleSaveProfile} disabled={saving} className="w-full" size="lg">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Business Settings
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save your business name and branding</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Income Settings
              </CardTitle>
              <CardDescription>Configure your income for budget planning</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="netAmount">Net Amount per Paycheque</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="netAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={netAmountPerPay}
                        onChange={(e) => setNetAmountPerPay(e.target.value)}
                        placeholder="0.00"
                        className="pl-10"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Your take-home pay after deductions</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Pay Frequency</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger>
                        <Calendar className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {(FREQUENCIES ?? []).map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>How often you receive your pay</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstPayDate">First Pay Date (for Pay Period Calculation)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      id="firstPayDate"
                      type="date"
                      value={firstPayDate}
                      onChange={(e) => setFirstPayDate(e.target.value)}
                      className="w-full"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Enter your first or most recent pay date to calculate pay periods</TooltipContent>
                </Tooltip>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Annual Income:</strong>{" "}
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    (parseFloat(netAmountPerPay) || 0) *
                      ((FREQUENCIES ?? []).find((f) => f.value === frequency)?.annualMultiplier ?? 0)
                  )}
                </p>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveIncome} disabled={saving} className="w-full" size="lg">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Income Settings
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save your income configuration</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Expense Categories
                  </CardTitle>
                  <CardDescription>Manage your expense categories and budgets</CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => openCategoryDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create a new expense category</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              {/* Cloud folder mapping summary banner */}
              {cloudConnections.some(c => c.isActive) && (categories ?? []).length > 0 && (() => {
                const mapped = (categories ?? []).filter(c => c.cloudFolderId);
                const unmapped = (categories ?? []).filter(c => !c.cloudFolderId);
                return unmapped.length > 0 ? (
                  <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm flex-1">
                      <p className="font-medium text-amber-700 dark:text-amber-300">
                        {unmapped.length} of {(categories ?? []).length} categories have no cloud folder
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Assign cloud folders to each category so receipts save directly to your OneDrive/Google Drive instead of using server storage.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      All {mapped.length} categories have cloud folders assigned ✓
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-3">
                {(categories ?? []).map((category, index) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: category.color + "20" }}
                      >
                        {category.icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium">{category.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-sm text-muted-foreground">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(category.annualBudget)}
                          </span>
                          {(category as Category & { bankAccount?: BankAccount | null }).bankAccount && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                              → {(category as Category & { bankAccount?: BankAccount | null }).bankAccount?.accountName}
                            </span>
                          )}
                          {category.cloudFolderName ? (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              {category.cloudFolderName}
                            </span>
                          ) : cloudConnections.some(c => c.isActive) ? (
                            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded flex items-center gap-1">
                              <CloudOff className="h-3 w-3" />
                              No folder
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick assign folder button if cloud connected but no folder */}
                      {cloudConnections.some(c => c.isActive) && !category.cloudFolderId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              disabled={assigningFolder === category.id}
                              onClick={async () => {
                                // Auto-create a folder matching the category name
                                setAssigningFolder(category.id);
                                try {
                                  const res = await fetch("/api/cloud-storage/folders", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ folderName: category.name }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    await handleQuickAssignFolder(category.id, data.folder.id, data.folder.name);
                                    fetchCloudFolders();
                                  }
                                } catch { toast({ title: "Error", description: "Failed to create folder.", variant: "destructive" }); }
                                finally { setAssigningFolder(null); }
                              }}
                            >
                              {assigningFolder === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSync className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Auto-create &quot;{category.name}&quot; folder in cloud</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(category)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit category</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCategory(category)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete category</TooltipContent>
                      </Tooltip>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extra-income">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Additional Income
                  </CardTitle>
                  <CardDescription>Track extra income like e-transfers, cash, gifts, or side hustle money</CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => openIncomeDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Income
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Record additional income</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              {additionalIncomes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No additional income recorded yet.</p>
                  <p className="text-sm mt-1">Click "Add Income" to track e-transfers, cash, or other income.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {additionalIncomes.map((income, index) => (
                    <motion.div
                      key={income.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors border border-emerald-200/50 dark:border-emerald-800/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center text-xl">
                          {getSourceIcon(income.source)}
                        </div>
                        <div>
                          <h4 className="font-medium text-emerald-800 dark:text-emerald-300">{income.source}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(income.date).toLocaleDateString()}
                            {income.description && ` • ${income.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                          +{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(income.amount)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openIncomeDialog(income)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit income</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAdditionalIncome(income)}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete income</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {/* Total */}
                  <div className="pt-4 mt-4 border-t flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Total Additional Income</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      +{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        additionalIncomes.reduce((sum, inc) => sum + inc.amount, 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-accounts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Bank Accounts
                  </CardTitle>
                  <CardDescription>Set up your bank accounts to track where money should be allocated</CardDescription>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => openBankDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Account
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a new bank account</TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No bank accounts set up yet.</p>
                  <p className="text-sm">Add your bank accounts to link expense categories.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankAccounts.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                          {getAccountIcon(account.accountType)}
                        </div>
                        <div>
                          <h4 className="font-medium">{account.accountName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {account.bankName}
                            {account.accountNumber && (
                              <span className="ml-2 text-xs">•••• {account.accountNumber.slice(-4)}</span>
                            )}
                            <span className="ml-2 capitalize text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {account.accountType}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openBankDialog(account)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit account</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteBankAccount(account)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete account</TooltipContent>
                        </Tooltip>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cloud Storage Tab */}
        <TabsContent value="cloud-storage">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Cloud Storage
                </CardTitle>
                <CardDescription>
                  Connect your OneDrive or Google Drive to automatically save scanned receipts to organized folders.
                  Your receipts will be saved to <strong>Cost CheqMate → [Category Name]</strong> in your cloud drive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* OneDrive Connection */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#0078D4]/10 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#0078D4">
                          <path d="M10.457 6c-2.104 0-3.97 1.028-5.114 2.608A4.674 4.674 0 0 0 3 8.064C1.345 8.064 0 9.41 0 11.064S1.345 14.064 3 14.064h.008l6.992.001V14.063h1V14.065L18 14.064c2.21 0 4-1.79 4-4s-1.79-4-4-4c-.34 0-.67.043-.985.122C15.88 4.206 13.842 3 11.5 3c-.367 0-.726.033-1.076.096C10.455 5.038 10.457 6 10.457 6z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold">Microsoft OneDrive</h4>
                        <p className="text-xs text-muted-foreground">Office 365 • Recommended</p>
                      </div>
                    </div>
                    {(() => {
                      const conn = cloudConnections.find(c => c.provider === "onedrive" && c.isActive);
                      if (conn) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Connected
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={disconnectingProvider === "onedrive"}
                              onClick={async () => {
                                setDisconnectingProvider("onedrive");
                                try {
                                  const res = await fetch("/api/cloud-storage/disconnect", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ provider: "onedrive" }),
                                  });
                                  if (res.ok) {
                                    setCloudConnections(prev => prev.map(c =>
                                      c.provider === "onedrive" ? { ...c, isActive: false } : c
                                    ));
                                    toast({ title: "OneDrive disconnected" });
                                  }
                                } catch { toast({ title: "Failed to disconnect", variant: "destructive" }); }
                                finally { setDisconnectingProvider(null); }
                              }}
                            >
                              {disconnectingProvider === "onedrive" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          disabled={connectingProvider === "onedrive"}
                          onClick={async () => {
                            setConnectingProvider("onedrive");
                            try {
                              const res = await fetch("/api/cloud-storage/connect", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ provider: "onedrive" }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                window.location.href = data.authUrl;
                              }
                            } catch { toast({ title: "Failed to connect", variant: "destructive" }); }
                            finally { setConnectingProvider(null); }
                          }}
                        >
                          {connectingProvider === "onedrive" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cloud className="h-4 w-4 mr-2" />}
                          Connect
                        </Button>
                      );
                    })()}
                  </div>
                  {(() => {
                    const conn = cloudConnections.find(c => c.provider === "onedrive" && c.isActive);
                    if (conn) {
                      return (
                        <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">{conn.accountName || "Account"}</span>
                            {conn.accountEmail && <span className="ml-1">({conn.accountEmail})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Receipts save to: <span className="font-mono text-primary">OneDrive → {conn.yearFolderName ? `${conn.yearFolderName} → [Category]` : "Cost CheqMate → [Category]"}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Google Drive Connection */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                        <svg viewBox="0 0 87.3 78" className="h-6 w-6">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.6 9.8z" fill="#ea4335"/>
                          <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h36.75c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold">Google Drive</h4>
                        <p className="text-xs text-muted-foreground">Gmail • Google Workspace</p>
                      </div>
                    </div>
                    {(() => {
                      const conn = cloudConnections.find(c => c.provider === "googledrive" && c.isActive);
                      if (conn) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Connected
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={disconnectingProvider === "googledrive"}
                              onClick={async () => {
                                setDisconnectingProvider("googledrive");
                                try {
                                  const res = await fetch("/api/cloud-storage/disconnect", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ provider: "googledrive" }),
                                  });
                                  if (res.ok) {
                                    setCloudConnections(prev => prev.map(c =>
                                      c.provider === "googledrive" ? { ...c, isActive: false } : c
                                    ));
                                    toast({ title: "Google Drive disconnected" });
                                  }
                                } catch { toast({ title: "Failed to disconnect", variant: "destructive" }); }
                                finally { setDisconnectingProvider(null); }
                              }}
                            >
                              {disconnectingProvider === "googledrive" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          disabled={connectingProvider === "googledrive"}
                          onClick={async () => {
                            setConnectingProvider("googledrive");
                            try {
                              const res = await fetch("/api/cloud-storage/connect", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ provider: "googledrive" }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                window.location.href = data.authUrl;
                              }
                            } catch { toast({ title: "Failed to connect", variant: "destructive" }); }
                            finally { setConnectingProvider(null); }
                          }}
                        >
                          {connectingProvider === "googledrive" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cloud className="h-4 w-4 mr-2" />}
                          Connect
                        </Button>
                      );
                    })()}
                  </div>
                  {(() => {
                    const conn = cloudConnections.find(c => c.provider === "googledrive" && c.isActive);
                    if (conn) {
                      return (
                        <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">{conn.accountName || "Account"}</span>
                            {conn.accountEmail && <span className="ml-1">({conn.accountEmail})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Receipts save to: <span className="font-mono text-primary">Google Drive → {conn.yearFolderName ? `${conn.yearFolderName} → [Category]` : "Cost CheqMate → [Category]"}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* How it works info */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    How Cloud Storage Works
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">1.</span>
                      <span>Connect your OneDrive or Google Drive account above</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">2.</span>
                      <span>Set a year folder (e.g. &quot;2026&quot;) — category subfolders are auto-created inside it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">3.</span>
                      <span>When you scan a receipt, it&apos;s saved to: <span className="font-mono text-primary">{(() => { const ac = cloudConnections.find(c => c.isActive); return ac?.yearFolderName ? `${ac.yearFolderName} → Groceries → receipt.pdf` : "Cost CheqMate → Groceries → receipt.pdf"; })()}</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">4.</span>
                      <span>When a new year starts, switch the year folder to keep things organized</span>
                    </li>
                  </ul>
                </div>

                {/* Download app prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="https://www.microsoft.com/en-us/microsoft-365/onedrive/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center gap-3 group"
                  >
                    <Download className="h-5 w-5 text-[#0078D4]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Get OneDrive App</p>
                      <p className="text-xs text-muted-foreground">Sync receipts to your device</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                  <a
                    href="https://www.google.com/drive/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center gap-3 group"
                  >
                    <Download className="h-5 w-5 text-[#4285F4]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Get Google Drive App</p>
                      <p className="text-xs text-muted-foreground">Sync receipts to your device</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                </div>

                {!cloudConnections.some(c => c.isActive) && (
                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-300">No Cloud Storage Connected</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Connect OneDrive or Google Drive above to start saving receipts to your personal cloud storage.
                        This reduces server burden and gives you full ownership of your receipt files.
                      </p>
                    </div>
                  </div>
                )}

                {/* Year Folder Selection */}
                {cloudConnections.some(c => c.isActive) && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">Year Folder</h4>
                          <p className="text-xs text-muted-foreground">Organize receipts by year</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick-create current year */}
                        <Button
                          variant="default"
                          size="sm"
                          disabled={savingYearFolder}
                          onClick={async () => {
                            const currentYear = new Date().getFullYear().toString();
                            setSavingYearFolder(true);
                            try {
                              // Create folder via the folders API (creates inside CheqMate root or year folder)
                              const createRes = await fetch("/api/cloud-storage/folders", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ folderName: currentYear }),
                              });
                              if (!createRes.ok) {
                                const err = await createRes.json();
                                toast({ title: err.error || "Failed to create folder", variant: "destructive" });
                                return;
                              }
                              const { folder } = await createRes.json();
                              // Now set it as year folder
                              const res = await fetch("/api/cloud-storage/year-folder", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ yearFolderId: folder.id, yearFolderName: folder.name }),
                              });
                              if (res.ok) {
                                setCloudConnections(prev => prev.map(c =>
                                  c.isActive ? { ...c, yearFolderId: folder.id, yearFolderName: folder.name } : c
                                ));
                                toast({ title: `Year folder "${currentYear}" created and set!` });
                              } else {
                                toast({ title: "Folder created but failed to set as year folder", variant: "destructive" });
                              }
                            } catch { toast({ title: "Failed to create year folder", variant: "destructive" }); }
                            finally { setSavingYearFolder(false); }
                          }}
                        >
                          {savingYearFolder ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderPlus className="h-4 w-4 mr-2" />}
                          Create {new Date().getFullYear()}
                        </Button>
                        {/* Browse existing */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setYearFolderPickerOpen(true)}
                          disabled={savingYearFolder}
                        >
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Browse
                        </Button>
                      </div>
                    </div>

                    {(() => {
                      const activeConn = cloudConnections.find(c => c.isActive);
                      if (activeConn?.yearFolderName) {
                        return (
                          <div className="bg-muted/50 rounded-md p-3 text-sm flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-mono text-primary truncate">{activeConn.yearFolderName}</span>
                              <span className="text-xs text-muted-foreground shrink-0">→ [Category] → receipt.pdf</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              disabled={savingYearFolder}
                              onClick={async () => {
                                setSavingYearFolder(true);
                                try {
                                  const res = await fetch("/api/cloud-storage/year-folder", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ yearFolderId: null, yearFolderName: null }),
                                  });
                                  if (res.ok) {
                                    setCloudConnections(prev => prev.map(c =>
                                      c.isActive ? { ...c, yearFolderId: null, yearFolderName: null } : c
                                    ));
                                    toast({ title: "Year folder cleared — using default Cost CheqMate folder" });
                                  }
                                } catch { toast({ title: "Failed to clear year folder", variant: "destructive" }); }
                                finally { setSavingYearFolder(false); }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
                          <p>No year folder set — receipts save to <span className="font-mono text-primary">Cost CheqMate → [Category]</span></p>
                          <p className="text-xs mt-1">Click <strong>Create {new Date().getFullYear()}</strong> to auto-create a year folder, or <strong>Browse</strong> to select an existing one.</p>
                        </div>
                      );
                    })()}

                    <CloudFolderPicker
                      open={yearFolderPickerOpen}
                      onOpenChange={setYearFolderPickerOpen}
                      provider={cloudConnections.find(c => c.isActive)?.provider || "onedrive"}
                      onSelect={async (folderId, folderName) => {
                        setYearFolderPickerOpen(false);
                        setSavingYearFolder(true);
                        try {
                          const res = await fetch("/api/cloud-storage/year-folder", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ yearFolderId: folderId, yearFolderName: folderName }),
                          });
                          if (res.ok) {
                            setCloudConnections(prev => prev.map(c =>
                              c.isActive ? { ...c, yearFolderId: folderId, yearFolderName: folderName } : c
                            ));
                            toast({ title: `Year folder set to "${folderName}"` });
                          } else {
                            toast({ title: "Failed to set year folder", variant: "destructive" });
                          }
                        } catch { toast({ title: "Failed to set year folder", variant: "destructive" }); }
                        finally { setSavingYearFolder(false); }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category → Folder Mapping Overview */}
            {cloudConnections.some(c => c.isActive) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderOpen className="h-5 w-5 text-cyan-500" />
                    Category → Folder Mapping
                  </CardTitle>
                  <CardDescription>
                    Each budget category can be linked to a specific cloud folder. Scanned receipts auto-file into the mapped folder.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No categories yet. Create categories in the Categories tab first.</p>
                  ) : (
                    <>
                      {/* Summary badge */}
                      {(() => {
                        const mapped = categories.filter((c: any) => c.cloudFolderId);
                        const total = categories.length;
                        const allMapped = mapped.length === total;
                        return (
                          <div className={`flex items-center gap-2 p-3 rounded-lg border ${allMapped ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
                            {allMapped ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="text-sm font-medium">
                              {mapped.length}/{total} categories mapped
                            </span>
                            {!allMapped && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="ml-auto text-xs"
                                disabled={!!assigningFolder}
                                onClick={async () => {
                                  setAssigningFolder("bulk");
                                  try {
                                    const unmapped = categories.filter((c: any) => !c.cloudFolderId);
                                    for (const cat of unmapped) {
                                      // Auto-create folder with category name and assign
                                      try {
                                        const createRes = await fetch("/api/cloud-storage/folders", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ folderName: cat.name }),
                                        });
                                        if (createRes.ok) {
                                          const folder = await createRes.json();
                                          await handleQuickAssignFolder(cat.id, folder.folder.id, folder.folder.name);
                                        }
                                      } catch { /* skip failed */ }
                                    }
                                    toast({ title: `Assigned folders for ${unmapped.length} categories` });
                                  } catch {
                                    toast({ title: "Some folders failed to assign", variant: "destructive" });
                                  } finally {
                                    setAssigningFolder(null);
                                  }
                                }}
                              >
                                {assigningFolder ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FolderSync className="h-3 w-3 mr-1" />}
                                Auto-Assign All
                              </Button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Individual category rows */}
                      <div className="divide-y rounded-lg border">
                        {categories.map((cat: any) => (
                          <div key={cat.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#6366f1" }} />
                              <span className="text-sm font-medium truncate">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {cat.cloudFolderId ? (
                                <span className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-1 rounded-md flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  {cat.cloudFolderName || "Linked"}
                                </span>
                              ) : (
                                <>
                                  <span className="text-xs text-amber-500">No folder</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={async () => {
                                      setAssigningFolder(cat.id);
                                      try {
                                        const createRes = await fetch("/api/cloud-storage/folders", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ folderName: cat.name }),
                                        });
                                        if (createRes.ok) {
                                          const folder = await createRes.json();
                                          await handleQuickAssignFolder(cat.id, folder.folder.id, folder.folder.name);
                                        }
                                      } catch { toast({ title: "Failed to create folder", variant: "destructive" }); }
                                      finally { setAssigningFolder(null); }
                                    }}
                                    disabled={!!assigningFolder}
                                  >
                                    <FolderSync className="h-3.5 w-3.5 text-cyan-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Server Storage Add-on */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-5 w-5 text-purple-500" />
                  Server Storage
                </CardTitle>
                <CardDescription>
                  Don&apos;t want to connect cloud storage? Purchase extra server storage to keep your receipt PDFs securely hosted on our servers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Starter", gb: 5, price: "$1.49", priceId: "storage_5gb" },
                    { label: "Professional", gb: 25, price: "$4.99", priceId: "storage_25gb", popular: true },
                    { label: "Enterprise", gb: 100, price: "$14.99", priceId: "storage_100gb" },
                  ].map((tier) => (
                    <div
                      key={tier.priceId}
                      className={`relative border rounded-lg p-4 space-y-3 transition-colors hover:border-primary/50 ${tier.popular ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : ""}`}
                    >
                      {tier.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          POPULAR
                        </span>
                      )}
                      <div className="text-center space-y-1">
                        <h5 className="font-semibold text-sm">{tier.label}</h5>
                        <p className="text-2xl font-bold">{tier.price}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                        <p className="text-xs text-muted-foreground">{tier.gb} GB extra storage</p>
                      </div>
                      <Button
                        variant={tier.popular ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        disabled={purchasingStorage}
                        onClick={() => handlePurchaseStorage(tier.priceId)}
                      >
                        {purchasingStorage ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ShoppingCart className="h-4 w-4 mr-1" />
                        )}
                        Purchase
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Storage add-ons are billed monthly alongside your premium subscription. Cancel anytime.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* What's New Tab - Full version history for members */}
        <TabsContent value="whats-new">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                What&apos;s New
              </CardTitle>
              <CardDescription>
                Full version history - exclusive access for members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Upgrade count summary */}
              <div className="flex items-center gap-2 mb-6 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                <Sparkles className="h-5 w-5 text-cyan-500" />
                <span className="font-semibold">
                  {VERSION_HISTORY.reduce((count, release) => count + release.changes.length, 0)} total upgrades
                </span>
                <span className="text-muted-foreground">across {VERSION_HISTORY.length} releases</span>
              </div>

              <div className="space-y-6">
                {VERSION_HISTORY.map((release, index) => (
                  <div key={release.version} className={`p-4 rounded-lg border ${index === 0 ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">v{release.version}</span>
                        {index === 0 && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Latest</span>
                        )}
                        {(release as { hasPremium?: boolean }).hasPremium && (
                          <span className="text-xs bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Premium
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{release.date}</span>
                    </div>
                    <ul className="space-y-2">
                      {release.changes.map((change, i) => {
                        const isPremiumFeature = change.startsWith("🔒");
                        return (
                          <li key={i} className={`flex items-start gap-2 text-sm ${isPremiumFeature ? "p-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20" : ""}`}>
                            {isPremiumFeature ? (
                              <Lock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={isPremiumFeature ? "text-amber-700 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                              {isPremiumFeature ? change.replace("🔒 ", "") : change}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {(release as { hasPremium?: boolean }).hasPremium && (
                      <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-purple-500/5 border border-amber-500/20">
                        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span>Premium features are unlocked by earning <strong>Cheqs</strong>!</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category details" : "Create a new expense category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Groceries"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon <span className="text-xs text-muted-foreground">(scroll to see more)</span></Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border p-2 bg-muted/30">
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCategoryIcon(icon)}
                      className={`w-9 h-9 text-lg rounded-lg border-2 transition-all flex items-center justify-center ${
                        categoryIcon === icon ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCategoryColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      categoryColor === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Annual Budget</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={categoryBudget}
                  onChange={(e) => setCategoryBudget(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allocate to Bank Account (Optional)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Select
                    value={categoryBankAccountId || "none"}
                    onValueChange={(val) => setCategoryBankAccountId(val === "none" ? null : val)}
                  >
                    <SelectTrigger>
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account linked</SelectItem>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName} ({account.bankName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TooltipTrigger>
                <TooltipContent>Link this category to a bank account for budget allocation tracking</TooltipContent>
              </Tooltip>
              <p className="text-xs text-muted-foreground">
                This helps track which account to move money to for this expense category
              </p>
            </div>

            {/* Cloud Folder Assignment */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-cyan-500" />
                Cloud Folder
              </Label>
              {cloudConnections.some(c => c.isActive) ? (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCategoryFolderPickerOpen(true)}
                      className="flex-1 justify-start gap-2"
                    >
                      <FolderOpen className="h-4 w-4 text-cyan-500 shrink-0" />
                      <span className="truncate">
                        {categoryCloudFolderName || "Select Folder"}
                      </span>
                    </Button>
                    {categoryCloudFolderName && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setCategoryCloudFolderId(null); setCategoryCloudFolderName(null); }}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receipts for this category will sync to the selected folder
                  </p>
                  <CloudFolderPicker
                    open={categoryFolderPickerOpen}
                    onOpenChange={setCategoryFolderPickerOpen}
                    provider={cloudConnections.find(c => c.isActive)?.provider || "googledrive"}
                    onSelect={(folderId, folderName) => {
                      setCategoryCloudFolderId(folderId);
                      setCategoryCloudFolderName(folderName);
                    }}
                  />
                </>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Connect cloud storage in Settings → Cloud to assign folders
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory}>
              {savingCategory && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBankAccount ? "Edit Bank Account" : "New Bank Account"}
            </DialogTitle>
            <DialogDescription>
              {editingBankAccount ? "Update the account details" : "Add a new bank account to track allocations"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g., Chase, TD Bank"
              />
            </div>

            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Suspense (5484), Main Checking"
              />
            </div>

            <div className="space-y-2">
              <Label>Account Number (Optional - Last 4 digits)</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g., 5484"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Checking
                    </div>
                  </SelectItem>
                  <SelectItem value="savings">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-4 w-4" />
                      Savings
                    </div>
                  </SelectItem>
                  <SelectItem value="suspense">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Suspense / Holding
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBankAccount} disabled={savingBank}>
              {savingBank && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingBankAccount ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Additional Income Dialog */}
      <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAdditionalIncome ? "Edit Income" : "Add Income"}
            </DialogTitle>
            <DialogDescription>
              {editingAdditionalIncome ? "Update income details" : "Record an additional source of income"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={incomeSource} onValueChange={setIncomeSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      <div className="flex items-center gap-2">
                        <span>{getSourceIcon(source)}</span>
                        {source}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={incomeDescription}
                onChange={(e) => setIncomeDescription(e.target.value)}
                placeholder="e.g., Birthday gift from grandma"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdditionalIncome} disabled={savingAdditionalIncome}>
              {savingAdditionalIncome && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingAdditionalIncome ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}