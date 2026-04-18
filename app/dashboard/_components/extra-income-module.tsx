"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  DollarSign,
  Loader2,
  Calendar,
  HelpCircle,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface AdditionalIncome {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  date: string;
}

interface ExtraIncomeModuleProps {
  onCheqsChange?: () => void;
}

const INCOME_SOURCES = [
  { value: "E-Transfer", label: "💸 E-Transfer", emoji: "💸" },
  { value: "Cash", label: "💵 Cash", emoji: "💵" },
  { value: "Side Hustle", label: "💼 Side Hustle", emoji: "💼" },
  { value: "Gift", label: "🎁 Gift", emoji: "🎁" },
  { value: "Refund", label: "🔄 Refund", emoji: "🔄" },
  { value: "Bonus", label: "🎉 Bonus", emoji: "🎉" },
  { value: "Tax Return", label: "📋 Tax Return", emoji: "📋" },
  { value: "Investment", label: "📈 Investment", emoji: "📈" },
  { value: "Other", label: "💰 Other", emoji: "💰" },
];

export default function ExtraIncomeModule({ onCheqsChange }: ExtraIncomeModuleProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [incomes, setIncomes] = useState<AdditionalIncome[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchIncomes();
  }, []);

  const fetchIncomes = async () => {
    try {
      const res = await fetch("/api/additional-income");
      if (res.ok) {
        const data = await res.json();
        setIncomes(data);
      }
    } catch (error) {
      console.error("Failed to fetch incomes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !source || !date) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/additional-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          source,
          description: description || null,
          date: new Date(date).toISOString(),
        }),
      });

      if (res.ok) {
        const newIncome = await res.json();
        setIncomes([newIncome, ...incomes]);
        setAmount("");
        setSource("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);
        setShowForm(false);
        toast({
          title: "Income Added! +2 Cheqs 🪙",
          description: `Added ${formatCurrency(parseFloat(amount))} from ${source}`,
        });
        onCheqsChange?.();
      } else {
        throw new Error("Failed to add income");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add income. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/additional-income/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setIncomes(incomes.filter((i) => i.id !== id));
        toast({
          title: "Income Deleted",
          description: "The income entry has been removed.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete income.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const getSourceEmoji = (source: string) => {
    return INCOME_SOURCES.find((s) => s.value === source)?.emoji || "💰";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-500" />
            Extra Income
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Track Additional Revenue</p>
                <p className="text-xs">Log any extra income beyond your regular payroll - side hustles, gifts, refunds, bonuses, and more. This helps you get a complete picture of your cash flow.</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Track side income, gifts, refunds, and other revenue sources
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="neon-glow-hover bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Income
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Total Extra Income</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">{incomes.length} entries</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                +2 Cheqs per entry
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Extra Income</CardTitle>
              <CardDescription>Log a new income source</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source *</Label>
                    <Select value={source} onValueChange={setSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOME_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="e.g., Birthday gift from grandma"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Income
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Income List */}
      <Card>
        <CardHeader>
          <CardTitle>Income History</CardTitle>
          <CardDescription>Your additional income entries</CardDescription>
        </CardHeader>
        <CardContent>
          {incomes.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No extra income logged yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Income" to get started and earn Cheqs!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomes.map((income, index) => (
                <motion.div
                  key={income.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{getSourceEmoji(income.source)}</span>
                    <div>
                      <p className="font-medium">{income.source}</p>
                      {income.description && (
                        <p className="text-sm text-muted-foreground">{income.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(income.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                      +{formatCurrency(income.amount)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(income.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete entry</TooltipContent>
                    </Tooltip>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
