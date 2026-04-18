"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, Loader2, ExternalLink, Eye, FileText, ImageIcon } from "lucide-react";

interface BreakdownExpense {
  id: string;
  amount: number;
  date: string;
  merchant: string | null;
  description: string | null;
  receiptUrl: string | null;
  receiptKey: string | null;
  category?: { name: string; icon: string } | null;
}

interface ActualsBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  categoryIcon: string;
  periodLabel: string;
  totalAmount: number;
  expenses: BreakdownExpense[];
  formatCurrency: (amount: number) => string;
  loading?: boolean;
}

export default function ActualsBreakdownDialog({
  open,
  onOpenChange,
  categoryName,
  categoryIcon,
  periodLabel,
  totalAmount,
  expenses,
  formatCurrency,
  loading = false,
}: ActualsBreakdownDialogProps) {
  const [viewingReceipt, setViewingReceipt] = useState<BreakdownExpense | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const handleViewReceipt = async (expense: BreakdownExpense) => {
    setViewingReceipt(expense);
    setReceiptLoading(true);
    setReceiptUrl(null);

    try {
      const res = await fetch(`/api/expenses/${expense.id}/receipt`);
      if (res.ok) {
        const data = await res.json();
        setReceiptUrl(data.url);
      }
    } catch (error) {
      console.error("Failed to load receipt:", error);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleDownloadReceipt = async (expense: BreakdownExpense) => {
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
      console.error("Download receipt error:", error);
    }
  };

  const handleBack = () => {
    setViewingReceipt(null);
    setReceiptUrl(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const hasReceipt = (exp: BreakdownExpense) => !!(exp.receiptUrl || exp.receiptKey);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setViewingReceipt(null); setReceiptUrl(null); } }}>
      <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[90vh]">
        {viewingReceipt ? (
          // Receipt Viewer Mode
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-500" />
                Receipt
                <span className="text-sm font-normal text-muted-foreground">
                  — {viewingReceipt.merchant || categoryName}
                </span>
              </DialogTitle>
              <DialogDescription>
                {formatDate(viewingReceipt.date)} • {formatCurrency(viewingReceipt.amount)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-[400px] max-h-[70vh] overflow-auto rounded-lg bg-muted/30 flex items-center justify-center">
              {receiptLoading ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p>Loading receipt...</p>
                </div>
              ) : receiptUrl ? (
                receiptUrl.toLowerCase().includes(".pdf") ? (
                  <div className="w-full h-full flex flex-col">
                    <iframe
                      src={receiptUrl}
                      className="w-full flex-1 min-h-[500px] rounded border-0"
                      title="PDF Receipt Viewer"
                    />
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

            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" onClick={handleBack}>
                ← Back to Items
              </Button>
              <div className="flex-1" />
              {receiptUrl && (
                <Button variant="outline" onClick={() => handleDownloadReceipt(viewingReceipt)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Download
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          // Line Items List Mode
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-xl">{categoryIcon}</span>
                {categoryName} — Actuals Breakdown
              </DialogTitle>
              <DialogDescription>
                {periodLabel} • Total: {formatCurrency(totalAmount)} • {expenses.length} item{expenses.length !== 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-2">
              <div className="space-y-2">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground py-10">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Loading expenses...</p>
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground py-10">
                    <Receipt className="h-10 w-10 opacity-30" />
                    <p>No expenses found</p>
                  </div>
                ) : (
                  expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {/* Receipt thumbnail / icon */}
                      <div className="shrink-0">
                        {hasReceipt(expense) ? (
                          <button
                            onClick={() => handleViewReceipt(expense)}
                            className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center hover:bg-blue-500/20 transition-colors cursor-pointer"
                            title="View receipt"
                          >
                            <FileText className="h-6 w-6 text-blue-500" />
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center">
                            <Receipt className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">
                            {expense.merchant || expense.description || "Expense"}
                          </p>
                          <p className="font-semibold text-primary shrink-0">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(expense.date)}</span>
                          {expense.description && expense.merchant && (
                            <span className="truncate">• {expense.description}</span>
                          )}
                        </div>
                      </div>

                      {/* View receipt button */}
                      {hasReceipt(expense) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewReceipt(expense)}
                          className="shrink-0"
                          title="View receipt"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
