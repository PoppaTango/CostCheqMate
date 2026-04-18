"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Receipt,
  PiggyBank,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  LayoutDashboard,
  DollarSign,
  Bug,
  Crown,
  HelpCircle,
  FileEdit,
  Shield,
  ArrowLeft,
  ListOrdered,
} from "lucide-react";
import HomeModule from "./home-module";
import ScanModule from "./scan-module";
import EditExpensesModule from "./edit-expenses-module";
import BudgetModule from "./budget-module";
import ReportsModule from "./reports-module";
import SettingsModule from "./settings-module";
import ExtraIncomeModule from "./extra-income-module";
import SupportModule from "./support-module";
import ModeratorModule from "./moderator-module";
import WalkthroughModule from "./walkthrough-module";
import CheqsDisplay from "./cheqs-display";
import PremiumBanner from "./premium-banner";
import PremiumExpirationWarning from "./premium-expiration-warning";

interface DashboardClientProps {
  userName: string;
}

// User status interface for tracking premium and Cheqs info
interface UserStatus {
  cheqs: number;
  accountType: string;
  isAdmin: boolean;
  role: string;
  status: string;
  premiumExpiresAt: string | null;
  pricing: {
    premiumMonthlyCheqs: number;
    premiumMonthlyPrice: number;
    businessMonthlyPrice?: number;
  };
}

type ModuleType = "dashboard" | "scan" | "edit-expenses" | "extra-income" | "budget" | "reports" | "support" | "settings" | "moderator" | "walkthrough";
type SettingsTab = "profile" | "income" | "extra-income" | "categories" | "bank-accounts" | "cloud-storage";

const navItems = [
  { id: "dashboard" as ModuleType, label: "Dashboard", icon: LayoutDashboard, tileIcon: "/icons/tile-dashboard.png", description: "Pay period overview at a glance", color: "from-cyan-500 to-blue-600" },
  { id: "scan" as ModuleType, label: "Scan", icon: Receipt, tileIcon: "/icons/tile-scan.png", description: "Upload and scan receipts", color: "from-emerald-500 to-teal-600" },
  { id: "edit-expenses" as ModuleType, label: "Edit Expenses", icon: FileEdit, tileIcon: "/icons/tile-edit.png", description: "View, edit, and manage all your expenses", color: "from-violet-500 to-purple-600" },
  { id: "extra-income" as ModuleType, label: "Extra $", icon: DollarSign, tileIcon: "/icons/tile-extra-income.png", description: "Track additional income sources", color: "from-amber-500 to-orange-600" },
  { id: "budget" as ModuleType, label: "Budget", icon: PiggyBank, tileIcon: "/icons/tile-budget.png", description: "Manage your budgets", color: "from-pink-500 to-rose-600" },
  { id: "reports" as ModuleType, label: "Reports", icon: BarChart3, tileIcon: "/icons/tile-reports.png", description: "View spending reports", color: "from-blue-500 to-indigo-600" },
  { id: "settings" as ModuleType, label: "Settings", icon: Settings, tileIcon: "/icons/tile-settings.png", description: "Configure your preferences", color: "from-gray-500 to-slate-600" },
];

