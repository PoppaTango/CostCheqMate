// =============================================================================
// PAYMENT SUCCESS PAGE - Shown after successful Stripe payment
// Verifies payment with backend, processes if webhook missed it
// =============================================================================

"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, ArrowRight, Loader2, Crown, AlertTriangle, ShieldCheck } from "lucide-react";

type VerifyStatus = "verifying" | "success" | "pending" | "error";

interface VerifyResult {
  status: string;
  paymentType?: string;
  months?: number;
  cheqsAwarded?: number;
  accountType?: string;
  premiumExpiresAt?: string;
  message?: string;
  alreadyProcessed?: boolean;
}

// -----------------------------------------------------------------------------
// SUCCESS CONTENT - Inner component that uses useSearchParams
// -----------------------------------------------------------------------------
function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(8);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("verifying");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const sessionId = searchParams.get("session_id");

  // Verify payment with backend
  const verifyPayment = useCallback(async () => {
    if (!sessionId) {
      setVerifyStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          setVerifyResult(data);
          setVerifyStatus("success");
        } else if (data.status === "pending" && retryCount < 5) {
          // Payment not yet confirmed by Stripe - retry after delay
          setVerifyStatus("verifying");
          setTimeout(() => setRetryCount((prev) => prev + 1), 2000);
        } else {
          setVerifyResult(data);
          setVerifyStatus("pending");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Payment verify failed:", errorData);
        setVerifyStatus("error");
      }
    } catch (err) {
      console.error("Payment verify error:", err);
      setVerifyStatus("error");
    }
  }, [sessionId, retryCount]);

  useEffect(() => {
    verifyPayment();
  }, [verifyPayment]);

  // Auto-redirect countdown (only after verification)
  useEffect(() => {
    if (verifyStatus !== "success") return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router, verifyStatus]);

  const isPremium = verifyResult?.paymentType === "premium_subscription";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-purple-50/30 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="w-full text-center">
          <CardHeader className="pb-4">
            {/* Status Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="mx-auto mb-4"
            >
              {verifyStatus === "verifying" ? (
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
              ) : verifyStatus === "success" ? (
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              ) : verifyStatus === "error" ? (
                <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                </div>
              )}
            </motion.div>

            <CardTitle className={`text-2xl ${
              verifyStatus === "verifying" ? "text-primary" :
              verifyStatus === "success" ? "text-green-500" :
              "text-amber-500"
            }`}>
              {verifyStatus === "verifying" ? "Confirming Payment..." :
               verifyStatus === "success" ? "Payment Confirmed!" :
               verifyStatus === "error" ? "Processing Payment" :
               "Almost There..."}
            </CardTitle>
            <CardDescription className="text-lg">
              {verifyStatus === "verifying"
                ? "Verifying your payment with Stripe..."
                : verifyStatus === "success"
                ? "Thank you for your support!"
                : "Your payment is being processed. It may take a moment."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Success details */}
            {verifyStatus === "success" && verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {isPremium ? (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Crown className="h-5 w-5 text-primary" />
                      <span className="text-lg font-semibold text-primary">Premium Activated!</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {verifyResult.months} month{(verifyResult.months || 0) > 1 ? "s" : ""} of premium features unlocked
                    </p>
                    {verifyResult.premiumExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(verifyResult.premiumExpiresAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <span className="text-lg font-medium">
                        {verifyResult.cheqsAwarded} Cheqs awarded!
                      </span>
                    </div>
                  </div>
                )}

                {/* Verification badge */}
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-green-600 dark:text-green-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Payment verified with Stripe</span>
                </div>
              </motion.div>
            )}

            {/* Verifying spinner */}
            {verifyStatus === "verifying" && (
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  Confirming with Stripe... ({retryCount > 0 ? `attempt ${retryCount + 1}` : "please wait"})
                </p>
              </div>
            )}

            {/* Error/pending state */}
            {(verifyStatus === "error" || verifyStatus === "pending") && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-2">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Your payment was received by Stripe
                </p>
                <p className="text-xs text-muted-foreground">
                  Your account will be updated shortly. If you don&apos;t see changes within a few minutes, please contact support.
                </p>
              </div>
            )}

            {/* Session ID for reference */}
            {sessionId && (
              <p className="text-xs text-muted-foreground">
                Reference: {sessionId.substring(0, 20)}...
              </p>
            )}

            {/* Redirect countdown */}
            {verifyStatus === "success" && (
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard in {countdown} seconds...
              </p>
            )}

            {/* Manual redirect button */}
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full neon-glow"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN PAGE - Wrapped in Suspense for useSearchParams
// -----------------------------------------------------------------------------
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
