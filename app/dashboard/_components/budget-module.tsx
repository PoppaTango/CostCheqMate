"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
// Select removed — no longer needed after multi-field budget editor refactor
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloudFolderPicker } from "@/components/cloud-folder-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const ActualsBreakdownDialog = dynamic(() => import("./actuals-breakdown-dialog"), { ssr: false });
import {
  PiggyBank,
  Edit2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Calculator,
  Info,
  Palette,
  HelpCircle,
  FolderOpen,
  Cloud,
  CloudOff,
  Plus,
  X,
  Link2,
} from "lucide-react";

interface CategoryBudget {
  id: string;
  name: string;
  icon: string;
  color: string;
  annualBudget: number;
  ytdBudget: number;
  spent: number;
  remaining: number;
  ytdRemaining: number;
  cloudFolderId?: string | null;
  cloudFolderName?: string | null;
}

interface BudgetSummary {
  categories: CategoryBudget[];
  totalBudget: number;
  totalYtdBudget: number;
  totalSpent: number;
  totalRemaining: number;
  totalYtdRemaining: number;
  elapsedFraction: number;
  fiscalYearStart: string;
  fiscalYearEnd: string;
}

interface BudgetModuleProps {
  onCustomize?: () => void;
}

export default function BudgetModule({ onCustomize }: BudgetModuleProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<CategoryBudget | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Multi-field budget editing — user can type in any field
  const [budgetFields, setBudgetFields] = useState({
    annual: "",
    monthly: "",
    biWeekly: "",
    weekly: "",
    semiMonthly: "",
  });
  const [activeField, setActiveField] = useState<string | null>(null);

  // Cloud folder mapping state
  const [cloudFolders, setCloudFolders] = useState<{ id: string; name: string }[]>([]);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<string>("");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // Actuals breakdown dialog state
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownCategory, setBreakdownCategory] = useState<CategoryBudget | null>(null);
  const [breakdownExpenses, setBreakdownExpenses] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const handleActualClick = useCallback(async (category: CategoryBudget) => {
    if (category.spent <= 0 || !summary) return;
    setBreakdownCategory(category);
    setBreakdownOpen(true);
    setBreakdownLoading(true);
    setBreakdownExpenses([]);

    try {
      const startDate = summary.fiscalYearStart.split("T")[0];
      const endDate = summary.fiscalYearEnd.split("T")[0];
      const res = await fetch(`/api/expenses?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const allExpenses = await res.json();
        const filtered = (allExpenses || []).filter((exp: any) => exp.categoryId === category.id);
        setBreakdownExpenses(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch expenses for breakdown:", error);
    } finally {
      setBreakdownLoading(false);
    }
  }, [summary]);

  useEffect(() => {
    fetchBudgetSummary();
    // Check cloud storage connection status on mount
    fetch("/api/cloud-storage/status")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const active = (data.connections || []).find((c: { isActive: boolean }) => c.isActive);
          setCloudConnected(!!active);
          setCloudProvider(active?.provider || "");
        }
      })
      .catch(() => {});
  }, []);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/budget-summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch budget summary:", error);
      toast({
        title: "Error",
        description: "Failed to load budget data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Derive the annual budget from whichever field was last edited
  const calculatedAnnualBudget = useMemo(() => {
    return parseFloat(budgetFields.annual) || 0;
  }, [budgetFields.annual]);

  // Helper to update all fields from a given annual value, excluding the active field
  const updateFieldsFromAnnual = useCallback((annual: number, sourceField: string) => {
    const fmt = (v: number) => (v === 0 ? "" : v % 1 === 0 ? v.toString() : v.toFixed(2));
    setBudgetFields((prev) => ({
      annual: sourceField === "annual" ? prev.annual : fmt(annual),
      monthly: sourceField === "monthly" ? prev.monthly : fmt(annual / 12),
      biWeekly: sourceField === "biWeekly" ? prev.biWeekly : fmt(annual / 26),
      weekly: sourceField === "weekly" ? prev.weekly : fmt(annual / 52),
      semiMonthly: sourceField === "semiMonthly" ? prev.semiMonthly : fmt(annual / 24),
    }));
  }, []);

  // Handler for when user types in any budget field
  const handleBudgetFieldChange = useCallback((field: string, value: string) => {
    setActiveField(field);
    const num = parseFloat(value) || 0;

    // Compute annual from the field being edited
    let annual = 0;
    switch (field) {
      case "annual": annual = num; break;
      case "monthly": annual = num * 12; break;
      case "biWeekly": annual = num * 26; break;
      case "weekly": annual = num * 52; break;
      case "semiMonthly": annual = num * 24; break;
    }

    // Update the source field directly with what the user typed, then derive the rest
    setBudgetFields((prev) => ({ ...prev, [field]: value }));
    // Use setTimeout to let the source field update first, then derive others
    const fmt = (v: number) => (v === 0 ? "" : v % 1 === 0 ? v.toString() : v.toFixed(2));
    setBudgetFields((prev) => ({
      ...prev,
      [field]: value, // keep exact user input
      ...(field !== "annual" && { annual: fmt(annual) }),
      ...(field !== "monthly" && { monthly: fmt(annual / 12) }),
      ...(field !== "biWeekly" && { biWeekly: fmt(annual / 26) }),
      ...(field !== "weekly" && { weekly: fmt(annual / 52) }),
      ...(field !== "semiMonthly" && { semiMonthly: fmt(annual / 24) }),
    }));
  }, []);

  const fetchCloudFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/cloud-storage/folders");
      if (res.ok) {
        const data = await res.json();
        setCloudFolders(data.folders || []);
        setCloudConnected(data.connected || false);
        setCloudProvider(data.provider || "");
      }
    } catch (err) {
      console.error("Failed to fetch cloud folders:", err);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/cloud-storage/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName: newFolderName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCloudFolders((prev) => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedFolderId(data.folder.id);
        setSelectedFolderName(data.folder.name);
        setNewFolderName("");
        setShowNewFolderInput(false);
        toast({ title: "Folder created", description: `"${data.folder.name}" created in your cloud storage.` });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create folder", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleEditBudget = (category: CategoryBudget) => {
    setEditingCategory(category);
    const annual = category.annualBudget;
    const fmt = (v: number) => (v === 0 ? "" : v % 1 === 0 ? v.toString() : v.toFixed(2));
    setBudgetFields({
      annual: fmt(annual),
      monthly: fmt(annual / 12),
      biWeekly: fmt(annual / 26),
      weekly: fmt(annual / 52),
      semiMonthly: fmt(annual / 24),
    });
    setActiveField(null);
    // Load cloud folder mapping
    setSelectedFolderId(category.cloudFolderId || null);
    setSelectedFolderName(category.cloudFolderName || null);
    setShowNewFolderInput(false);
    setNewFolderName("");
    fetchCloudFolders();
    setDialogOpen(true);
  };

  const handleSaveBudget = async () => {
    if (!editingCategory) return;
    
    setSavingBudget(true);
    try {
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualBudget: calculatedAnnualBudget,
          cloudFolderId: selectedFolderId,
          cloudFolderName: selectedFolderName,
        }),
      });

      if (res.ok) {
        toast({
          title: "Budget updated",
          description: `${editingCategory.name} budget has been updated to ${formatCurrency(calculatedAnnualBudget)}/year.`,
        });
        setDialogOpen(false);
        fetchBudgetSummary();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update budget.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Save budget error:", error);
      toast({
        title: "Error",
        description: "Failed to update budget.",
        variant: "destructive",
      });
    } finally {
      setSavingBudget(false);
    }
  };

  const getProgressColor = (spent: number, budget: number): string => {
    if (budget <= 0) return "bg-gray-400";
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return "bg-rose-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-teal-500";
  };

  const getStatusIcon = (spent: number, budget: number) => {
    if (budget <= 0) return null;
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) {
      return <AlertTriangle className="h-4 w-4 text-rose-500" aria-label="Over budget" />;
    }
    if (percentage >= 80) {
      return <TrendingUp className="h-4 w-4 text-amber-500" aria-label="Approaching budget limit" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-teal-500" aria-label="Within budget" />;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = summary?.categories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" />
            Budget Overview
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Annual Budget Management</p>
                <p className="text-xs">Set budgets per category to control spending. Click the edit icon to adjust amounts. Progress bars show spending vs. budget - green is healthy, amber is caution, red is over budget.</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Track your annual budget allocation and spending across categories
          </p>
        </div>
        {onCustomize && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={onCustomize} className="gap-2">
                <Palette className="h-4 w-4" />
                Customize Colors & Emojis
              </Button>
            </TooltipTrigger>
            <TooltipContent>Change category icons and colors in Settings</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Budget</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {formatCurrency(summary?.totalBudget ?? 0)}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                  {formatCurrency((summary?.totalBudget ?? 0) / 12)}/month
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-900/10 border-teal-200 dark:border-teal-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Total Spent</p>
                <p className="text-2xl font-bold text-teal-900 dark:text-teal-100 mt-1">
                  {formatCurrency(summary?.totalSpent ?? 0)}
                </p>
                <p className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-1">
                  {((summary?.totalSpent ?? 0) / (summary?.totalBudget ?? 1) * 100).toFixed(1)}% of budget
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className={`bg-gradient-to-br ${(summary?.totalYtdRemaining ?? 0) >= 0 ? 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-900/10 border-rose-200 dark:border-rose-800'}`}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-sm font-medium ${(summary?.totalYtdRemaining ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>YTD Remaining</p>
                <p className={`text-2xl font-bold mt-1 ${(summary?.totalYtdRemaining ?? 0) >= 0 ? 'text-emerald-900 dark:text-emerald-100' : 'text-rose-900 dark:text-rose-100'}`}>
                  {formatCurrency(summary?.totalYtdRemaining ?? 0)}
                </p>
                <p className={`text-xs mt-1 ${(summary?.totalYtdRemaining ?? 0) >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-rose-600/70 dark:text-rose-400/70'}`}>
                  of {formatCurrency(summary?.totalYtdBudget ?? 0)} prorated YTD
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Cloud Storage Connection Banner */}
      {!cloudConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5">
            <CardContent className="py-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CloudOff className="h-6 w-6 text-primary/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">Connect OneDrive or Google Drive</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically back up scanned receipts as PDFs to cloud folders mapped to each budget category — perfect for tax season.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0 border-primary/30 hover:bg-primary/10"
                  onClick={() => { window.location.href = "/dashboard?tab=cloud-storage"; }}
                >
                  <Link2 className="h-4 w-4" />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-primary/20 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {cloudProvider === "onedrive" ? "OneDrive" : "Google Drive"} Connected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Edit a category below to map it to a specific cloud folder for automatic receipt filing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Unmapped categories warning */}
      {cloudConnected && categories.length > 0 && categories.some(c => !c.cloudFolderId) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {categories.filter(c => !c.cloudFolderId).length} of {categories.length} categories need a cloud folder
              </p>
              <p className="text-xs text-muted-foreground">
                Assign folders in Settings → Categories or Settings → Cloud to auto-file receipts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => { window.location.href = "/dashboard?tab=cloud-storage"; }}
            >
              Fix Now
            </Button>
          </div>
        </motion.div>
      )}

      {/* Category Budgets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category Budgets</CardTitle>
          <CardDescription>
            Click edit to set budget in your preferred unit (monthly, bi-weekly, etc.)
            {cloudConnected && " • Map each category to a cloud folder for automatic receipt backup."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category, index) => {
              const percentage = category.ytdBudget > 0
                ? Math.min((category.spent / category.ytdBudget) * 100, 100)
                : 0;
              const monthlyBudget = category.annualBudget / 12;
              const biWeeklyBudget = category.annualBudget / 26;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" role="img" aria-label={category.name}>
                        {category.icon}
                      </span>
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          {category.name}
                          {getStatusIcon(category.spent, category.annualBudget)}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {category.spent > 0 ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleActualClick(category); }}
                              className="text-primary hover:underline font-medium cursor-pointer"
                              title={`Click to see ${category.name} expenses`}
                            >
                              {formatCurrency(category.spent)}
                            </button>
                          ) : (
                            <span>{formatCurrency(category.spent)}</span>
                          )}{" "}
                          of {formatCurrency(category.annualBudget)}/yr
                        </p>
                        {category.annualBudget > 0 && (
                          <p className="text-xs text-muted-foreground/70">
                            ({formatCurrency(monthlyBudget)}/mo • {formatCurrency(biWeeklyBudget)}/bi-weekly)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium px-2 py-1 rounded ${category.ytdRemaining >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                        {category.ytdRemaining >= 0 ? '+' : ''}{formatCurrency(category.ytdRemaining)}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditBudget(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit budget for {category.name}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <Progress
                    value={percentage}
                    className="h-3"
                    indicatorClassName={getProgressColor(category.spent, category.ytdBudget)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{percentage.toFixed(1)}% of YTD used</span>
                    <span>
                      {category.ytdBudget > 0 && category.ytdRemaining > 0
                        ? `${formatCurrency(category.ytdBudget)} prorated YTD`
                        : category.annualBudget <= 0
                        ? "No budget set"
                        : "Over YTD budget"}
                    </span>
                  </div>
                  {category.cloudFolderName && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-primary/70">
                      <FolderOpen className="h-3 w-3" />
                      <span>{category.cloudFolderName}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{editingCategory?.icon}</span>
              Edit {editingCategory?.name} Budget
            </DialogTitle>
            <DialogDescription>
              Enter your budget in any frequency - we'll calculate the annual total automatically
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Annual Total — Primary field */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-cyan-500/10 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <Label htmlFor="budget-annual" className="font-semibold text-sm">Annual Total</Label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="budget-annual"
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetFields.annual}
                  onChange={(e) => handleBudgetFieldChange("annual", e.target.value)}
                  onFocus={() => setActiveField("annual")}
                  placeholder="0.00"
                  className="pl-7 text-lg font-bold"
                />
              </div>
              <p className="text-xs text-muted-foreground">per year</p>
            </div>

            {/* Period Fields — all editable, type in any one to update the rest */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Type in any field — all others update automatically</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "monthly", label: "Monthly", hint: "×12/yr" },
                  { key: "biWeekly", label: "Bi-Weekly", hint: "×26/yr" },
                  { key: "weekly", label: "Weekly", hint: "×52/yr" },
                  { key: "semiMonthly", label: "Semi-Monthly", hint: "×24/yr" },
                ].map(({ key, label, hint }) => (
                  <div key={key} className={`p-3 rounded-lg border transition-colors ${activeField === key ? "border-primary bg-primary/5" : "bg-muted/30 border-transparent"}`}>
                    <Label htmlFor={`budget-${key}`} className="text-xs text-muted-foreground flex items-center justify-between mb-1.5">
                      <span>{label}</span>
                      <span className="text-[10px] opacity-60">{hint}</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        id={`budget-${key}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={budgetFields[key as keyof typeof budgetFields]}
                        onChange={(e) => handleBudgetFieldChange(key, e.target.value)}
                        onFocus={() => setActiveField(key)}
                        placeholder="0.00"
                        className="pl-6 h-9 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Cloud Folder Mapping — Simple picker */}
          {cloudConnected && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">
                  {cloudProvider === "onedrive" ? "OneDrive" : "Google Drive"} Folder
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Receipts filed under this category will save to the selected folder.
              </p>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setFolderPickerOpen(true)}
                  className="flex-1 justify-start gap-2"
                >
                  <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">
                    {selectedFolderName || "Select Folder"}
                  </span>
                </Button>
                {selectedFolderName && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setSelectedFolderId(null); setSelectedFolderName(null); }}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <CloudFolderPicker
                open={folderPickerOpen}
                onOpenChange={setFolderPickerOpen}
                provider={cloudProvider}
                onSelect={(folderId, folderName) => {
                  setSelectedFolderId(folderId);
                  setSelectedFolderName(folderName);
                }}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBudget} disabled={savingBudget} className="neon-glow-hover">
              {savingBudget && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actuals Breakdown Dialog */}
      <ActualsBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        categoryName={breakdownCategory?.name || ""}
        categoryIcon={breakdownCategory?.icon || "📊"}
        periodLabel={summary ? `Fiscal Year (${new Date(summary.fiscalYearStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(summary.fiscalYearEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })})` : ""}
        totalAmount={breakdownCategory?.spent || 0}
        expenses={breakdownExpenses}
        formatCurrency={formatCurrency}
        loading={breakdownLoading}
      />
    </div>
  );
}