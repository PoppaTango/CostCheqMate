"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Loader2, ChevronLeft, ChevronRight, Info, TrendingUp, TrendingDown, PiggyBank, Target, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import dynamic from "next/dynamic";

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

export default function PayPeriodCalendar() {
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
    // Filter raw expenses for this category + period
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

    // Calculate bank allocations based on BUDGETED amounts (sum of per-period budgets for categories linked to each bank)
    const bankAllocationsPerPeriod: { [bankAccountId: string]: number } = {};
    categories.forEach((cat) => {
      if (cat.bankAccountId) {
        const perPeriod = cat.annualBudget / periodsPerYear;
        bankAllocationsPerPeriod[cat.bankAccountId] =
          (bankAllocationsPerPeriod[cat.bankAccountId] || 0) + perPeriod;
      }
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
        let totalExpenses = 0;

        expenses.forEach((expense) => {
          const expenseDate = new Date(expense.date);
          if (expenseDate >= startDate && expenseDate <= endDate) {
            const catId = expense.categoryId;
            periodExpenses[catId] = (periodExpenses[catId] || 0) + expense.amount;
            totalExpenses += expense.amount;
          }
        });

        periods.push({
          number: periodNumber,
          startDate,
          endDate,
          income: income.netAmountPerPay,
          expenses: periodExpenses,
          totalExpenses,
          bankAllocations: bankAllocationsPerPeriod, // Use budgeted amounts per bank
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
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  // Mouse wheel horizontal scroll handler
  const handleWheelScroll = useCallback((e: WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Add wheel event listener to the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheelScroll, { passive: false });
      return () => {
        container.removeEventListener("wheel", handleWheelScroll);
      };
    }
  }, [handleWheelScroll, loading]);

  // Calculate summary KPIs
  const summaryKPIs = useMemo(() => {
    if (payPeriods.length === 0) return null;

    const totalIncome = payPeriods.reduce((sum, p) => sum + p.income, 0);
    const totalExpenses = payPeriods.reduce((sum, p) => sum + p.totalExpenses, 0);
    const totalBudget = payPeriods.reduce((sum, p) => sum + p.totalBudget, 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0;
    const budgetUtilization = totalBudget > 0 ? ((totalExpenses / totalBudget) * 100) : 0;
    
    // Find periods with expenses to determine current period
    const periodsWithExpenses = payPeriods.filter((p) => p.totalExpenses > 0);
    const avgExpensePerPeriod = periodsWithExpenses.length > 0
      ? totalExpenses / periodsWithExpenses.length
      : 0;

    return {
      totalIncome,
      totalExpenses,
      totalBudget,
      netSavings,
      savingsRate,
      budgetUtilization,
      avgExpensePerPeriod,
      periodsCount: payPeriods.length,
      activePeriodsCount: periodsWithExpenses.length,
    };
  }, [payPeriods]);

  // All categories
  const allCategories = categories;

  // Bank accounts with allocations (based on budgeted amounts)
  const bankAccountsWithAllocations = useMemo(() => {
    // Filter bank accounts that have at least one category linked to them with a budget > 0
    const accountsWithBudget = new Set<string>();
    categories.forEach((cat) => {
      if (cat.bankAccountId && cat.annualBudget > 0) {
        accountsWithBudget.add(cat.bankAccountId);
      }
    });
    return bankAccounts.filter((account) => accountsWithBudget.has(account.id));
  }, [bankAccounts, categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!income?.firstPayDate) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Pay Period Calendar Not Set Up</h3>
            <p className="text-muted-foreground mb-4">
              To view the pay period calendar, please set your <strong>First Pay Date</strong> in Settings → Income.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      {summaryKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    Net Savings
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Actuarial Net Surplus</p>
                        <p className="text-xs">Total income minus total expenses across all {summaryKPIs.periodsCount} pay periods. A positive value indicates you're accumulating reserves.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-xl font-bold ${summaryKPIs.netSavings >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(summaryKPIs.netSavings)}
                  </p>
                </div>
                {summaryKPIs.netSavings >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-emerald-500/50" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-rose-500/50" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    Savings Rate
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Actuarial Reserve Ratio</p>
                        <p className="text-xs">Percentage of income retained after expenses. Financial planners recommend 20%+ for long-term stability. This metric is key to building emergency reserves.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-xl font-bold ${summaryKPIs.savingsRate >= 20 ? "text-emerald-600" : summaryKPIs.savingsRate >= 10 ? "text-amber-600" : "text-rose-600"}`}>
                    {summaryKPIs.savingsRate.toFixed(1)}%
                  </p>
                </div>
                <PiggyBank className="h-8 w-8 text-blue-500/50" />
              </div>
              <div className="mt-2">
                <Progress 
                  value={Math.min(summaryKPIs.savingsRate, 100)} 
                  className="h-1.5"
                  indicatorClassName={summaryKPIs.savingsRate >= 20 ? "bg-emerald-500" : summaryKPIs.savingsRate >= 10 ? "bg-amber-500" : "bg-rose-500"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    Budget Utilization
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Budget Burn Rate</p>
                        <p className="text-xs">Actual spending vs. budgeted amounts. Under 100% means you're under budget. Track this to identify spending patterns and adjust allocations.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-xl font-bold ${summaryKPIs.budgetUtilization <= 100 ? "text-emerald-600" : "text-rose-600"}`}>
                    {summaryKPIs.budgetUtilization.toFixed(1)}%
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-500/50" />
              </div>
              <div className="mt-2">
                <Progress 
                  value={Math.min(summaryKPIs.budgetUtilization, 100)} 
                  className="h-1.5"
                  indicatorClassName={summaryKPIs.budgetUtilization <= 85 ? "bg-emerald-500" : summaryKPIs.budgetUtilization <= 100 ? "bg-amber-500" : "bg-rose-500"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    Avg per Period
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Mean Periodic Outflow</p>
                        <p className="text-xs">Average spending per active pay period. Use this to forecast future expenses and plan for irregular costs. Based on {summaryKPIs.activePeriodsCount} periods with activity.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    {formatCurrency(summaryKPIs.avgExpensePerPeriod)}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500/50" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                across {summaryKPIs.activePeriodsCount} active periods
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pay Period Calendar
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold">Cash Flow Projection Matrix</p>
                    <p className="text-xs">This table shows your income, budgeted amounts, and actual spending across all pay periods. Use your mouse wheel to scroll horizontally. Colors indicate over/under budget status.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Budget shows per-period allocation (Annual ÷ {periodsPerYear} periods) • Scroll with mouse wheel
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleScrollLeft}>
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
              <Button variant="outline" size="icon" onClick={handleScrollRight}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
        {/* Spreadsheet-style Pay Period Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* STICKY HEADER SECTION */}
          <div className="sticky top-0 z-20 bg-background shadow-sm">
            <div className="flex">
              {/* Fixed Left Column - Sticky Header Labels */}
              <div className="flex-shrink-0 w-36 sm:w-44 bg-background border-r">
                {/* Header Row - Year */}
                <div className="h-10 flex items-center px-2 font-bold text-sm border-b bg-gradient-to-r from-primary to-cyan-600 text-white">
                  {selectedYear}
                </div>
                
                {/* Legend Row */}
                <div className="h-auto py-2 px-2 border-b bg-muted/30">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">LEGEND</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 text-[9px]">
                      <span className="w-2 h-2 rounded bg-emerald-100 dark:bg-emerald-900/30 border"></span>
                      <span>Rev</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px]">
                      <span className="w-2 h-2 rounded bg-blue-100 dark:bg-blue-900/30 border"></span>
                      <span>Budget</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px]">
                      <span className="w-2 h-2 rounded bg-rose-100 dark:bg-rose-900/30 border"></span>
                      <span>Spent</span>
                    </span>
                  </div>
                </div>

                {/* REV TOTAL Row */}
                <div className="h-9 flex items-center px-2 font-semibold text-sm border-b bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/20 text-emerald-800 dark:text-emerald-300">
                  REV TOTAL
                </div>

                {/* BUDGET TOTAL Row */}
                <div className="h-9 flex items-center px-2 font-semibold text-sm border-b bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-800 dark:text-blue-300">
                  BUDGET TOTAL
                </div>
              </div>

              {/* Scrollable Sticky Header Columns */}
              <div className="flex-1 overflow-hidden">
                <div 
                  className="flex" 
                  style={{ 
                    minWidth: `${payPeriods.length * 100}px`,
                    transform: `translateX(-${scrollContainerRef.current?.scrollLeft || 0}px)`,
                  }}
                  id="sticky-header-row"
                >
                  {payPeriods.map((period) => (
                    <div key={`header-${period.number}`} className="flex-shrink-0 w-24 sm:w-28 border-r last:border-r-0">
                      {/* Header Row - Period Number */}
                      <div className="h-10 flex items-center justify-center font-bold text-sm border-b bg-gradient-to-r from-primary to-cyan-600 text-white">
                        {String(period.number).padStart(2, "0")}
                      </div>
                      
                      {/* Legend placeholder */}
                      <div className="h-auto py-2 border-b bg-muted/30">
                        <p className="text-[10px] text-center text-muted-foreground">{formatMonth(period.startDate)}</p>
                        <p className="text-[9px] text-center text-muted-foreground">{formatDateShort(period.startDate)} - {formatDateShort(period.endDate)}</p>
                      </div>

                      {/* REV TOTAL Row */}
                      <div className="h-9 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/20 text-emerald-800 dark:text-emerald-300">
                        {formatCurrency(period.income)}
                      </div>

                      {/* BUDGET TOTAL Row */}
                      <div className="h-9 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-800 dark:text-blue-300">
                        {formatCurrency(period.totalBudget)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SCROLLABLE BODY SECTION */}
          <div className="flex">
            {/* Fixed Left Column - Row Labels */}
            <div className="flex-shrink-0 w-36 sm:w-44 bg-background border-r z-10">
              {/* PAYROLL Row */}
              <div className="h-8 flex items-center px-2 pl-4 text-sm border-b bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                PAYROLL
              </div>

              {/* Spacer */}
              <div className="h-3 border-b bg-background"></div>

              {/* EXP TOTAL Row */}
              <div className="h-9 flex items-center px-2 font-semibold text-sm border-b bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-900/20 text-rose-800 dark:text-rose-300">
                EXP TOTAL
              </div>

              {/* Category Rows - Budget and Spent */}
              {allCategories.map((category) => (
                <div key={category.id}>
                  <div
                    className="h-7 flex items-center px-2 pl-4 text-xs border-b bg-blue-50/30 dark:bg-blue-900/10 truncate"
                    title={`${category.name} Budget`}
                  >
                    <span className="mr-1">{category.icon}</span>
                    <span className="truncate text-blue-600 dark:text-blue-400">{category.name} (B)</span>
                  </div>
                  <div
                    className="h-7 flex items-center px-2 pl-4 text-xs border-b truncate"
                    title={`${category.name} Spent`}
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
                  <div className="h-8 flex items-center px-2 font-semibold text-xs border-b bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/20 text-purple-800 dark:text-purple-300">
                    BANK TRANSFERS
                  </div>

                  {/* Bank Account Rows */}
                  {bankAccountsWithAllocations.map((account) => (
                    <Tooltip key={account.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-8 flex items-center px-2 pl-4 text-xs border-b truncate cursor-help"
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
              <div className="h-9 flex items-center px-2 font-bold text-sm bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                NET BALANCE
              </div>
            </div>

            {/* Scrollable Columns - Pay Periods */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
              onScroll={() => {
                // Sync sticky header scroll
                const header = document.getElementById('sticky-header-row');
                if (header && scrollContainerRef.current) {
                  header.style.transform = `translateX(-${scrollContainerRef.current.scrollLeft}px)`;
                }
              }}
            >
              <div className="flex" style={{ minWidth: `${payPeriods.length * 100}px` }}>
                {payPeriods.map((period) => {
                  const net = period.income - period.totalExpenses;
                  const isNetPositive = net >= 0;

                  return (
                    <div key={period.number} className="flex-shrink-0 w-24 sm:w-28 border-r last:border-r-0">
                      {/* PAYROLL Row */}
                      <div className="h-8 flex items-center justify-end px-2 text-sm border-b bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(period.income)}
                      </div>

                      {/* Spacer */}
                      <div className="h-3 border-b bg-background"></div>

                      {/* EXP TOTAL Row */}
                      <div className="h-9 flex items-center justify-end px-2 font-semibold text-sm border-b bg-gradient-to-r from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-900/20 text-rose-800 dark:text-rose-300">
                        {formatCurrency(period.totalExpenses)}
                      </div>

                      {/* Category Rows - Budget and Spent */}
                      {allCategories.map((category) => {
                        const budgetAmount = period.categoryBudgets[category.id] || 0;
                        const spentAmount = period.expenses[category.id] || 0;
                        const isOverBudget = spentAmount > budgetAmount;
                        return (
                          <div key={category.id}>
                            {/* Budget Row */}
                            <div className="h-7 flex items-center justify-end px-2 text-xs border-b bg-blue-50/30 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">
                              {formatCurrency(budgetAmount)}
                            </div>
                            {/* Spent Row - Clickable */}
                            <div
                              className={`h-7 flex items-center justify-end px-2 text-xs border-b ${
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
                          <div className="h-8 border-b bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/20"></div>

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
                        className={`h-9 flex items-center justify-end px-2 font-bold text-sm bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 ${
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
        <div className="mt-4 px-2 sm:px-0 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/30 border"></div>
            <span>Income/Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/30 border"></div>
            <span>Budget (B)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-rose-100 dark:bg-rose-900/30 border"></div>
            <span>Spent (S)</span>
          </div>
          {bankAccountsWithAllocations.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-100 dark:bg-purple-900/30 border"></div>
              <span>Bank Transfers</span>
            </div>
          )}
          <div className="ml-auto text-xs">
            🖱️ Use mouse wheel to scroll • ← → Arrow buttons
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
