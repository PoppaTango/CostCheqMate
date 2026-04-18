"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Crown, Sparkles, Gift, Target, TrendingUp, Bug, Receipt, Flame, Zap, CreditCard, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CheqsDisplayProps {
  cheqs: number;
  accountType: string;
  onRefresh: () => void;
  premiumExpiresAt?: string | null;
  pricing?: {
    premiumMonthlyCheqs: number;
    premiumMonthlyPrice: number;
  };
}

// Default values for premium pricing
const DEFAULT_PREMIUM_CHEQS = 2000;
const DEFAULT_PREMIUM_PRICE = 1.99;

const EARNING_METHODS = [
  { icon: Gift, label: "Welcome Bonus", cheqs: 50, description: "Sign up for Cost CheqMate" },
  { icon: Receipt, label: "Manual Expense Entry", cheqs: 2, description: "Each expense you log manually" },
  { icon: Target, label: "Weekly Budget Goal", cheqs: 25, description: "Stay under budget for a week" },
  { icon: Flame, label: "7-Day Login Streak", cheqs: 100, description: "Log in for 7 consecutive days" },
  { icon: Bug, label: "Bug Report (Low)", cheqs: 25, description: "Report a minor bug" },
  { icon: Bug, label: "Bug Report (Medium)", cheqs: 50, description: "Report a standard bug" },
  { icon: Bug, label: "Bug Report (High)", cheqs: 100, description: "Report a significant bug" },
  { icon: Bug, label: "Bug Report (Critical)", cheqs: 200, description: "Report a critical bug" },
];

const PREMIUM_FEATURES = [
  "🧠 Smart Category Prediction - AI auto-suggests categories based on your history",
  "📊 Advanced Analytics - Deeper insights into spending patterns",
  "📈 Predictive Budgeting - AI-powered budget suggestions",
  "🔔 Smart Alerts - Personalized spending notifications",
  "📁 Unlimited Categories - Create as many categories as you need",
  "💾 Cloud Backup - Never lose your data",
];

