"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Edit2,
  Trash2,
  Loader2,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Store,
  Tag,
  FileText,
  HelpCircle,
  Receipt,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  ImageIcon,
  Download,
} from "lucide-react";
import type { Category } from "@/lib/types";

interface Expense {
  id: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  date: string;
  categoryId: string;
  category?: Category;
  receiptUrl?: string | null;
  receiptKey?: string | null;
  createdAt: string;
}

// Lazy-loading receipt thumbnail component
function ReceiptThumbnail({ expenseId, onClick }: { expenseId: string; onClick: () => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/expenses/${expenseId}/receipt`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.url) setThumbUrl(data.url);
        else if (!cancelled) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [expenseId]);

  return (
    <button
      onClick={onClick}
      className="relative shrink-0 w-10 h-[52px] sm:w-11 sm:h-14 rounded-md overflow-hidden border border-border/50 bg-muted/50 hover:border-primary/50 hover:ring-1 hover:ring-primary/20 transition-all cursor-pointer group"
      title="View receipt"
    >
      {thumbUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt="Receipt"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </button>
  );
}

interface EditExpensesModuleProps {
  onCheqsChange?: () => void;
}

export default function EditExpensesModule({ onCheqsChange }: EditExpensesModuleProps) {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Edit state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    amount: "",
    merchant: "",
    description: "",
    date: "",
    categoryId: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Receipt viewer state
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptFilename, setReceiptFilename] = useState<string>("receipt");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);

  // Bulk download state
  const [bulkDownloadStart, setBulkDownloadStart] = useState("");
  const [bulkDownloadEnd, setBulkDownloadEnd] = useState("");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState({ current: 0, total: 0 });

  const handleViewReceipt = async (expense: Expense) => {
    setReceiptExpense(expense);
    setReceiptLoading(true);
    setReceiptDialogOpen(true);
    setReceiptUrl(null);

    try {
      // Fetch inline URL for viewing
      const res = await fetch(`/api/expenses/${expense.id}/receipt`);
      if (res.ok) {
        const data = await res.json();
        setReceiptUrl(data.url);
        setReceiptFilename(data.filename || "receipt");
      } else {
        toast({
          title: "Receipt unavailable",
          description: "Could not load the receipt. It may have been removed.",
          variant: "destructive",
        });
        setReceiptDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to load receipt:", error);
      toast({
        title: "Error",
        description: "Failed to load receipt.",
        variant: "destructive",
      });
      setReceiptDialogOpen(false);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptExpense) return;
    try {
      // Fetch a download URL (with Content-Disposition: attachment and proper filename)
      const res = await fetch(`/api/expenses/${receiptExpense.id}/receipt?mode=download`);
      if (res.ok) {
        const data = await res.json();
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || receiptFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download receipt error:", error);
      toast({ title: "Failed to download receipt", variant: "destructive" });
    }
  };

  // Bulk download all receipts in a date range
  const handleBulkDownload = async () => {
    if (!bulkDownloadStart || !bulkDownloadEnd) {
      toast({ title: "Please select both start and end dates", variant: "destructive" });
      return;
    }

    const start = new Date(bulkDownloadStart);
    const end = new Date(bulkDownloadEnd);
    if (start > end) {
      toast({ title: "Start date must be before end date", variant: "destructive" });
      return;
    }

    // Find expenses with receipts in the date range
    const expensesWithReceipts = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      return (
        expDate >= start &&
        expDate <= end &&
        (exp.receiptUrl || exp.receiptKey)
      );
    });

    if (expensesWithReceipts.length === 0) {
      toast({ title: "No receipts found in this date range" });
      return;
    }

    setBulkDownloading(true);
    setBulkDownloadProgress({ current: 0, total: expensesWithReceipts.length });

    let downloaded = 0;
    for (const expense of expensesWithReceipts) {
      try {
        const res = await fetch(`/api/expenses/${expense.id}/receipt?mode=download`);
        if (res.ok) {
          const data = await res.json();
          const a = document.createElement("a");
          a.href = data.url;
          a.download = data.filename || "receipt";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (error) {
        console.error(`Failed to download receipt for expense ${expense.id}:`, error);
      }
      downloaded++;
      setBulkDownloadProgress({ current: downloaded, total: expensesWithReceipts.length });
      // Small delay between downloads to avoid browser blocking
      if (downloaded < expensesWithReceipts.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setBulkDownloading(false);
    toast({
      title: `Downloaded ${downloaded} receipt${downloaded !== 1 ? "s" : ""}`,
      description: `${bulkDownloadStart} to ${bulkDownloadEnd}`,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expensesRes, categoriesRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/categories"),
      ]);

      if (expensesRes.ok) {
        const data = await expensesRes.json();
        setExpenses(data ?? []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort expenses
  const filteredExpenses = expenses
    .filter((expense) => {
      const matchesSearch =
        searchTerm === "" ||
        expense.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || expense.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case "newest":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "oldest":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "highest":
          return b.amount - a.amount;
        case "lowest":
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setEditForm({
      amount: expense.amount.toString(),
      merchant: expense.merchant || "",
      description: expense.description || "",
      date: expense.date.split("T")[0],
      categoryId: expense.categoryId,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          merchant: editForm.merchant || null,
          description: editForm.description || null,
          date: editForm.date,
          categoryId: editForm.categoryId,
        }),
      });

      if (res.ok) {
        toast({
          title: "Expense updated",
          description: "Your expense has been updated successfully.",
        });
        setEditDialogOpen(false);
        fetchData();
        onCheqsChange?.();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update expense.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Update expense error:", error);
      toast({
        title: "Error",
        description: "Failed to update expense.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;

    setDeletingId(expenseToDelete.id);
    try {
      const res = await fetch(`/api/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Expense deleted",
          description: "Your expense has been removed.",
        });
        setDeleteDialogOpen(false);
        fetchData();
        onCheqsChange?.();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete expense.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Delete expense error:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate totals
  const totalFiltered = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Edit Expenses
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Expense Management</p>
                <p className="text-xs">View, search, filter, edit, and delete all your expense entries. Scroll through your entire expense history in the list below.</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            {expenses.length} total expenses • {filteredExpenses.length} shown
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Filtered Total</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalFiltered)}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchant, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
              <SelectTrigger>
                {sortOrder === "newest" || sortOrder === "oldest" ? (
                  <Calendar className="h-4 w-4 mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Amount</SelectItem>
                <SelectItem value="lowest">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Download Receipts */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Download className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Bulk Download Receipts</span>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input
                  type="date"
                  value={bulkDownloadStart}
                  onChange={(e) => setBulkDownloadStart(e.target.value)}
                  disabled={bulkDownloading}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                <Input
                  type="date"
                  value={bulkDownloadEnd}
                  onChange={(e) => setBulkDownloadEnd(e.target.value)}
                  disabled={bulkDownloading}
                />
              </div>
            </div>
            <Button
              onClick={handleBulkDownload}
              disabled={bulkDownloading || !bulkDownloadStart || !bulkDownloadEnd}
              className="shrink-0"
              size="sm"
            >
              {bulkDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {bulkDownloadProgress.current}/{bulkDownloadProgress.total}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expense List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expense History</CardTitle>
          <CardDescription>
            Click edit to modify an entry or delete to remove it permanently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] sm:h-[500px] pr-2 sm:pr-4">
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No expenses found matching your criteria.</p>
                  </div>
                ) : (
                  filteredExpenses.map((expense, index) => (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.02 }}
                      className="p-3 sm:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                    >
                      {/* ===== MOBILE: Stacked card layout ===== */}
                      <div className="sm:hidden space-y-2">
                        {/* Row 1: Icon/thumbnail + merchant + amount */}
                        <div className="flex items-center gap-3">
                          {(expense.receiptUrl || expense.receiptKey) ? (
                            <ReceiptThumbnail
                              expenseId={expense.id}
                              onClick={() => handleViewReceipt(expense)}
                            />
                          ) : (
                            <span className="text-2xl shrink-0 w-10 flex items-center justify-center" role="img" aria-label={expense.category?.name}>
                              {expense.category?.icon || "📦"}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm leading-tight">
                              {expense.merchant || expense.category?.name || "Expense"}
                            </h4>
                          </div>
                          <span className="font-bold text-lg text-primary whitespace-nowrap shrink-0">
                            {formatCurrency(expense.amount)}
                          </span>
                        </div>

                        {/* Row 2: Category badge + date */}
                        <div className="flex items-center gap-2 flex-wrap pl-[52px]">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                            {expense.category?.icon} {expense.category?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(expense.date)}
                          </span>
                        </div>

                        {/* Row 3: Description if exists */}
                        {expense.description && (
                          <p className="text-xs text-muted-foreground pl-[52px]">
                            {expense.description}
                          </p>
                        )}

                        {/* Row 4: Actions */}
                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/30">
                          {(expense.receiptUrl || expense.receiptKey) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReceipt(expense)}
                              className="h-9 text-xs gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Receipt
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(expense)}
                            className="h-9 text-xs gap-1.5"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(expense)}
                            disabled={deletingId === expense.id}
                            className="h-9 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive"
                          >
                            {deletingId === expense.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* ===== DESKTOP: Original row layout ===== */}
                      <div className="hidden sm:flex items-start gap-3">
                        {/* Receipt thumbnail or category emoji */}
                        {(expense.receiptUrl || expense.receiptKey) ? (
                          <ReceiptThumbnail
                            expenseId={expense.id}
                            onClick={() => handleViewReceipt(expense)}
                          />
                        ) : (
                          <span className="text-2xl shrink-0 w-11 flex items-center justify-center" role="img" aria-label={expense.category?.name}>
                            {expense.category?.icon || "📦"}
                          </span>
                        )}

                        {/* Main content area */}
                        <div className="flex-1 min-w-0">
                          {/* Top row: merchant + amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-base">
                                  {expense.merchant || expense.category?.name || "Expense"}
                                </h4>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                                  {expense.category?.name}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {formatDate(expense.date)}
                              </p>
                              {expense.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {expense.description}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-lg whitespace-nowrap shrink-0">
                              {formatCurrency(expense.amount)}
                            </span>
                          </div>

                          {/* Action buttons row */}
                          <div className="flex items-center justify-end gap-1 mt-1.5 -mr-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditClick(expense)}
                                  className="h-8 w-8"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit expense</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(expense)}
                                  disabled={deletingId === expense.id}
                                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  {deletingId === expense.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete expense</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Expense
            </DialogTitle>
            <DialogDescription>
              Make changes to this expense entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-merchant">Merchant</Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-merchant"
                  value={editForm.merchant}
                  onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date">Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select
                value={editForm.categoryId}
                onValueChange={(v) => setEditForm({ ...editForm, categoryId: v })}
              >
                <SelectTrigger>
                  <Tag className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving || !editForm.amount || !editForm.categoryId || !editForm.date}
              className="neon-glow-hover"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Expense
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {expenseToDelete && (
            <div className="py-4 px-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{expenseToDelete.category?.icon}</span>
                <div>
                  <p className="font-medium">
                    {expenseToDelete.merchant || expenseToDelete.category?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(expenseToDelete.date)} • {formatCurrency(expenseToDelete.amount)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-500" />
              Receipt
              {receiptExpense && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {receiptExpense.merchant || receiptExpense.category?.name || "Expense"}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {receiptExpense && (
                <span>
                  {formatDate(receiptExpense.date)} • {formatCurrency(receiptExpense.amount)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-[400px] max-h-[70vh] overflow-auto rounded-lg bg-muted/30 flex items-center justify-center">
            {receiptLoading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Loading receipt...</p>
              </div>
            ) : receiptUrl ? (
              // Check if it's a PDF or an image
              receiptUrl.toLowerCase().includes(".pdf") ? (
                <div className="w-full h-full flex flex-col">
                  {/* PDF iframe viewer */}
                  <iframe
                    src={receiptUrl}
                    className="w-full flex-1 min-h-[500px] rounded border-0"
                    title="PDF Receipt Viewer"
                  />
                  {/* Fallback message below iframe */}
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Can&apos;t see the PDF? Use the Download button below.
                  </p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receiptUrl}
                  alt="Receipt"
                  className="max-w-full max-h-[60vh] object-contain rounded"
                  onError={(e) => {
                    // If image fails to load, try as iframe (might be PDF with wrong extension)
                    const parent = (e.target as HTMLImageElement).parentElement!;
                    (e.target as HTMLImageElement).style.display = "none";
                    const iframe = document.createElement("iframe");
                    iframe.src = receiptUrl || "";
                    iframe.className = "w-full min-h-[500px] rounded border-0";
                    iframe.title = "Receipt Viewer";
                    parent.appendChild(iframe);
                  }}
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                <Receipt className="h-12 w-12 opacity-30" />
                <p>Receipt could not be loaded</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {receiptUrl && (
              <Button variant="outline" onClick={handleDownloadReceipt} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Download
              </Button>
            )}
            <Button onClick={() => setReceiptDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
