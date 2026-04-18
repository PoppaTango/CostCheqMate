"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Crown, Sparkles, Zap, Gift, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// PREMIUM BANNER - Prominently displayed CTA for free users to upgrade
// Shows rotating benefits and clear upgrade paths (payment or Cheqs)
// =============================================================================

interface PremiumBannerProps {
  cheqs: number;
  premiumMonthlyCheqs: number;
  premiumMonthlyPrice: number;
  businessMonthlyPrice?: number;
  onUpgradeWithCheqs: () => void;
  onUpgradeWithPayment: () => void;
  onUpgradeWithBusiness?: () => void;
}

const PREMIUM_BENEFITS = [
  { icon: "🧠", text: "AI Smart Category Prediction" },
  { icon: "📊", text: "Advanced Analytics & Insights" },
  { icon: "📈", text: "Predictive Budgeting" },
  { icon: "🔔", text: "Smart Spending Alerts" },
  { icon: "📁", text: "Unlimited Categories" },
  { icon: "💾", text: "Cloud Backup & Sync" },
];

export default function PremiumBanner({
  cheqs,
  premiumMonthlyCheqs,
  premiumMonthlyPrice,
  businessMonthlyPrice = 9.99,
  onUpgradeWithCheqs,
  onUpgradeWithPayment,
  onUpgradeWithBusiness,
}: PremiumBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentBenefit, setCurrentBenefit] = useState(0);
  const { toast } = useToast();
  const canAffordWithCheqs = cheqs >= premiumMonthlyCheqs;

  // Rotate through benefits every 3 seconds
  useState(() => {
    const interval = setInterval(() => {
      setCurrentBenefit((prev) => (prev + 1) % PREMIUM_BENEFITS.length);
    }, 3000);
    return () => clearInterval(interval);
  });

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      <Card className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border-amber-500/30 dark:from-amber-500/20 dark:via-yellow-500/20 dark:to-orange-500/20">
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-500/20 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left side - Title and benefits */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 text-white">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Upgrade to Premium
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Save 20% off your budget
                    </span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Unlock powerful features to maximize your savings
                  </p>
                </div>
              </div>

              {/* Rotating benefits */}
              <div className="h-8 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentBenefit}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="text-lg">{PREMIUM_BENEFITS[currentBenefit].icon}</span>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      {PREMIUM_BENEFITS[currentBenefit].text}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Benefit dots */}
              <div className="flex gap-1 mt-2">
                {PREMIUM_BENEFITS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === currentBenefit ? "bg-amber-500" : "bg-amber-500/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right side - CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 lg:flex-col xl:flex-row">
              {/* Payment option */}
              <Button
                onClick={onUpgradeWithPayment}
                className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-semibold shadow-lg neon-glow-hover"
                size="lg"
              >
                <Zap className="h-4 w-4 mr-2" />
                <span>${premiumMonthlyPrice.toFixed(2)}/month</span>
              </Button>

              {/* Cheqs option */}
              <Button
                onClick={onUpgradeWithCheqs}
                variant={canAffordWithCheqs ? "default" : "outline"}
                className={canAffordWithCheqs 
                  ? "bg-primary hover:bg-primary/90" 
                  : "border-amber-500/50 hover:bg-amber-500/10"
                }
                size="lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {canAffordWithCheqs ? (
                  <span>Use {premiumMonthlyCheqs} Cheqs</span>
                ) : (
                  <span>
                    🪙 {cheqs}/{premiumMonthlyCheqs} Cheqs
                  </span>
                )}
              </Button>

              {/* Business option */}
              {onUpgradeWithBusiness && (
                <Button
                  onClick={onUpgradeWithBusiness}
                  variant="outline"
                  className="border-purple-500/50 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  size="lg"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span>Business ${businessMonthlyPrice.toFixed(2)}/mo</span>
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar for Cheqs */}
          {!canAffordWithCheqs && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Your Cheqs progress</span>
                <span>{Math.round((cheqs / premiumMonthlyCheqs) * 100)}% there</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.min((cheqs / premiumMonthlyCheqs) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                💡 Tip: Log expenses to earn Cheqs faster!
              </p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