export default function CheqsDisplay({ 
  cheqs, 
  accountType, 
  onRefresh, 
  premiumExpiresAt,
  pricing 
}: CheqsDisplayProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  
  const isPremium = accountType === "premium";
  const premiumCheqsCost = pricing?.premiumMonthlyCheqs || DEFAULT_PREMIUM_CHEQS;
  const premiumPrice = pricing?.premiumMonthlyPrice || DEFAULT_PREMIUM_PRICE;
  const progress = Math.min((cheqs / premiumCheqsCost) * 100, 100);
  const canAffordWithCheqs = cheqs >= premiumCheqsCost;

  // Calculate days until expiration for premium users
  const daysUntilExpiration = premiumExpiresAt 
    ? Math.ceil((new Date(premiumExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleUnlockPremium = async () => {
    if (cheqs < premiumCheqsCost) {
      toast({
        title: "Not enough Cheqs",
        description: `You need ${premiumCheqsCost - cheqs} more Cheqs to unlock Premium.`,
        variant: "destructive",
      });
      return;
    }

    setUnlocking(true);
    try {
      const res = await fetch("/api/user/cheqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_premium" }),
      });

      if (res.ok) {
        toast({
          title: "🎉 Premium Unlocked!",
          description: "You now have access to all premium features!",
        });
        onRefresh();
        setIsOpen(false);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to unlock");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unlock premium",
        variant: "destructive",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const handlePaymentUpgrade = async () => {
    setProcessingPayment(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "premium_subscription", months: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: res.status === 409 ? "Already Premium" : "Payment Error",
          description: data.error || "Failed to create checkout session",
          variant: "destructive",
        });
        setShowPaymentConfirm(false);
        return;
      }
      if (data.url) {
        if (data.reused) {
          toast({
            title: "Resuming existing checkout",
            description: "You had a pending payment session — redirecting you there instead of creating a new charge.",
          });
        }
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Failed to create checkout session",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to process payment request",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 font-semibold relative ${
                isPremium
                  ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 hover:from-amber-500/30 hover:to-yellow-500/30"
                  : "bg-gradient-to-r from-amber-500/10 to-primary/10 text-amber-600 dark:text-amber-400 hover:from-amber-500/20 hover:to-primary/20 animate-pulse hover:animate-none border border-amber-500/30"
              }`}
            >
              {isPremium ? (
                <>
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="hidden sm:inline">Premium</span>
                  {daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0 && (
                    <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full ml-1">
                      {daysUntilExpiration}d
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="font-bold">Get Premium</span>
                  <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                    ${premiumPrice}
                  </span>
                </>
              )}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {isPremium
            ? daysUntilExpiration !== null && daysUntilExpiration <= 7
              ? `Premium expires in ${daysUntilExpiration} day${daysUntilExpiration !== 1 ? 's' : ''}`
              : "You have Premium access!"
            : `Upgrade to Premium - $${premiumPrice}/mo or ${premiumCheqsCost} Cheqs`}
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isPremium ? (
              <>
                <Crown className="h-6 w-6 text-amber-500" />
                Premium Member
              </>
            ) : (
              <>
                <Sparkles className="h-6 w-6 text-primary" />
                Your Cheqs Balance
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isPremium
              ? "Thank you for being a Premium member!"
              : "Earn Cheqs through app usage and unlock Premium features!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Balance */}
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-cyan-500/10 border border-primary/20">
            <div className="text-5xl font-bold text-primary mb-2">🪙 {cheqs}</div>
            <p className="text-muted-foreground">Cheqs Balance</p>
          </div>

          {!isPremium && (
            <>
              {/* Quick Upgrade Options */}
              {!showPaymentConfirm ? (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
                  <h4 className="font-semibold text-center mb-4 flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Upgrade to Premium
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Payment Option */}
                    <Button
                      onClick={() => setShowPaymentConfirm(true)}
                      disabled={processingPayment}
                      className="h-auto py-4 flex flex-col gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold shadow-lg"
                    >
                      <CreditCard className="h-5 w-5" />
                      <span className="text-lg">${premiumPrice}</span>
                      <span className="text-xs opacity-90">one-time • 1 month</span>
                    </Button>
                    {/* Cheqs Option */}
                    <Button
                      onClick={handleUnlockPremium}
                      disabled={!canAffordWithCheqs || unlocking}
                      variant={canAffordWithCheqs ? "default" : "outline"}
                      className={`h-auto py-4 flex flex-col gap-1 ${
                        canAffordWithCheqs 
                          ? "bg-primary hover:bg-primary/90" 
                          : "border-amber-500/50"
                      }`}
                    >
                      <Sparkles className="h-5 w-5" />
                      <span className="text-lg">🪙 {premiumCheqsCost}</span>
                      <span className="text-xs opacity-90">Cheqs</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-2 border-amber-500/40 space-y-4">
                  <h4 className="font-semibold text-center flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                    <Info className="h-5 w-5" />
                    Confirm Payment
                  </h4>
                  
                  <div className="bg-background/80 rounded-lg p-4 space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold">Cost CheqMate Premium</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold">1 month</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-lg">${premiumPrice} CAD</span>
                    </div>
                    <div className="border-t border-border/50 pt-3">
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                        <p className="text-xs leading-relaxed">
                          This is a <strong className="text-foreground">one-time payment</strong> — you will <strong className="text-foreground">not</strong> be charged again automatically. 
                          When your month expires, you can choose to renew manually.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPaymentConfirm(false)}
                      className="flex-1"
                      disabled={processingPayment}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePaymentUpgrade}
                      disabled={processingPayment}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold"
                    >
                      {processingPayment ? "Processing..." : `Pay $${premiumPrice} CAD`}
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress to Premium */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Your Cheqs Balance</span>
                  <span className="text-muted-foreground">🪙 {cheqs} / {premiumCheqsCost}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {canAffordWithCheqs
                    ? "🎉 You have enough Cheqs to unlock Premium!"
                    : `${premiumCheqsCost - cheqs} more Cheqs needed • Log expenses to earn more!`}
                </p>
              </div>
            </>
          )}

          {/* Premium Features */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              {isPremium ? "Your Premium Features" : "Premium Features"}
            </h4>
            <div className="space-y-2">
              {PREMIUM_FEATURES.map((feature, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-sm ${
                    isPremium
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* How to Earn */}
          {!isPremium && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                How to Earn Cheqs
              </h4>
              <div className="space-y-2">
                {EARNING_METHODS.map((method, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <method.icon className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary">+{method.cheqs}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
