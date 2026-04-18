// =============================================================================
// PAYMENT CANCEL PAGE - Shown when user cancels Stripe payment
// Allows user to return to dashboard or try again
// =============================================================================

"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RotateCcw } from "lucide-react";

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-purple-50/30 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full text-center">
          <CardHeader className="pb-4">
            {/* Cancel Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="mx-auto mb-4"
            >
              <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-orange-500" />
              </div>
            </motion.div>
            
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <CardDescription className="text-lg">
              No worries! Your payment was not processed.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You can try again whenever you're ready, or return to the dashboard.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => router.back()}
                className="flex-1 neon-glow"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
