"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  DollarSign,
  Tag,
  Cloud,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Plus,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { DEFAULT_CATEGORIES } from "@/lib/types";

interface WalkthroughModuleProps {
  onComplete: () => void;
  onNavigateToSettings: (tab: string) => void;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  accountType: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  cloudFolderId?: string | null;
  cloudFolderName?: string | null;
}

interface CloudConnection {
  id: string;
  provider: string;
  email?: string;
  isActive: boolean;
}

const STEPS = [
  { id: 1, label: "Bank Account", icon: Building2, description: "Set up at least one bank account" },
  { id: 2, label: "Income", icon: DollarSign, description: "Configure your pay details" },
  { id: 3, label: "Categories", icon: Tag, description: "Set up expense categories" },
  { id: 4, label: "Cloud Storage", icon: Cloud, description: "Connect & organize cloud folders" },
];

const ACCOUNT_TYPES = [
  { value: "chequing", label: "Chequing" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "other", label: "Other" },
];

export default function WalkthroughModule({ onComplete, onNavigateToSettings }: WalkthroughModuleProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Step 1: Bank Account
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("chequing");

  // Step 2: Income
  const [netAmountPerPay, setNetAmountPerPay] = useState("");
  const [frequency, setFrequency] = useState("bi-weekly");
  const [firstPayDate, setFirstPayDate] = useState("");
  const [incomeConfigured, setIncomeConfigured] = useState(false);

  // Step 3: Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryChoice, setCategoryChoice] = useState<"defaults" | "empty" | null>(null);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Step 4: Cloud
  const [cloudConnections, setCloudConnections] = useState<CloudConnection[]>([]);

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bankRes, incomeRes, catRes, cloudRes] = await Promise.all([
        fetch("/api/bank-accounts"),
        fetch("/api/income"),
        fetch("/api/categories"),
        fetch("/api/cloud-storage/status"),
      ]);

      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankAccounts(data ?? []);
      }
      if (incomeRes.ok) {
        const data = await incomeRes.json();
        if (data?.netAmountPerPay > 0 && data?.firstPayDate) {
          setIncomeConfigured(true);
          setNetAmountPerPay(data.netAmountPerPay.toString());
          setFrequency(data.frequency || "bi-weekly");
          setFirstPayDate(new Date(data.firstPayDate).toISOString().split("T")[0]);
        } else if (data?.netAmountPerPay > 0) {
          setNetAmountPerPay(data.netAmountPerPay.toString());
          setFrequency(data.frequency || "bi-weekly");
        }
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data ?? []);
        setCategoriesLoaded(true);
        if ((data ?? []).length > 0) {
          setCategoryChoice("defaults");
        }
      }
      if (cloudRes.ok) {
        const data = await cloudRes.json();
        setCloudConnections(data.connections ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch walkthrough data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Save bank account
  const handleSaveBankAccount = async () => {
    if (!bankName.trim() || !accountName.trim()) {
      toast({ title: "Required", description: "Bank name and account name are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountName, accountNumber, accountType }),
      });
      if (res.ok) {
        const newAccount = await res.json();
        setBankAccounts(prev => [...prev, newAccount]);
        setBankName("");
        setAccountName("");
        setAccountNumber("");
        setAccountType("chequing");
        toast({ title: "✅ Bank Account Added", description: `${newAccount.bankName} - ${newAccount.accountName} has been added.` });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to add bank account.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add bank account.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Save income settings
  const handleSaveIncome = async () => {
    if (!netAmountPerPay || parseFloat(netAmountPerPay) <= 0) {
      toast({ title: "Required", description: "Please enter your net pay amount.", variant: "destructive" });
      return;
    }
    if (!firstPayDate) {
      toast({ title: "Required", description: "Please set your first pay date.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/income", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          netAmountPerPay: parseFloat(netAmountPerPay),
          frequency,
          firstPayDate,
        }),
      });
      if (res.ok) {
        setIncomeConfigured(true);
        toast({ title: "✅ Income Saved", description: "Your pay details have been configured." });
      } else {
        toast({ title: "Error", description: "Failed to save income settings.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save income settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Load default categories
  const handleLoadDefaults = async () => {
    if (categories.length > 0) {
      // Already have categories
      setCategoryChoice("defaults");
      toast({ title: "✅ Categories Ready", description: `You already have ${categories.length} categories set up.` });
      return;
    }
    setSaving(true);
    try {
      // Create default categories one by one
      const created: Category[] = [];
      for (const cat of DEFAULT_CATEGORIES) {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cat.name, icon: cat.icon, color: cat.color }),
        });
        if (res.ok) {
          const newCat = await res.json();
          created.push(newCat);
        }
      }
      setCategories(created);
      setCategoryChoice("defaults");
      toast({ title: "✅ Default Categories Created", description: `${created.length} categories have been set up for you.` });
    } catch {
      toast({ title: "Error", description: "Failed to create categories.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEmpty = () => {
    setCategoryChoice("empty");
    toast({ title: "Starting Fresh", description: "You can add categories later in Settings." });
  };

  // Final: Complete walkthrough
  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsWalkthrough: false }),
      });
      toast({ title: "🎉 Setup Complete!", description: "You're all set! You can re-enable this guide anytime from Settings." });
      onComplete();
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canProceedFromStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1: return bankAccounts.length > 0;
      case 2: return incomeConfigured;
      case 3: return categoryChoice !== null;
      case 4: return true; // Cloud is optional
      default: return false;
    }
  }, [bankAccounts.length, incomeConfigured, categoryChoice]);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const progressPercent = (currentStep / 4) * 100;
  const hasCloudConnected = cloudConnections.some(c => c.isActive);
  const categoriesWithFolders = categories.filter(c => c.cloudFolderId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading setup guide...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 via-primary to-purple-500 bg-clip-text text-transparent">
          Welcome to Cost CheqMate! 🎉
        </h2>
        <p className="text-muted-foreground">
          Let&apos;s get you set up in just a few steps.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>Step {currentStep} of 4</span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="flex justify-between gap-2">
        {STEPS.map((step) => {
          const isCompleted = canProceedFromStep(step.id) && step.id < currentStep;
          const isActive = step.id === currentStep;
          const isPast = step.id < currentStep;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${
                isActive
                  ? "bg-primary/10 border border-primary/30"
                  : isPast && canProceedFromStep(step.id)
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-muted/30 border border-transparent hover:bg-muted/50"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isCompleted || (isPast && canProceedFromStep(step.id))
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {(isCompleted || (isPast && canProceedFromStep(step.id))) ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span className="text-[10px] sm:text-xs font-medium leading-tight">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* ===== STEP 1: Bank Account ===== */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Step 1: Bank Account Setup
                </CardTitle>
                <CardDescription>
                  Add at least one bank account. This is used as a disposition code when categorizing expenses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing accounts */}
                {bankAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Your Bank Accounts
                    </Label>
                    <div className="space-y-2">
                      {bankAccounts.map((account) => (
                        <div key={account.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                          <Building2 className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="font-medium text-sm">{account.bankName}</p>
                            <p className="text-xs text-muted-foreground">{account.accountName} • {account.accountType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new account form */}
                <div className="space-y-3 p-4 rounded-lg border border-dashed border-border">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Plus className="h-4 w-4" /> Add a Bank Account
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Bank Name *</Label>
                      <Input
                        placeholder="e.g., TD Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account Name *</Label>
                      <Input
                        placeholder="e.g., Main Chequing"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account Number (optional)</Label>
                      <Input
                        placeholder="Last 4 digits"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account Type</Label>
                      <Select value={accountType} onValueChange={setAccountType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleSaveBankAccount} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Bank Account
                  </Button>
                </div>

                {bankAccounts.length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      You need at least one bank account to proceed. This helps categorize which account expenses come from.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== STEP 2: Income ===== */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Step 2: Income Setup
                </CardTitle>
                <CardDescription>
                  Configure your net pay amount per paycheque and your first pay date so we can track pay periods.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {incomeConfigured && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Income is already configured!</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Net Amount Per Paycheque *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2500.00"
                      value={netAmountPerPay}
                      onChange={(e) => setNetAmountPerPay(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">The amount you receive after taxes and deductions.</p>
                  </div>

                  <div className="space-y-1">
                    <Label>Pay Frequency</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                        <SelectItem value="semi-monthly">Semi-Monthly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>First Pay Date *</Label>
                    <Input
                      type="date"
                      value={firstPayDate}
                      onChange={(e) => setFirstPayDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Your most recent or upcoming pay date. Used to calculate pay periods.</p>
                  </div>
                </div>

                <Button onClick={handleSaveIncome} disabled={saving} className="w-full" size="lg">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  {incomeConfigured ? "Update Income Settings" : "Save Income Settings"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ===== STEP 3: Categories ===== */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Step 3: Expense Categories
                </CardTitle>
                <CardDescription>
                  Categories help you organize and track your spending. You can always add, edit, or remove categories later in Settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Your Categories ({categories.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                          style={{ borderColor: cat.color + "40", backgroundColor: cat.color + "10" }}
                        >
                          <span>{cat.icon}</span>
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleLoadDefaults}
                    disabled={saving}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      categoryChoice === "defaults"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-sm">Start with Defaults</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {categories.length > 0
                        ? `Keep your ${categories.length} existing categories and proceed.`
                        : `Get ${DEFAULT_CATEGORIES.length} common categories like Groceries, Dining, Transport, etc.`
                      }
                    </p>
                    {saving && categoryChoice === null && (
                      <Loader2 className="h-4 w-4 animate-spin mt-2 text-primary" />
                    )}
                  </button>

                  <button
                    onClick={handleStartEmpty}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      categoryChoice === "empty"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Start from Scratch</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Begin with no categories and add your own custom ones later via Settings.
                    </p>
                  </button>
                </div>

                {categoryChoice === null && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      Please choose one of the options above to continue.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== STEP 4: Cloud Storage ===== */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Step 4: Cloud Storage (Optional)
                </CardTitle>
                <CardDescription>
                  Connect a cloud storage provider to automatically organize receipts into folders by category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Warn if no categories */}
                {categoryChoice === "empty" && categories.length === 0 && (
                  <div className="space-y-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          No categories configured
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                          Cloud folder assignment works best when you have categories set up first. Each category can be linked to a specific cloud folder to auto-organize your receipts. Setting up categories first would make this step much more productive.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(3)}
                      className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Go Back to Categories
                    </Button>
                  </div>
                )}

                {/* Cloud connection status */}
                {hasCloudConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Cloud Storage Connected</p>
                        <p className="text-xs text-muted-foreground">
                          {cloudConnections.filter(c => c.isActive).map(c => c.provider === "googledrive" ? "Google Drive" : "OneDrive").join(", ")}
                        </p>
                      </div>
                    </div>

                    {/* Folder assignment status */}
                    {categories.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1">
                          <FolderOpen className="h-4 w-4" /> Category Folder Assignments
                        </Label>
                        <div className="space-y-1">
                          {categories.map((cat) => (
                            <div key={cat.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                              <span>{cat.icon}</span>
                              <span className="font-medium flex-1">{cat.name}</span>
                              {cat.cloudFolderId ? (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> {cat.cloudFolderName}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">No folder</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          You can assign folders to categories in Settings → Cloud Storage.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigateToSettings("cloud-storage")}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Go to Cloud Storage Settings
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg border border-dashed border-border text-center space-y-3">
                      <Cloud className="h-10 w-10 text-muted-foreground mx-auto" />
                      <div>
                        <p className="font-medium text-sm">No cloud storage connected yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Connect Google Drive or OneDrive to automatically organize your receipt files into folders by category.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => onNavigateToSettings("cloud-storage")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Connect in Cloud Storage Settings
                      </Button>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        This step is optional. You can always set up cloud storage later from Settings.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex gap-2">
          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
              className="gap-1 neon-glow"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="gap-1 neon-glow bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Finish Setup
            </Button>
          )}
        </div>
      </div>

      {/* Skip option */}
      <div className="text-center">
        <button
          onClick={handleFinish}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Skip for now — I&apos;ll set things up later
        </button>
      </div>
    </div>
  );
}
