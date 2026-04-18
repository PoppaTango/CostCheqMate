"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import dynamic from "next/dynamic";
import { AppLogo } from "@/components/app-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Loader2, ChevronLeft, ChevronRight, Info, TrendingUp, DollarSign, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ActualsBreakdownDialog = dynamic(() => import("./actuals-breakdown-dialog"), { ssr: false });

interface IncomeSetting {
  netAmountPerPay: number;
  frequency: string;
  firstPayDate: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  annualBudget: number;
  bankAccountId: string | null;
  bankAccount?: {
    id: string;
    accountName: string;
  } | null;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
  categoryId: string;
  merchant: string | null;
  description: string | null;
  receiptUrl: string | null;
  receiptKey: string | null;
  category?: Category;
}

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountType: string;
}

interface PayPeriod {
  number: number;
  startDate: Date;
  endDate: Date;
  income: number;
  expenses: { [categoryId: string]: number };
  totalExpenses: number;
  bankAllocations: { [bankAccountId: string]: number };
  categoryBudgets: { [categoryId: string]: number };
  totalBudget: number;
}

export default function HomeModule() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<IncomeSetting | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Actuals breakdown dialog state
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownCategory, setBreakdownCategory] = useState<Category | null>(null);
  const [breakdownPeriod, setBreakdownPeriod] = useState<PayPeriod | null>(null);
  const [breakdownExpenses, setBreakdownExpenses] = useState<Expense[]>([]);

  const handleActualClick = useCallback((category: Category, period: PayPeriod) => {
    const periodExpenses = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      return exp.categoryId === category.id && expDate >= period.startDate && expDate <= period.endDate;
    });
    setBreakdownCategory(category);
    setBreakdownPeriod(period);
    setBreakdownExpenses(periodExpenses);
    setBreakdownOpen(true);
  }, [expenses]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incomeRes, expensesRes, categoriesRes, bankAccountsRes] = await Promise.all([
        fetch("/api/income"),
        fetch(`/api/expenses?startDate=${selectedYear}-01-01&endDate=${selectedYear}-12-31`),
        fetch("/api/categories"),
        fetch("/api/bank-accounts"),
      ]);

      if (incomeRes.ok) {
        const data = await incomeRes.json();
        setIncome(data);
      }

      if (expensesRes.ok) {
        const data = await expensesRes.json();
        setExpenses(data ?? []);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data ?? []);
      }

      if (bankAccountsRes.ok) {
        const data = await bankAccountsRes.json();
        setBankAccounts(data ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch pay period data:", error);
      toast({
        title: "Error",
        description: "Failed to load pay period data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get number of pay periods per year based on frequency
  const periodsPerYear = useMemo(() => {
    if (!income?.frequency) return 26; // default bi-weekly
    switch (income.frequency) {
      case "weekly": return 52;
      case "bi-weekly": return 26;
      case "semi-monthly": return 24;
      case "monthly": return 12;
      default: return 26;
    }
  }, [income?.frequency]);

  // Calculate pay periods for the year
  const payPeriods = useMemo(() => {
    if (!income?.firstPayDate) return [];

    const periods: PayPeriod[] = [];
    const firstPayDate = new Date(income.firstPayDate);
    const yearStart = new Date(parseInt(selectedYear), 0, 1);
    const yearEnd = new Date(parseInt(selectedYear), 11, 31);

    // Calculate days between pay periods
    let daysBetweenPay = 14; // default bi-weekly
    switch (income.frequency) {
      case "weekly":
        daysBetweenPay = 7;
        break;
      case "bi-weekly":
        daysBetweenPay = 14;
        break;
      case "semi-monthly":
        daysBetweenPay = 15; // Approximate
        break;
      case "monthly":
        daysBetweenPay = 30; // Approximate
        break;
    }

    // Calculate per-period budget for each category
    const categoryBudgetsPerPeriod: { [categoryId: string]: number } = {};
    let totalBudgetPerPeriod = 0;
    categories.forEach((cat) => {
      const perPeriod = cat.annualBudget / periodsPerYear;
      categoryBudgetsPerPeriod[cat.id] = perPeriod;
      totalBudgetPerPeriod += perPeriod;
    });

    // Find the first pay date that falls in or before the selected year
    let currentPayDate = new Date(firstPayDate);
    while (currentPayDate > yearStart) {
      currentPayDate = new Date(currentPayDate.getTime() - daysBetweenPay * 24 * 60 * 60 * 1000);
    }
    // Move forward to get into the year
    while (currentPayDate < yearStart) {
      currentPayDate = new Date(currentPayDate.getTime() + daysBetweenPay * 24 * 60 * 60 * 1000);
    }
    // Back one period to get the start
    currentPayDate = new Date(currentPayDate.getTime() - daysBetweenPay * 24 * 60 * 60 * 1000);

    let periodNumber = 1;
    while (currentPayDate <= yearEnd) {
      const startDate = new Date(currentPayDate);
      const endDate = new Date(currentPayDate.getTime() + (daysBetweenPay - 1) * 24 * 60 * 60 * 1000);

      // Only include if the period overlaps with the selected year
      if (endDate >= yearStart && startDate <= yearEnd) {
        // Calculate expenses for this period
        const periodExpenses: { [categoryId: string]: number } = {};
        const bankAllocations: { [bankAccountId: string]: number } = {};
        let totalExpenses = 0;

        expenses.forEach((expense) => {
          const expenseDate = new Date(expense.date);
          if (expenseDate >= startDate && expenseDate <= endDate) {
            const catId = expense.categoryId;
            periodExpenses[catId] = (periodExpenses[catId] || 0) + expense.amount;
            totalExpenses += expense.amount;

            // Find the category to get bank account allocation
            const category = categories.find((c) => c.id === catId);
            if (category?.bankAccountId) {
              bankAllocations[category.bankAccountId] =
                (bankAllocations[category.bankAccountId] || 0) + expense.amount;
            }
          }
        });

        periods.push({
          number: periodNumber,
          startDate,
          endDate,
          income: income.netAmountPerPay,
          expenses: periodExpenses,
          totalExpenses,
          bankAllocations,
          categoryBudgets: categoryBudgetsPerPeriod,
          totalBudget: totalBudgetPerPeriod,
        });
        periodNumber++;
      }

      currentPayDate = new Date(currentPayDate.getTime() + daysBetweenPay * 24 * 60 * 60 * 1000);
    }

    return periods;
  }, [income, expenses, categories, selectedYear, periodsPerYear]);

  const formatCurrency = (amount: number, showSign = false): string => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    
    if (showSign && amount < 0) {
      return `-${formatted}`;
    }
    return formatted;
  };

  const formatDateShort = (date: Date): string => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatMonth = (date: Date): string => {
    return date.toLocaleDateString("en-US", { month: "short" });
  };

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  // All categories for showing budgets
  const allCategories = categories;

  // Bank accounts with allocations
  const bankAccountsWithAllocations = useMemo(() => {
    return bankAccounts.filter((account) =>
      payPeriods.some((p) => (p.bankAllocations[account.id] || 0) > 0)
    );
  }, [bankAccounts, payPeriods]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalIncome = payPeriods.reduce((sum, p) => sum + p.income, 0);
    const totalExpenses = payPeriods.reduce((sum, p) => sum + p.totalExpenses, 0);
    const totalBudget = allCategories.reduce((sum, c) => sum + c.annualBudget, 0);
    return { totalIncome, totalExpenses, totalBudget, netBalance: totalIncome - totalExpenses };
  }, [payPeriods, allCategories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!income?.firstPayDate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-primary/20">
          <CardContent className="py-12">
            <div className="text-center">
              <AppLogo size="md" className="w-24 h-24 mx-auto mb-6 rounded-2xl neon-glow shadow-lg" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Cost CheqMate!</h3>
              <p className="text-muted-foreground mb-6">
                To view your pay period calendar, please set your <strong>First Pay Date</strong> in Settings → Income.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>This helps us organize your budget by pay periods</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Pay Period Overview
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Your Financial Dashboard</p>
                <p className="text-xs">View your finances organized by pay period. Scroll through periods to see income, expenses, and net balance. Configure your pay frequency and first pay date in Settings → Income.</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Your financial snapshot organized by pay period ({periodsPerYear} periods/year)
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex flex-wrap gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">YTD Income</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryStats.totalIncome)}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500/10 to-rose-500/5 border border-rose-500/20"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-rose-500" />
              <div>
                <p className="text-xs text-muted-foreground">YTD Expenses</p>
                <p className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(summaryStats.totalExpenses)}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Pay Period Calendar - {selectedYear}</CardTitle>
              <CardDescription>
                Budget shows per-period allocation (Annual ÷ {periodsPerYear} periods)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleScrollLeft} className="neon-glow-hover">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleScrollRight} className="neon-glow-hover">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4">
          {/* Spreadsheet-style Pay Period Grid */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex">
              {/* Fixed Left Column - Row Labels */}
              <div className="flex-shrink-0 w-40 sm:w-48 bg-background border-r z-10">
                {/* Header Row - Year */}
                <div className="h-11 flex items-center px-3 font-bold text-sm border-b bg-gradient-to-r from-primary to-cyan-600 text-white">
                  {selectedYear}
                </div>
                
                {/* Sub-header Row - Period Number */}
                <div className="h-9 flex items-center px-3 text-xs text-muted-foreground border-b bg-muted/50">
                  Pay Period #
                </div>
                
                {/* Date Range Row */}
                <div className="h-11 flex items-center px-3 text-xs text-muted-foreground border-b bg-muted/30">
                  Date Range
                </div>

                {/* REV TOTAL Row */}
                <div className="h-10 flex items-center px-3 font-semibold text-sm border-b bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 text-emerald-800 dark:text-emerald-300">
                  💰 REV TOTAL
                </div>

                {/* PAYROLL Row */}
                <div className="h-9 flex items-center px-3 pl-5 text-sm border-b bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">
                  Payroll
                </div>

                {/* Spacer */}
                <div className="h-3 border-b bg-background"></div>

                {/* BUDGET TOTAL Row */}
                <div className="h-10 flex items-center px-3 font-semibold text-sm border-b bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 text-blue-800 dark:text-blue-300">
                  📊 BUDGET TOTAL
                </div>

                {/* EXP TOTAL Row */}
                <div className="h-10 flex items-center px-3 font-semibold text-sm border-b bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/20 text-rose-800 dark:text-rose-300">
                  📉 EXP TOTAL
                </div>

                {/* Category Rows - Budget & Spent */}
                {allCategories.map((category) => (
                  <div key={category.id}>
                    {/* Category Budget Row */}
                    <div
                      className="h-8 flex items-center px-3 pl-5 text-xs border-b bg-blue-50/30 dark:bg-blue-900/10 truncate"
                      title={`${category.name} (Budget)`}
                    >
                      <span className="mr-1">{category.icon}</span>
                      <span className="truncate text-blue-700 dark:text-blue-400">{category.name} (B)</span>
                    </div>
                    {/* Category Spent Row */}
                    <div
                      className="h-8 flex items-center px-3 pl-5 text-xs border-b truncate"
                      title={`${category.name} (Spent)`}
                    >
                      <span className="mr-1">{category.icon}</span>
                      <span className="truncate">{category.name} (S)</span>
                    </div>
                  </div>
                ))}

                {/* Spacer before bank allocations */}
                {bankAccountsWithAllocations.length > 0 && (
                  <>
                    <div className="h-3 border-b bg-background"></div>
                    
                    {/* Bank Allocations Header */}
                    <div className="h-9 flex items-center px-3 font-semibold text-xs border-b bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20 text-purple-800 dark:text-purple-300">
                      🏦 BANK ALLOCATIONS
                    </div>

                    {/* Bank Account Rows */}
                    {bankAccountsWithAllocations.map((account) => (
                      <Tooltip key={account.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="h-8 flex items-center px-3 pl-5 text-xs border-b truncate cursor-help"
                            title={account.accountName}
                          >
                            <span className="truncate">{account.accountName}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {account.bankName} - {account.accountType}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </>
                )}

                {/* Spacer before net balance */}
                <div className="h-3 border-b bg-background"></div>

                {/* NET BALANCE Row */}
                <div className="h-10 flex items-center px-3 font-bold text-sm bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                  ⚖️ NET BALANCE
                </div>
              </div>

              {/* Scrollable Columns - Pay Periods */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto scrollbar-thin"
              >
                <div className="flex" style={{ minWidth: `${payPeriods.length * 110}px` }}>
                  {payPeriods.map((period) => {
                    const net = period.income - period.totalExpenses;
                    const isNetPositive = net >= 0;
                    const budgetVariance = period.totalBudget - period.totalExpenses;
                    const isBudgetPositive = budgetVariance >= 0;

                    return (
                      <div key={period.number} className="flex-shrink-0 w-28 sm:w-32 border-r last:border-r-0">
                        {/* Header Row - Period Number */}
                        <div className="h-11 flex items-center justify-center font-bold text-sm border-b bg-gradient-to-r from-primary to-cyan-600 text-white">
                          {String(period.number).padStart(2, "0")}
                        </div>
                        
                        {/* Sub-header - Month */}
                        <div className="h-9 flex items-center justify-center text-xs border-b bg-muted/50 font-medium">
                          {formatMonth(period.startDate)}
                        </div>
                        
                        {/* Date Range Row */}
                        <div className="h-11 flex flex-col items-center justify-center text-[10px] border-b bg-muted/30 leading-tight">
                          <span>{formatDateShort(period.startDate)}</span>
                          <span className="text-muted-foreground">to</span>
                          <span>{formatDateShort(period.endDate)}</span>
                        </div>

                        {/* REV TOTAL Row */}
                        <div className="h-10 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 text-emerald-800 dark:text-emerald-300">
                          {formatCurrency(period.income)}
                        </div>

                        {/* PAYROLL Row */}
                        <div className="h-9 flex items-center justify-end px-2 text-sm border-b bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(period.income)}
                        </div>

                        {/* Spacer */}
                        <div className="h-3 border-b bg-background"></div>

                        {/* BUDGET TOTAL Row */}
                        <div className="h-10 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20 text-blue-800 dark:text-blue-300">
                          {formatCurrency(period.totalBudget)}
                        </div>

                        {/* EXP TOTAL Row */}
                        <div className={`h-10 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/20 ${
                          isBudgetPositive ? "text-rose-700 dark:text-rose-400" : "text-rose-800 dark:text-rose-300 font-bold"
                        }`}>
                          {formatCurrency(period.totalExpenses)}
                        </div>

                        {/* Category Rows - Budget & Spent */}
                        {allCategories.map((category) => {
                          const budgetAmount = period.categoryBudgets[category.id] || 0;
                          const spentAmount = period.expenses[category.id] || 0;
                          const isOverBudget = spentAmount > budgetAmount;
                          
                          return (
                            <div key={category.id}>
                              {/* Budget Row */}
                              <div className="h-8 flex items-center justify-end px-2 text-xs border-b bg-blue-50/30 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">
                                {formatCurrency(budgetAmount)}
                              </div>
                              {/* Spent Row - Clickable */}
                              <div
                                className={`h-8 flex items-center justify-end px-2 text-xs border-b ${
                                  isOverBudget ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-medium" : ""
                                } ${spentAmount > 0 ? "cursor-pointer hover:bg-primary/10 hover:underline transition-colors" : ""}`}
                                onClick={spentAmount > 0 ? () => handleActualClick(category, period) : undefined}
                                role={spentAmount > 0 ? "button" : undefined}
                                tabIndex={spentAmount > 0 ? 0 : undefined}
                                title={spentAmount > 0 ? `Click to see ${category.name} expenses` : undefined}
                              >
                                {spentAmount > 0 ? (
                                  <span style={{ color: isOverBudget ? undefined : category.color }}>
                                    {formatCurrency(spentAmount)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Spacer before bank allocations */}
                        {bankAccountsWithAllocations.length > 0 && (
                          <>
                            <div className="h-3 border-b bg-background"></div>
                            
                            {/* Bank Allocations Header */}
                            <div className="h-9 border-b bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20"></div>

                            {/* Bank Account Rows */}
                            {bankAccountsWithAllocations.map((account) => {
                              const amount = period.bankAllocations[account.id] || 0;
                              return (
                                <div
                                  key={account.id}
                                  className="h-8 flex items-center justify-end px-2 text-xs border-b text-purple-700 dark:text-purple-400"
                                >
                                  {amount > 0 ? formatCurrency(amount) : <span className="text-muted-foreground">-</span>}
                                </div>
                              );
                            })}
                          </>
                        )}

                        {/* Spacer before net balance */}
                        <div className="h-3 border-b bg-background"></div>

                        {/* NET BALANCE Row */}
                        <div
                          className={`h-10 flex items-center justify-end px-2 font-bold text-sm bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 ${
                            isNetPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(net, true)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Legend:</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <span>Revenue/Income</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <span>Budget (B)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-rose-500"></div>
                <span>Expenses/Spent (S)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-500"></div>
                <span>Bank Allocations</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actuals Breakdown Dialog */}
      <ActualsBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        categoryName={breakdownCategory?.name || ""}
        categoryIcon={breakdownCategory?.icon || "📊"}
        periodLabel={breakdownPeriod ? `Pay Period ${breakdownPeriod.number} (${breakdownPeriod.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${breakdownPeriod.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}
        totalAmount={breakdownPeriod && breakdownCategory ? (breakdownPeriod.expenses[breakdownCategory.id] || 0) : 0}
        expenses={breakdownExpenses}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
