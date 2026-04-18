"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Calendar,
  DollarSign,
  Store,
  Tag,
  Sparkles,
  ScanLine,
  Eye,
  FileText,
  Crown,
  Lock,
  HelpCircle,
  CreditCard,
  ListChecks,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Check,
  Cloud,
  CloudOff,
} from "lucide-react";
import DocumentCropper from "./document-cropper";
import { jsPDF } from "jspdf";
import type { Category } from "@/lib/types";

interface ExtractedData {
  merchant: string;
  date: string;
  amount: string;
}

interface TransactionItem {
  merchant: string;
  amount: string;
  date: string;
  description?: string;
  categoryId?: string;
}

interface ScanModuleProps {
  isPremium?: boolean;
  onUpgrade?: () => void;
}

type ScanMode = "receipt" | "bank-transcript";
type ScanningStep = "idle" | "uploading" | "analyzing" | "extracting" | "suggesting" | "complete" | "error";

const SCANNING_STEPS: Record<ScanningStep, { message: string; progress: number }> = {
  idle: { message: "", progress: 0 },
  uploading: { message: "Uploading image...", progress: 15 },
  analyzing: { message: "AI is analyzing the image...", progress: 40 },
  extracting: { message: "Extracting transaction data...", progress: 70 },
  suggesting: { message: "Finding category suggestions...", progress: 90 },
  complete: { message: "Scan complete!", progress: 100 },
  error: { message: "Scan failed. Please enter details manually.", progress: 0 },
};

/** Sanitize merchant name for safe use in filenames */
function sanitizeMerchant(name: string): string {
  if (!name || !name.trim()) return "Receipt";
  return name
    .trim()
    .replace(/[/\\:*?"<>|]/g, "") // remove filesystem-unsafe chars
    .replace(/\s+/g, " ")          // collapse whitespace
    .substring(0, 60);             // cap length
}

/** Build the standardized receipt filename: YYYY-MM-DD - MerchantName - 00.00.pdf */
function buildReceiptFilename(dateStr: string, merchantName: string, amountStr: string): string {
  // Format date as YYYY-MM-DD (should already be in this format from the date input)
  let formattedDate = "0000-00-00";
  if (dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (!isNaN(d.getTime())) {
      formattedDate = d.toISOString().slice(0, 10);
    }
  }
  const safeMerchant = sanitizeMerchant(merchantName);
  const num = parseFloat(amountStr || "0");
  const formattedAmount = isNaN(num) ? "0.00" : num.toFixed(2);
  return `${formattedDate} - ${safeMerchant} - ${formattedAmount}.pdf`;
}

/** Convert an image File to a single-page PDF File using jsPDF */
async function imageFileToPdf(imageFile: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const MAX_W = 8.5 * 72;  // 612 pts
        const MAX_H = 11 * 72;   // 792 pts
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(MAX_W / w, MAX_H / h, 1);
        w *= scale;
        h *= scale;
        const orientation = w > h ? "l" : "p";
        const doc = new jsPDF({ orientation, unit: "pt", format: [w, h] });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        doc.addImage(dataUrl, "JPEG", 0, 0, w, h);
        const pdfBlob = doc.output("blob");
        resolve(new File([pdfBlob], "scanned-receipt.pdf", { type: "application/pdf" }));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for PDF conversion"));
    img.src = URL.createObjectURL(imageFile);
  });
}