export default function DashboardClient({ userName }: DashboardClientProps) {
  const [activeModule, setActiveModule] = useState<ModuleType>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMobileTiles, setShowMobileTiles] = useState(true); // Mobile: show tile grid initially
  const [mounted, setMounted] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [needsWalkthrough, setNeedsWalkthrough] = useState(false);

  // Navigate to settings with a specific tab
  const navigateToSettings = (tab: SettingsTab = "profile") => {
    setSettingsTab(tab);
    setActiveModule("settings");
    setShowMobileTiles(false);
  };

  // Navigate to a module (used by mobile tiles)
  const navigateToModule = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    setShowMobileTiles(false);
    setMobileMenuOpen(false);
  };

  // Go back to mobile tile grid
  const goToMobileTileGrid = () => {
    setShowMobileTiles(true);
  };

  // Fetch user status (cheqs, account type)
  const fetchUserStatus = async () => {
    try {
      const res = await fetch("/api/user/cheqs");
      if (res.ok) {
        const data = await res.json();
        setUserStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch user status:", error);
    }
  };

  // Handle payment-based premium upgrade
  const handlePaymentUpgrade = async (months: number = 1) => {
    setProcessingPayment(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "premium_subscription", months }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received");
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle payment-based business upgrade
  const handleBusinessUpgrade = async (months: number = 1) => {
    setProcessingPayment(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "business_subscription", months }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received");
      }
    } catch (error) {
      console.error("Failed to create business checkout session:", error);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handle Cheqs-based premium upgrade
  const handleCheqsUpgrade = async () => {
    try {
      const res = await fetch("/api/user/cheqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_premium", months: 1 }),
      });
      if (res.ok) {
        fetchUserStatus();
      }
    } catch (error) {
      console.error("Failed to redeem Cheqs:", error);
    }
  };

  // Fetch walkthrough status
  const fetchWalkthroughStatus = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setNeedsWalkthrough(data?.needsWalkthrough ?? false);
      }
    } catch (error) {
      console.error("Failed to fetch walkthrough status:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchUserStatus();
    fetchWalkthroughStatus();
    
    // Handle URL params (e.g., from cloud storage OAuth callback)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "cloud-storage") {
        setActiveModule("settings");
        setSettingsTab("cloud-storage");
        setShowMobileTiles(false);
        // Clean up URL
        window.history.replaceState({}, "", "/dashboard");
      }
    }

    // Re-fetch premium status when user returns to the tab / page gains focus
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchUserStatus();
      }
    };
    const handleFocus = () => fetchUserStatus();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    // Poll every 60 seconds so manual DB promotions propagate quickly
    const pollInterval = setInterval(fetchUserStatus, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      clearInterval(pollInterval);
    };
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const isPremium = userStatus?.accountType === "premium" || userStatus?.accountType === "business";
  const isBusiness = userStatus?.accountType === "business";

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-purple-50/30 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a] flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // All mobile tile items including special ones
  const allMobileTiles = [
    ...(needsWalkthrough
      ? [{ id: "walkthrough" as ModuleType, label: "User Setup Guide", icon: ListOrdered, tileIcon: "/icons/tile-setup-guide.png", description: "First-time user setup walkthrough", color: "from-teal-500 to-cyan-600" }]
      : []),
    ...navItems,
    ...(userStatus?.role === "moderator" || userStatus?.role === "admin"
      ? [{ id: "moderator" as ModuleType, label: "Moderator", icon: Shield, tileIcon: "/icons/tile-moderator.png", description: "Moderator Panel", color: "from-purple-500 to-fuchsia-600" }]
      : []),
    { id: "support" as ModuleType, label: "Support", icon: Bug, tileIcon: "/icons/tile-support.png", description: "Report bugs & earn Cheqs", color: "from-orange-500 to-red-600" },
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-purple-50/30 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              {/* Mobile: Back arrow when inside a module */}
              <div className="flex items-center gap-2">
                {!showMobileTiles && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden shrink-0"
                    onClick={goToMobileTileGrid}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                {/* Logo */}
                <button 
                  onClick={() => { goToMobileTileGrid(); }}
                  className="flex items-center gap-3 hover:opacity-90 transition-opacity"
                >
                  <AppLogo size="sm" className="w-10 h-10 md:w-12 md:h-12 rounded-xl neon-glow shadow-lg" priority />
                  <div className="hidden sm:block">
                    <span className="font-bold text-xl bg-gradient-to-r from-cyan-500 via-primary to-purple-500 bg-clip-text text-transparent">
                      Cost CheqMate
                    </span>
                    <p className="text-xs text-muted-foreground -mt-0.5">Master Your Finances</p>
                  </div>
                  {/* Mobile: show current module name */}
                  {!showMobileTiles && (
                    <span className="md:hidden font-semibold text-sm bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
                      {navItems.find(n => n.id === activeModule)?.label || 
                       (activeModule === "moderator" ? "Moderator" : activeModule === "support" ? "Support" : activeModule === "walkthrough" ? "Setup Guide" : "Cost CheqMate")}
                    </span>
                  )}
                </button>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeModule === item.id ? "default" : "ghost"}
                        onClick={() => setActiveModule(item.id)}
                        className={`gap-2 transition-all ${
                          activeModule === item.id
                            ? "neon-glow bg-primary text-primary-foreground"
                            : "hover:bg-primary/10"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {item.description}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </nav>

              {/* User Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="hidden lg:inline text-sm text-muted-foreground">
                  Welcome, <span className="font-medium text-foreground">{userName}</span>
                </span>
                
                {/* Cheqs Display */}
                <CheqsDisplay 
                  cheqs={userStatus?.cheqs || 0} 
                  accountType={userStatus?.accountType || "free"} 
                  onRefresh={fetchUserStatus}
                  premiumExpiresAt={userStatus?.premiumExpiresAt}
                  pricing={userStatus?.pricing}
                />
                
                {/* Desktop-only: Moderator Button */}
                {(userStatus?.role === "moderator" || userStatus?.role === "admin") && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={activeModule === "moderator" ? "default" : "ghost"} 
                        size="icon" 
                        onClick={() => navigateToModule("moderator")}
                        className={`hidden md:inline-flex ${activeModule === "moderator" ? "neon-glow bg-purple-500" : "hover:bg-purple-500/10 hover:text-purple-500"}`}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Moderator Panel</TooltipContent>
                  </Tooltip>
                )}

                {/* Desktop-only: Support Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={activeModule === "support" ? "default" : "ghost"} 
                      size="icon" 
                      onClick={() => navigateToModule("support")}
                      className={`hidden md:inline-flex ${activeModule === "support" ? "neon-glow" : "hover:bg-orange-500/10 hover:text-orange-500"}`}
                    >
                      <Bug className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Report a bug & earn Cheqs</TooltipContent>
                </Tooltip>
                
                <ThemeToggle />
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="hover:bg-destructive/10 hover:text-destructive">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sign out</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </header>

        {/* ===== MOBILE TILE GRID (Kanban/Facebook-style) ===== */}
        <div className={`md:hidden ${showMobileTiles ? "block" : "hidden"}`}>
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-lg font-bold">
              Hi, <span className="bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">{userName?.split(" ")[0] || "there"}</span> 👋
            </h2>
            <p className="text-sm text-muted-foreground">What would you like to do?</p>
          </div>

          {/* Premium Banners on mobile tile view */}
          <div className="px-4 pb-2">
            {isPremium && userStatus?.premiumExpiresAt && (
              <PremiumExpirationWarning
                premiumExpiresAt={userStatus.premiumExpiresAt}
                premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                onRenew={() => handlePaymentUpgrade(1)}
              />
            )}
            {!isPremium && userStatus && (
              <PremiumBanner
                cheqs={userStatus.cheqs}
                premiumMonthlyCheqs={userStatus?.pricing?.premiumMonthlyCheqs || 2000}
                premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                businessMonthlyPrice={userStatus?.pricing?.businessMonthlyPrice || 9.99}
                onUpgradeWithCheqs={handleCheqsUpgrade}
                onUpgradeWithPayment={() => handlePaymentUpgrade(1)}
                onUpgradeWithBusiness={() => handleBusinessUpgrade(1)}
              />
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 px-4 pb-6">
            {allMobileTiles.map((item, index) => {
              const isDimmed = needsWalkthrough && item.id !== "walkthrough";
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => navigateToModule(item.id)}
                  className={`flex flex-col items-center gap-2 py-3 active:scale-[0.93] transition-all group ${
                    isDimmed ? "opacity-[0.4]" : ""
                  }`}
                >
                  {/* Icon — the metallic image IS the tile */}
                  <div className={`relative w-[72px] h-[72px] rounded-[20px] overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow ${
                    !isDimmed && needsWalkthrough && item.id === "walkthrough" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}>
                    {item.tileIcon ? (
                      <Image src={item.tileIcon} alt={item.label} fill className="object-cover" sizes="72px" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                        <item.icon className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Label */}
                  <span className="font-medium text-xs text-center leading-tight text-foreground/80">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ===== MAIN CONTENT (Desktop always, Mobile when a module is selected) ===== */}
        <main className={`mx-auto px-4 sm:px-6 py-6 ${activeModule === "dashboard" ? "max-w-full" : "max-w-7xl"} ${showMobileTiles ? "hidden md:block" : "block"}`}>
          {/* Premium Expiration Warning - Desktop (mobile shows in tile grid) */}
          <div className="hidden md:block">
            {isPremium && userStatus?.premiumExpiresAt && (
              <PremiumExpirationWarning
                premiumExpiresAt={userStatus.premiumExpiresAt}
                premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                onRenew={() => handlePaymentUpgrade(1)}
              />
            )}
            {!isPremium && userStatus && (
              <PremiumBanner
                cheqs={userStatus.cheqs}
                premiumMonthlyCheqs={userStatus?.pricing?.premiumMonthlyCheqs || 2000}
                premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                businessMonthlyPrice={userStatus?.pricing?.businessMonthlyPrice || 9.99}
                onUpgradeWithCheqs={handleCheqsUpgrade}
                onUpgradeWithPayment={() => handlePaymentUpgrade(1)}
                onUpgradeWithBusiness={() => handleBusinessUpgrade(1)}
              />
            )}
          </div>

          {/* Module content — shown on mobile when not in tile view */}
          {!showMobileTiles && (
            <div className="md:hidden mb-3">
              {isPremium && userStatus?.premiumExpiresAt && (
                <PremiumExpirationWarning
                  premiumExpiresAt={userStatus.premiumExpiresAt}
                  premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                  onRenew={() => handlePaymentUpgrade(1)}
                />
              )}
              {!isPremium && userStatus && (
                <PremiumBanner
                  cheqs={userStatus.cheqs}
                  premiumMonthlyCheqs={userStatus?.pricing?.premiumMonthlyCheqs || 2000}
                  premiumMonthlyPrice={userStatus?.pricing?.premiumMonthlyPrice || 1.99}
                  businessMonthlyPrice={userStatus?.pricing?.businessMonthlyPrice || 9.99}
                  onUpgradeWithCheqs={handleCheqsUpgrade}
                  onUpgradeWithPayment={() => handlePaymentUpgrade(1)}
                  onUpgradeWithBusiness={() => handleBusinessUpgrade(1)}
                />
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeModule === "dashboard" && <HomeModule />}
              {activeModule === "scan" && <ScanModule isPremium={isPremium} onUpgrade={() => navigateToModule("support")} />}
              {activeModule === "edit-expenses" && <EditExpensesModule onCheqsChange={fetchUserStatus} />}
              {activeModule === "extra-income" && <ExtraIncomeModule onCheqsChange={fetchUserStatus} />}
              {activeModule === "budget" && <BudgetModule onCustomize={() => navigateToSettings("categories")} />}
              {activeModule === "reports" && <ReportsModule />}
              {activeModule === "support" && <SupportModule onCheqsChange={fetchUserStatus} userStatus={userStatus} />}
              {activeModule === "settings" && <SettingsModule defaultTab={settingsTab} />}
              {activeModule === "walkthrough" && (
                <WalkthroughModule
                  onComplete={() => {
                    setNeedsWalkthrough(false);
                    setActiveModule("dashboard");
                    setShowMobileTiles(true);
                  }}
                  onNavigateToSettings={(tab) => {
                    setSettingsTab(tab as SettingsTab);
                    setActiveModule("settings");
                    setShowMobileTiles(false);
                  }}
                />
              )}
              {activeModule === "moderator" && (userStatus?.role === "moderator" || userStatus?.role === "admin") && (
                <ModeratorModule currentUserRole={userStatus?.role || "user"} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </TooltipProvider>
  );
}