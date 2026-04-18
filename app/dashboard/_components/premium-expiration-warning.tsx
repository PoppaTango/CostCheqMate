"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Crown, Clock, AlertTriangle, Zap } from "lucide-react";
import { motion } from "framer-motion";

// =============================================================================
// PREMIUM EXPIRATION WARNING - Gradual warnings for expiring premium
// Shows different urgency levels based on days remaining:
// - 7 days: Gentle reminder (blue/info)
// - 5 days: Moderate alert (yellow/warning) 
// - 3 days: Strong warning (orange)
// - 1 day: Urgent (red/critical)
// - Expired: Recovery prompt
// =============================================================================

interface PremiumExpirationWarningProps {
  premiumExpiresAt: Date | string | null;
  premiumMonthlyPrice: number;
  onRenew: () => void;
}

type UrgencyLevel = "info" | "warning" | "urgent" | "critical" | "expired";

interface WarningConfig {
  level: UrgencyLevel;
  title: string;
  message: string;
  icon: typeof Clock;
  bgClass: string;
  borderClass: string;
  textClass: string;
  buttonClass: string;
}

export default function PremiumExpirationWarning({
  premiumExpiresAt,
  premiumMonthlyPrice,
  onRenew,
}: PremiumExpirationWarningProps) {
  const [dismissed, setDismissed] = useState(false);

  // Calculate days remaining and warning config
  const { daysRemaining, config, showWarning } = useMemo(() => {
    if (!premiumExpiresAt) {
      return { daysRemaining: null, config: null, showWarning: false };
    }

    const expirationDate = new Date(premiumExpiresAt);
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Only show warning within 7 days
    if (days > 7) {
      return { daysRemaining: days, config: null, showWarning: false };
    }

    let config: WarningConfig;

    if (days <= 0) {
      // Expired
      config = {
        level: "expired",
        title: "Premium Expired",
        message: "Your premium membership has expired. Renew now to keep your premium features!",
        icon: AlertTriangle,
        bgClass: "bg-gradient-to-r from-red-500/20 via-red-400/15 to-red-500/20 dark:from-red-500/30 dark:via-red-400/25 dark:to-red-500/30",
        borderClass: "border-red-500/50",
        textClass: "text-red-600 dark:text-red-400",
        buttonClass: "bg-red-500 hover:bg-red-600 text-white",
      };
    } else if (days === 1) {
      // Critical - Last day
      config = {
        level: "critical",
        title: "⚠️ Premium Expires Tomorrow!",
        message: "This is your last day of premium. Renew now to avoid losing access to your premium features!",
        icon: AlertTriangle,
        bgClass: "bg-gradient-to-r from-red-500/15 via-orange-500/10 to-red-500/15 dark:from-red-500/25 dark:via-orange-500/20 dark:to-red-500/25",
        borderClass: "border-red-500/40 animate-pulse",
        textClass: "text-red-600 dark:text-red-400",
        buttonClass: "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white",
      };
    } else if (days <= 3) {
      // Urgent - 2-3 days
      config = {
        level: "urgent",
        title: `Premium Expires in ${days} Days`,
        message: `Your premium membership is ending soon. Renew now to keep all your premium features!`,
        icon: AlertTriangle,
        bgClass: "bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 dark:from-orange-500/25 dark:via-amber-500/20 dark:to-orange-500/25",
        borderClass: "border-orange-500/40",
        textClass: "text-orange-600 dark:text-orange-400",
        buttonClass: "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white",
      };
    } else if (days <= 5) {
      // Warning - 4-5 days
      config = {
        level: "warning",
        title: `Premium Expires in ${days} Days`,
        message: "Don't forget to renew your premium membership to continue enjoying exclusive features.",
        icon: Clock,
        bgClass: "bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-yellow-500/15 dark:from-yellow-500/25 dark:via-amber-500/20 dark:to-yellow-500/25",
        borderClass: "border-yellow-500/40",
        textClass: "text-yellow-600 dark:text-yellow-400",
        buttonClass: "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white",
      };
    } else {
      // Info - 6-7 days
      config = {
        level: "info",
        title: `Premium Renews in ${days} Days`,
        message: "Your premium membership will expire soon. Consider renewing to keep your features.",
        icon: Clock,
        bgClass: "bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-blue-500/10 dark:from-blue-500/20 dark:via-cyan-500/15 dark:to-blue-500/20",
        borderClass: "border-blue-500/30",
        textClass: "text-blue-600 dark:text-blue-400",
        buttonClass: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white",
      };
    }

    return { daysRemaining: days, config, showWarning: true };
  }, [premiumExpiresAt]);

  // Don't show if dismissed, no expiration, or not within warning period
  if (dismissed || !showWarning || !config) return null;

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      <Card className={`relative overflow-hidden ${config.bgClass} ${config.borderClass}`}>
        {/* Only allow dismiss for info/warning levels */}
        {(config.level === "info" || config.level === "warning") && (
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground z-10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left side - Warning info */}
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${config.buttonClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className={`font-bold ${config.textClass}`}>
                  {config.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {config.message}
                </p>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Crown className="h-3 w-3 text-amber-500" />
                    Expires: {new Date(premiumExpiresAt!).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - CTA */}
            <div className="flex gap-2">
              <Button
                onClick={onRenew}
                className={`${config.buttonClass} font-semibold shadow-lg`}
              >
                <Zap className="h-4 w-4 mr-2" />
                Renew Now - ${premiumMonthlyPrice.toFixed(2)}/mo
              </Button>
            </div>
          </div>

          {/* Visual countdown for critical/urgent */}
          {(config.level === "critical" || config.level === "urgent") && daysRemaining !== null && daysRemaining > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Time remaining:</span>
              <div className="flex gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-4 rounded-sm transition-colors ${
                      i < daysRemaining
                        ? config.level === "critical"
                          ? "bg-red-500"
                          : "bg-orange-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <span className={`text-xs font-bold ${config.textClass}`}>
                {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