export default function ScanModule({ isPremium = false, onUpgrade }: ScanModuleProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scanningStep, setScanningStep] = useState<ScanningStep>("idle");
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  
  // Scan mode state
  const [scanMode, setScanMode] = useState<ScanMode>("receipt");
  
  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Bank transcript state
  const [extractedTransactions, setExtractedTransactions] = useState<TransactionItem[]>([]);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [savedTransactions, setSavedTransactions] = useState<number[]>([]);
  const [isCategorizing, setIsCategorizing] = useState(false);
  
  // Cloud storage state
  const [cloudConnection, setCloudConnection] = useState<{
    id: string;
    provider: string;
    accountEmail: string;
    isActive: boolean;
  } | null>(null);
  const [cloudUploadStatus, setCloudUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  
  // Form state
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  // Refs to always have the latest OCR functions (prevents stale closure in useCallback)
  const performOCRRef = useRef<(file: File) => Promise<void>>(async () => {});
  const performBankTranscriptOCRRef = useRef<(file: File) => Promise<void>>(async () => {});

  const isScanning = scanningStep !== "idle" && scanningStep !== "complete" && scanningStep !== "error";
  const currentTransaction = extractedTransactions[currentTransactionIndex];

  useEffect(() => {
    fetchCategories();
    fetchCloudStorageStatus();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchCloudStorageStatus = async () => {
    try {
      const res = await fetch("/api/cloud-storage/status");
      if (res.ok) {
        const data = await res.json();
        const active = data.connections?.find((c: { isActive: boolean }) => c.isActive);
        if (active) {
          setCloudConnection(active);
        }
      }
    } catch (error) {
      console.error("Failed to fetch cloud storage status:", error);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    
    if (!isImage && !isPDF) {
      toast({
        title: "Invalid file type",
        description: "Please select an image (JPEG, PNG) or PDF file.",
        variant: "destructive",
      });
      return;
    }

    setExtractedData(null);
    setExtractedTransactions([]);
    setCurrentTransactionIndex(0);
    setSavedTransactions([]);
    setIsCategorizing(false);

    // For images, show the document cropper first
    if (isImage) {
      const url = URL.createObjectURL(file);
      setCropperImageUrl(url);
      setPendingFile(file);
      setShowCropper(true);
      return;
    }

    // For PDFs, skip cropper and go straight to OCR
    setSelectedFile(file);
    setPreviewUrl("__PDF__");
    
    if (scanMode === "bank-transcript") {
      await performBankTranscriptOCR(file);
    } else {
      await performOCR(file);
    }
  }, [toast, scanMode]);

  const handleCropComplete = useCallback(async (croppedFile: File) => {
    setShowCropper(false);
    setCropperImageUrl(null);
    setPendingFile(null);
    
    setSelectedFile(croppedFile);
    // Cropped output is always a PDF — use the PDF marker instead of blob URL
    setPreviewUrl(croppedFile.type === "application/pdf" ? "__PDF__" : URL.createObjectURL(croppedFile));
    
    // Now run OCR on the cropped, flattened image (use refs to avoid stale closure)
    if (scanMode === "bank-transcript") {
      await performBankTranscriptOCRRef.current(croppedFile);
    } else {
      await performOCRRef.current(croppedFile);
    }
  }, [scanMode]);

  const handleCropSkip = useCallback(async () => {
    setShowCropper(false);
    setCropperImageUrl(null);
    
    if (pendingFile) {
      // If it's an image, convert to PDF; if already PDF, keep as-is
      let fileToUse = pendingFile;
      if (pendingFile.type.startsWith("image/")) {
        try {
          fileToUse = await imageFileToPdf(pendingFile);
        } catch (err) {
          console.error("Failed to convert image to PDF on skip-crop:", err);
          // Fall back to original image file
          fileToUse = pendingFile;
        }
      }

      setSelectedFile(fileToUse);
      // For PDFs, show placeholder; for images (fallback), show preview
      if (fileToUse.type === "application/pdf") {
        setPreviewUrl("__PDF__");
      } else {
        setPreviewUrl(URL.createObjectURL(fileToUse));
      }
      setPendingFile(null);
      
      // OCR still works on the original pending file (image) for better extraction (use refs to avoid stale closure)
      if (scanMode === "bank-transcript") {
        await performBankTranscriptOCRRef.current(pendingFile);
      } else {
        await performOCRRef.current(pendingFile);
      }
    }
  }, [pendingFile, scanMode]);

  const performOCR = async (file: File) => {
    setScanningStep("uploading");
    
    try {
      // Simulate brief upload delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));
      setScanningStep("analyzing");

      // Create form data for OCR
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      setScanningStep("extracting");
      await new Promise(resolve => setTimeout(resolve, 200));

      if (res.ok) {
        const data = await res.json();
        
        // Check if OCR actually extracted meaningful data (not just empty strings from an API error)
        const hasData = !!(data.merchant || data.amount);
        
        if (hasData) {
          setExtractedData(data);
          setMerchant(data.merchant || "");
          setDate(data.date || new Date().toISOString().split("T")[0]);
          setAmount(data.amount || "");
          
          // Auto-suggest category based on merchant - PREMIUM FEATURE ONLY
          if (data.merchant && isPremium) {
            setScanningStep("suggesting");
            try {
              const suggestRes = await fetch(`/api/merchant-suggest?merchant=${encodeURIComponent(data.merchant)}`);
              if (suggestRes.ok) {
                const suggestData = await suggestRes.json();
                if (suggestData.categoryId) {
                  setCategoryId(suggestData.categoryId);
                  setSuggestedCategoryId(suggestData.categoryId);
                }
              }
            } catch {
              // Ignore suggestion errors
            }
          } else if (data.merchant && !isPremium) {
            // Show that category prediction is a premium feature
            setSuggestedCategoryId(null);
          }

          setScanningStep("complete");
          
          // Show success message after a moment
          setTimeout(() => {
            toast({
              title: "Receipt scanned successfully!",
              description: isPremium 
                ? "Review and modify the extracted data if needed."
                : "Review the data. Upgrade to Premium for smart category suggestions!",
            });
          }, 500);
        } else {
          // OCR returned empty data (API error, credits exhausted, etc.)
          console.error("OCR returned empty data:", data);
          setExtractedData(null);
          setDate(new Date().toISOString().split("T")[0]);
          setScanningStep("error");
          toast({
            title: "Couldn't read the receipt",
            description: data.error || "Please enter the details manually below.",
            variant: "destructive",
          });
        }
      } else {
        setScanningStep("error");
        toast({
          title: "Scan couldn't extract data",
          description: "Please enter the receipt details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("OCR error:", error);
      setScanningStep("error");
      toast({
        title: "Scan error",
        description: "Please enter the receipt details manually.",
        variant: "destructive",
      });
    }
  };

  const performBankTranscriptOCR = async (file: File) => {
    setScanningStep("uploading");
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      setScanningStep("analyzing");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr/bank-transcript", {
        method: "POST",
        body: formData,
      });

      setScanningStep("extracting");
      await new Promise(resolve => setTimeout(resolve, 200));

      if (res.ok) {
        const data = await res.json();
        
        if (data.transactions && data.transactions.length > 0) {
          setExtractedTransactions(data.transactions);
          setScanningStep("complete");
          setIsCategorizing(true);
          
          // Set up first transaction for categorization
          const firstTx = data.transactions[0];
          setMerchant(firstTx.merchant || "");
          setDate(firstTx.date || new Date().toISOString().split("T")[0]);
          setAmount(firstTx.amount || "");
          setDescription(firstTx.description || "");
          setCategoryId("");
          
          setTimeout(() => {
            toast({
              title: `Found ${data.transactions.length} transaction${data.transactions.length > 1 ? 's' : ''}!`,
              description: "Now let's categorize each expense one by one.",
            });
          }, 500);
        } else {
          setScanningStep("error");
          toast({
            title: "No transactions found",
            description: "The image may not contain visible transactions. Try a clearer screenshot.",
            variant: "destructive",
          });
        }
      } else {
        setScanningStep("error");
        toast({
          title: "Scan couldn't extract data",
          description: "Please try a different image or enter details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Bank transcript OCR error:", error);
      setScanningStep("error");
      toast({
        title: "Scan error",
        description: "Please try again or enter details manually.",
        variant: "destructive",
      });
    }
  };

  // Keep refs updated so useCallback closures always call the latest version
  performOCRRef.current = performOCR;
  performBankTranscriptOCRRef.current = performBankTranscriptOCR;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setExtractedTransactions([]);
    setCurrentTransactionIndex(0);
    setSavedTransactions([]);
    setIsCategorizing(false);
    setShowCropper(false);
    setCropperImageUrl(null);
    setPendingFile(null);
    setMerchant("");
    setDate("");
    setAmount("");
    setCategoryId("");
    setDescription("");
    setScanningStep("idle");
  };

  const loadTransaction = (index: number) => {
    const tx = extractedTransactions[index];
    if (tx) {
      setMerchant(tx.merchant || "");
      setDate(tx.date || new Date().toISOString().split("T")[0]);
      setAmount(tx.amount || "");
      setDescription(tx.description || "");
      setCategoryId(tx.categoryId || "");
    }
  };

  const handleSaveAndNext = async () => {
    if (!categoryId) {
      toast({
        title: "Category required",
        description: "Please select a category before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Save expense
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          merchant,
          description,
          date: date || new Date().toISOString().split("T")[0],
          categoryId,
        }),
      });

      if (res.ok) {
        // Mark this transaction as saved
        setSavedTransactions(prev => [...prev, currentTransactionIndex]);
        
        // Update the transaction with the selected category
        setExtractedTransactions(prev => {
          const updated = [...prev];
          updated[currentTransactionIndex] = { ...updated[currentTransactionIndex], categoryId };
          return updated;
        });
        
        toast({
          title: `Expense ${currentTransactionIndex + 1}/${extractedTransactions.length} saved!`,
          description: merchant ? `${merchant} - $${amount}` : `$${amount}`,
        });
        
        // Move to next transaction or finish
        if (currentTransactionIndex < extractedTransactions.length - 1) {
          const nextIndex = currentTransactionIndex + 1;
          setCurrentTransactionIndex(nextIndex);
          loadTransaction(nextIndex);
        } else {
          // All transactions processed
          toast({
            title: "All transactions saved!",
            description: `Successfully saved ${savedTransactions.length + 1} expenses.`,
          });
          resetForm();
        }
      } else {
        const error = await res.json();
        toast({
          title: "Failed to save",
          description: error.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Save expense error:", error);
      toast({
        title: "Error",
        description: "Failed to save expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkipTransaction = () => {
    if (currentTransactionIndex < extractedTransactions.length - 1) {
      const nextIndex = currentTransactionIndex + 1;
      setCurrentTransactionIndex(nextIndex);
      loadTransaction(nextIndex);
      toast({
        title: "Transaction skipped",
        description: `Moving to transaction ${nextIndex + 1} of ${extractedTransactions.length}`,
      });
    } else {
      // This was the last transaction
      const savedCount = savedTransactions.length;
      if (savedCount > 0) {
        toast({
          title: "Finished!",
          description: `Saved ${savedCount} expense${savedCount > 1 ? 's' : ''}.`,
        });
      }
      resetForm();
    }
  };

  const handlePreviousTransaction = () => {
    if (currentTransactionIndex > 0) {
      const prevIndex = currentTransactionIndex - 1;
      setCurrentTransactionIndex(prevIndex);
      loadTransaction(prevIndex);
    }
  };

  const handleSaveExpense = async () => {
    if (!amount || !categoryId || !date) {
      toast({
        title: "Missing required fields",
        description: "Please fill in amount, category, and date.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let receiptUrl = null;
      let receiptKey = null;

      // Build standardized filename: YYYY-MM-DD - Merchant - Amount.pdf
      const receiptFileName = buildReceiptFilename(date, merchant, amount);

      // Upload receipt to S3 if file exists
      if (selectedFile) {
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: receiptFileName,
            contentType: "application/pdf",
            isPublic: false,
          }),
        });

        if (presignedRes.ok) {
          const { uploadUrl, cloud_storage_path } = await presignedRes.json();
          
          // Check if Content-Disposition is in signed headers
          const urlParams = new URL(uploadUrl);
          const signedHeaders = urlParams.searchParams.get("X-Amz-SignedHeaders") || "";
          const headers: HeadersInit = { "Content-Type": "application/pdf" };
          
          if (signedHeaders.includes("content-disposition")) {
            headers["Content-Disposition"] = "attachment";
          }
          
          await fetch(uploadUrl, {
            method: "PUT",
            body: selectedFile,
            headers,
          });

          receiptKey = cloud_storage_path;
          receiptUrl = cloud_storage_path;
        }
      }

      // Save expense
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          merchant,
          description,
          date,
          categoryId,
          receiptUrl,
          receiptKey,
        }),
      });

      if (res.ok) {
        // Upload to cloud storage if connected
        let cloudMsg = "";
        if (cloudConnection?.isActive && selectedFile) {
          try {
            setCloudUploadStatus("uploading");
            const catName = categories.find(c => c.id === categoryId)?.name || "Uncategorized";
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("categoryName", catName);
            formData.append("provider", cloudConnection.provider);
            formData.append("fileName", receiptFileName);
            formData.append("categoryId", categoryId);
            const cloudRes = await fetch("/api/cloud-storage/upload", {
              method: "POST",
              body: formData,
            });
            if (cloudRes.ok) {
              const cloudData = await cloudRes.json();
              cloudMsg = ` • ${cloudData.message}`;
              setCloudUploadStatus("success");
            } else {
              setCloudUploadStatus("error");
              cloudMsg = " • Cloud backup failed (saved locally)";
            }
          } catch {
            setCloudUploadStatus("error");
            cloudMsg = " • Cloud backup failed (saved locally)";
          }
        }

        toast({
          title: "Expense saved!",
          description: `Your expense has been recorded and budget updated.${cloudMsg}`,
        });
        resetForm();
        setTimeout(() => setCloudUploadStatus("idle"), 3000);
      } else {
        const error = await res.json();
        toast({
          title: "Failed to save",
          description: error.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Save expense error:", error);
      toast({
        title: "Error",
        description: "Failed to save expense. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStep = SCANNING_STEPS[scanningStep];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {scanMode === "receipt" ? (
              <Receipt className="h-6 w-6 text-blue-600" />
            ) : (
              <CreditCard className="h-6 w-6 text-purple-600" />
            )}
            {scanMode === "receipt" ? "Scan Receipt" : "Scan Bank Statement"}
            {isPremium && <Crown className="h-5 w-5 text-amber-500" />}
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">
                  {scanMode === "receipt" ? "OCR Receipt Scanning" : "Bank Statement Scanning"}
                </p>
                <p className="text-xs">
                  {scanMode === "receipt" 
                    ? `Upload a photo of your receipt and our AI will automatically extract the merchant, date, and amount. ${isPremium ? "Premium users get smart category predictions!" : "Upgrade to Premium for smart category predictions based on your history!"}`
                    : "Upload a screenshot of your bank transactions. AI will extract all expense line items, then you can categorize each one quickly."}
                </p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            {scanMode === "receipt" 
              ? "Upload or capture a receipt to automatically extract expense details"
              : "Screenshot your bank transactions to bulk-add expenses"}
            {!isPremium && scanMode === "receipt" && " • Premium: Smart category predictions"}
          </p>
        </div>
        {!isPremium && (
          <Button 
            onClick={onUpgrade}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
          >
            <Crown className="h-4 w-4 mr-2" />
            Unlock Smart Categories
          </Button>
        )}
      </div>

      {/* Scan Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <Button
          variant={scanMode === "receipt" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setScanMode("receipt");
            resetForm();
          }}
          className="gap-2"
        >
          <Receipt className="h-4 w-4" />
          Receipt
        </Button>
        <Button
          variant={scanMode === "bank-transcript" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setScanMode("bank-transcript");
            resetForm();
          }}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Bank Statement
        </Button>
      </div>

      {/* Document Cropper Overlay */}
      {showCropper && cropperImageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              📐 Crop & Flatten Document
            </CardTitle>
            <CardDescription>
              Drag the corner handles to align with your document edges. The image will be perspective-corrected into a flat, clean scan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentCropper
              imageUrl={cropperImageUrl}
              onCropped={handleCropComplete}
              onCancel={handleCropSkip}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6" style={{ display: showCropper ? 'none' : undefined }}>
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {scanMode === "receipt" ? "Receipt Image" : "Bank Statement Screenshot"}
            </CardTitle>
            <CardDescription>
              {scanMode === "receipt" 
                ? "Upload an image or take a photo of your receipt"
                : "Upload a screenshot of your bank app or statement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer bg-muted/30 ${
                isScanning ? "border-primary" : "hover:border-primary"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !isScanning && !isCategorizing && fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="relative aspect-[3/4] max-h-64 mx-auto overflow-hidden rounded-lg">
                    {previewUrl === "__PDF__" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg">
                        <FileText className="h-16 w-16 text-red-500 mb-2" />
                        <p className="font-medium text-sm">{selectedFile?.name || "PDF Document"}</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF uploaded</p>
                      </div>
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    )}
                    {/* Scanning Overlay */}
                    <AnimatePresence>
                      {isScanning && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center"
                        >
                          <motion.div
                            animate={{ y: ["-100%", "100%"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                          />
                          <div className="text-white text-center z-10 px-4">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="inline-block mb-3"
                            >
                              <Sparkles className="h-10 w-10" />
                            </motion.div>
                            <p className="font-semibold text-lg mb-1">AI Scanning...</p>
                            <p className="text-sm text-white/80">{currentStep.message}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Progress Bar */}
                  {isScanning && (
                    <div className="space-y-2">
                      <Progress value={currentStep.progress} className="h-2" />
                      <p className="text-sm text-muted-foreground text-center">
                        {currentStep.message}
                      </p>
                    </div>
                  )}

                  {/* Success indicator for receipt */}
                  {scanningStep === "complete" && scanMode === "receipt" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Data extracted successfully</span>
                    </motion.div>
                  )}

                  {/* Success indicator for bank transcript */}
                  {scanningStep === "complete" && scanMode === "bank-transcript" && extractedTransactions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                        <ListChecks className="h-5 w-5" />
                        <span className="font-medium">
                          Found {extractedTransactions.length} transaction{extractedTransactions.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {savedTransactions.length} of {extractedTransactions.length} saved
                      </div>
                      {/* Transaction mini-list */}
                      <div className="max-h-32 overflow-y-auto space-y-1 text-left bg-muted/50 rounded-lg p-2">
                        {extractedTransactions.map((tx, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between text-xs p-1.5 rounded ${
                              idx === currentTransactionIndex 
                                ? 'bg-primary/10 border border-primary/30' 
                                : savedTransactions.includes(idx)
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : ''
                            }`}
                          >
                            <span className="truncate flex-1">
                              {savedTransactions.includes(idx) && <Check className="h-3 w-3 inline mr-1 text-green-600" />}
                              {tx.merchant || 'Unknown'}
                            </span>
                            <span className="font-medium ml-2">${tx.amount}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Error indicator */}
                  {scanningStep === "error" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400"
                    >
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Please enter details manually</span>
                    </motion.div>
                  )}

                  {!isScanning && !isCategorizing && (
                    <p className="text-sm text-muted-foreground">Click to select a different image</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    scanMode === "receipt" 
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-purple-100 dark:bg-purple-900/30"
                  }`}>
                    {scanMode === "receipt" ? (
                      <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <CreditCard className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {scanMode === "receipt" ? "Drop your receipt here" : "Drop your bank screenshot here"}
                    </p>
                    <p className="text-sm text-muted-foreground">Images or PDF files • Click to browse</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ScanLine className="h-4 w-4" />
                    <span>
                      {scanMode === "receipt" 
                        ? "AI-powered instant scanning"
                        : "Extract multiple transactions at once"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file input for UPLOAD (no capture — opens file picker) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target?.files?.[0];
                if (file) handleFileSelect(file);
                // Reset so same file can be re-selected
                if (e.target) e.target.value = "";
              }}
              disabled={isScanning || isCategorizing}
            />
            {/* Hidden file input for CAMERA (capture="environment" — opens camera) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target?.files?.[0];
                if (file) handleFileSelect(file);
                if (e.target) e.target.value = "";
              }}
              disabled={isScanning || isCategorizing}
            />

            <div className="flex gap-2 mt-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning || isCategorizing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {scanMode === "receipt" 
                    ? "Select a receipt image from your device"
                    : "Select a bank statement screenshot from your device"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isScanning || isCategorizing}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {scanMode === "receipt" 
                    ? "Capture a receipt using your camera"
                    : "Capture a screenshot using your camera"}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Manual Entry hint */}
            {!previewUrl && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  {scanMode === "receipt"
                    ? <>No receipt? You can also enter expense details manually <span className="inline lg:hidden">below</span><span className="hidden lg:inline">on the right</span>.</>
                    : "Upload a screenshot of your bank app transactions. AI will extract all expenses and ask you to categorize each one."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Form / Categorization Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {isCategorizing ? (
                <>
                  Categorize Expense
                  <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {currentTransactionIndex + 1} of {extractedTransactions.length}
                  </span>
                </>
              ) : (
                <>
                  Expense Details
                  {extractedData && scanningStep === "complete" && (
                    <span className="text-xs font-normal bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      AI Extracted
                    </span>
                  )}
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isCategorizing
                ? "AI extracted the details below. Just pick a category to save!"
                : extractedData
                ? "Review extracted data and make corrections if needed"
                : "Enter the expense details manually"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Bank Transcript Categorization Progress */}
            {isCategorizing && (
              <div className="mb-4">
                <Progress 
                  value={((savedTransactions.length) / extractedTransactions.length) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {savedTransactions.length} saved, {extractedTransactions.length - savedTransactions.length - (savedTransactions.includes(currentTransactionIndex) ? 0 : 1)} remaining
                </p>
              </div>
            )}

            <form className="space-y-4" onSubmit={(e) => { 
              e.preventDefault(); 
              isCategorizing ? handleSaveAndNext() : handleSaveExpense(); 
            }}>
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="merchant"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder="e.g., Walmart, Costco"
                        className="pl-10"
                        disabled={isScanning}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Store or vendor name</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isScanning}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Date of the transaction</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-10"
                        required
                        disabled={isScanning}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Transaction amount</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="flex items-center gap-2">
                  Category *
                  {isCategorizing && (
                    <span className="text-xs text-primary animate-pulse">← Select to continue</span>
                  )}
                  {!isPremium && extractedData && !isCategorizing && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Premium: Auto-suggest
                    </span>
                  )}
                  {isPremium && suggestedCategoryId && categoryId === suggestedCategoryId && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Suggested
                    </span>
                  )}
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={categoryId} onValueChange={setCategoryId} disabled={isScanning}>
                      <SelectTrigger className={isCategorizing && !categoryId ? "ring-2 ring-primary" : ""}>
                        <Tag className="h-5 w-5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories ?? []).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <span>{cat.icon}</span>
                              <span>{cat.name}</span>
                              {isPremium && suggestedCategoryId === cat.id && (
                                <span className="text-xs text-emerald-500">✓ AI Pick</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isCategorizing 
                      ? "Select a category for this expense"
                      : isPremium 
                      ? "Expense category for budget tracking - AI will suggest based on merchant" 
                      : "Expense category - Upgrade to Premium for smart AI suggestions!"}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional notes"
                      disabled={isScanning}
                    />
                  </TooltipTrigger>
                  <TooltipContent>Optional notes about this expense</TooltipContent>
                </Tooltip>
              </div>

              {/* Bank Transcript Navigation Buttons */}
              {isCategorizing ? (
                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={saving || isScanning || !categoryId}
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : currentTransactionIndex < extractedTransactions.length - 1 ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Save & Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Save & Finish
                      </>
                    )}
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handlePreviousTransaction}
                      disabled={currentTransactionIndex === 0 || saving}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleSkipTransaction}
                      disabled={saving}
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Cancel & Start Over
                  </Button>
                </div>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={saving || isScanning || !amount || !categoryId || !date}
                      >
                        {saving ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                        )}
                        Save Expense
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save this expense and update your budget</TooltipContent>
                  </Tooltip>
                  {/* Cloud storage indicator */}
                  {cloudConnection?.isActive ? (
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-muted-foreground">
                        Receipt will be saved to {cloudConnection.provider === "onedrive" ? "OneDrive" : "Google Drive"}
                        {cloudUploadStatus === "uploading" && " (uploading...)"}
                        {cloudUploadStatus === "success" && " ✓"}
                        {cloudUploadStatus === "error" && " (failed)"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <CloudOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-muted-foreground/50">
                        No cloud storage connected —{" "}
                        <button type="button" onClick={() => { window.location.href = "/dashboard?tab=cloud-storage"; }} className="underline hover:text-primary">connect now</button>
                      </span>
                    </div>
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
