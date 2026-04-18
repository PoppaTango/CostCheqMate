"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  Loader2,
  HelpCircle,
  Target,
  AlertTriangle,
} from "lucide-react";
import { MONTHS } from "@/lib/types";

const RechartsCharts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

const PayPeriodCalendar = dynamic(() => import("./pay-period-calendar"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

interface CategorySpending {
  id: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  annualBudget: number;
}

interface MonthlySpending {
  month: string;
  total: number;
}

export default function ReportsModule() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategorySpending[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

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
      // Fetch budget summary
      const summaryRes = await fetch("/api/budget-summary");
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setCategories(summaryData?.categories ?? []);
        setTotalBudget(summaryData?.totalBudget ?? 0);
        setTotalSpent(summaryData?.totalSpent ?? 0);
      }

      // Fetch all expenses for the year
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const expensesRes = await fetch(`/api/expenses?startDate=${startDate}&endDate=${endDate}`);
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        setExpenses(expensesData ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error);
      toast({
        title: "Error",
        description: "Failed to load report data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate monthly spending
  const monthlySpending = useMemo(() => {
    const monthlyTotals: Record<number, number> = {};
    (expenses ?? []).forEach((expense) => {
      const date = new Date(expense?.date);
      if (date.getFullYear().toString() === selectedYear) {
        const month = date.getMonth();
        monthlyTotals[month] = (monthlyTotals[month] ?? 0) + (expense?.amount ?? 0);
      }
    });

    return MONTHS.map((name, index) => ({
      month: name.slice(0, 3),
      total: monthlyTotals[index] ?? 0,
    }));
  }, [expenses, selectedYear]);

  // Category pie chart data
  const categoryPieData = useMemo(() => {
    return (categories ?? [])
      .filter((cat) => (cat?.spent ?? 0) > 0)
      .map((cat) => ({
        name: cat?.name ?? "Unknown",
        value: cat?.spent ?? 0,
        color: cat?.color ?? "#6366f1",
      }));
  }, [categories]);

  // Budget vs Actual data - now by monthly period to avoid annual total skewing the graph
  const budgetVsActual = useMemo(() => {
    return (categories ?? []).map((cat) => ({
      name: cat?.name?.slice(0, 10) ?? "Unknown",
      budget: (cat?.annualBudget ?? 0) / 12, // Monthly budget
      actual: (cat?.spent ?? 0) / 12, // Average monthly actual (proportional)
    }));
  }, [categories]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const utilizationRate = totalBudget > 0 ? ((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Reports & Analytics
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Financial Analytics Dashboard</p>
                <p className="text-xs">Comprehensive view of your spending patterns. Use this data to make informed financial decisions, identify trends, and optimize your budget allocation.</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Visualize your spending patterns and budget performance
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-40">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent>Select fiscal year for analysis</TooltipContent>
        </Tooltip>
      </div>

      {/* Summary Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Total Spent ({selectedYear})
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Aggregate Disbursement</p>
                        <p className="text-xs">Total outflow of funds across all categories for the fiscal year. This represents your cumulative spending liability.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <PieChartIcon className="h-6 w-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Active Categories
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Portfolio Diversification</p>
                        <p className="text-xs">Number of expense categories with recorded transactions. More active categories indicate diverse spending patterns requiring balanced allocation.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-2xl font-bold">{categoryPieData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className={utilizationRate > 100 ? "border-rose-300 dark:border-rose-800" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  utilizationRate > 100 ? "bg-rose-100 dark:bg-rose-900/30" : "bg-purple-100 dark:bg-purple-900/30"
                }`}>
                  {utilizationRate > 100 ? (
                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                  ) : (
                    <Target className="h-6 w-6 text-purple-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Budget Utilization
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold">Budget Burn Rate</p>
                        <p className="text-xs">Ratio of actual expenditure to allocated budget. Values &gt;100% indicate budget overrun requiring immediate attention. Optimal range: 85-95%.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className={`text-2xl font-bold ${utilizationRate > 100 ? "text-rose-600" : ""}`}>
                    {utilizationRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <Tabs defaultValue="payperiod" className="space-y-4">
        <div className="overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:w-full sm:grid sm:grid-cols-4 gap-1">
            <TabsTrigger value="payperiod" className="whitespace-nowrap px-4 data-[state=active]:neon-glow">
              Pay Period
            </TabsTrigger>
            <TabsTrigger value="spending" className="whitespace-nowrap px-4 data-[state=active]:neon-glow">
              By Category
            </TabsTrigger>
            <TabsTrigger value="monthly" className="whitespace-nowrap px-4 data-[state=active]:neon-glow">
              Monthly Trends
            </TabsTrigger>
            <TabsTrigger value="budget" className="whitespace-nowrap px-4 data-[state=active]:neon-glow">
              Budget vs Actual
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payperiod">
          <PayPeriodCalendar />
        </TabsContent>

        <TabsContent value="spending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Spending by Category
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold">Expense Distribution Analysis</p>
                    <p className="text-xs">Visualizes how your spending is allocated across categories. Use this to identify high-cost areas and opportunities for reallocation. Larger slices represent higher expenditure concentrations.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>Distribution of expenses across categories - identify spending concentrations</CardDescription>
            </CardHeader>
            <CardContent>
              <RechartsCharts
                type="pie"
                data={categoryPieData}
                height={350}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Monthly Spending Trends
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold">Temporal Cash Outflow Analysis</p>
                    <p className="text-xs">Shows spending patterns across months. Identify seasonal variations, detect anomalies, and forecast future expenses based on historical trends. Use this for cash flow planning.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>Total spending for each month in {selectedYear} - identify seasonal patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <RechartsCharts
                type="bar"
                data={monthlySpending}
                height={350}
                dataKey="total"
                xKey="month"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Monthly Budget vs Actual Spending
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold">Monthly Variance Analysis</p>
                    <p className="text-xs">Compares monthly budgeted allocations against average monthly expenditures. Values are shown per month to provide proportional comparison without annual totals skewing the visualization.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>Monthly budget vs actual spending per category - proportional comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <RechartsCharts
                type="comparison"
                data={budgetVsActual}
                height={400}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Expenses List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
          <CardDescription>Your latest recorded expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {(expenses ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No expenses recorded for {selectedYear}
            </p>
          ) : (
            <div className="space-y-3">
              {(expenses ?? []).slice(0, 10).map((expense, index) => (
                <motion.div
                  key={expense?.id ?? index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{expense?.category?.icon ?? "📦"}</span>
                    <div>
                      <p className="font-medium">{expense?.merchant || expense?.category?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(expense?.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(expense?.amount ?? 0)}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
