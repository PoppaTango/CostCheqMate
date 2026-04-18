"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Bug,
  Send,
  Loader2,
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Crown,
  Sparkles,
  Gift,
  Download,
  Users,
} from "lucide-react";

interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  page: string | null;
  cheqsRewarded: number;
  createdAt: string;
}

interface SupportModuleProps {
  onCheqsChange?: () => void;
  userStatus: { cheqs: number; accountType: string; isAdmin: boolean } | null;
}

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low", cheqs: 25, color: "text-green-600", bg: "bg-green-100" },
  { value: "medium", label: "Medium", cheqs: 50, color: "text-yellow-600", bg: "bg-yellow-100" },
  { value: "high", label: "High", cheqs: 100, color: "text-orange-600", bg: "bg-orange-100" },
  { value: "critical", label: "Critical", cheqs: 200, color: "text-red-600", bg: "bg-red-100" },
];

const PAGE_OPTIONS = [
  "Home",
  "Scan / OCR",
  "Extra Income",
  "Budget",
  "Reports",
  "Settings",
  "Login / Signup",
  "About Page",
  "Other",
];

export default function SupportModule({ onCheqsChange, userStatus }: SupportModuleProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [exportingUsers, setExportingUsers] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [page, setPage] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");

  const selectedSeverity = SEVERITY_OPTIONS.find((s) => s.value === severity);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/bug-reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description) {
      toast({
        title: "Missing Fields",
        description: "Please provide a title and description.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          severity,
          page: page || null,
          stepsToReproduce: stepsToReproduce || null,
          expectedBehavior: expectedBehavior || null,
          actualBehavior: actualBehavior || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReports([data.report, ...reports]);
        
        // Reset form
        setTitle("");
        setDescription("");
        setSeverity("medium");
        setPage("");
        setStepsToReproduce("");
        setExpectedBehavior("");
        setActualBehavior("");
        
        toast({
          title: `Bug Report Submitted! +${data.cheqsEarned} Cheqs 🪙`,
          description: "Thank you for helping improve Cost CheqMate!",
        });
        onCheqsChange?.();
      } else {
        throw new Error("Failed to submit report");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit bug report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      const res = await fetch("/api/admin/users/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `costcheqmate_users_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({
          title: "Export Complete",
          description: "User list has been downloaded.",
        });
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export users. Admin access required.",
        variant: "destructive",
      });
    } finally {
      setExportingUsers(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in-progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "rejected":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const totalCheqsEarned = reports.reduce((sum, r) => sum + r.cheqsRewarded, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6 text-orange-500" />
            Support & Bug Reports
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Help Improve Cost CheqMate!</p>
                <p className="text-xs">Found a bug? Report it and earn Cheqs! The more detailed your report, the faster we can fix it. Critical bugs earn up to 200 Cheqs!</p>
              </TooltipContent>
            </Tooltip>
          </h2>
          <p className="text-muted-foreground mt-1">
            Report bugs and earn Cheqs rewards
          </p>
        </div>
        
        {/* Admin Export Button */}
        {userStatus?.isAdmin && (
          <Button
            onClick={handleExportUsers}
            disabled={exportingUsers}
            variant="outline"
            className="gap-2"
          >
            {exportingUsers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <Users className="h-4 w-4" />
            Export All Users (CSV)
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                <Bug className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-400">Reports Submitted</p>
                <p className="text-2xl font-bold text-orange-600">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cheqs Earned from Reports</p>
                <p className="text-2xl font-bold text-primary">🪙 {totalCheqsEarned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-400">Account Status</p>
                <p className="text-xl font-bold text-amber-600 capitalize">
                  {userStatus?.accountType || "Free"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bug Report Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Bug Report
          </CardTitle>
          <CardDescription>
            Detailed reports help us fix issues faster. Earn up to 200 Cheqs per report!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Bug Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief description of the issue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">
                  Severity * 
                  <span className="ml-2 text-xs text-primary font-normal">
                    (+{selectedSeverity?.cheqs} Cheqs)
                  </span>
                </Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className={s.color}>{s.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">(+{s.cheqs} Cheqs)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page">Page/Module Where Bug Occurred</Label>
              <Select value={page} onValueChange={setPage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select page (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what happened in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="steps">Steps to Reproduce (Optional)</Label>
              <Textarea
                id="steps"
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expected">Expected Behavior (Optional)</Label>
                <Input
                  id="expected"
                  placeholder="What should have happened?"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Behavior (Optional)</Label>
                <Input
                  id="actual"
                  placeholder="What actually happened?"
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Report (+{selectedSeverity?.cheqs} Cheqs)
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Previous Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bug Reports</CardTitle>
          <CardDescription>Track the status of your submitted reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No bug reports yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Submit your first report to start earning Cheqs!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report, index) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(report.status)}
                        <h4 className="font-medium">{report.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          SEVERITY_OPTIONS.find((s) => s.value === report.severity)?.bg || "bg-gray-100"
                        } ${SEVERITY_OPTIONS.find((s) => s.value === report.severity)?.color || "text-gray-600"}`}>
                          {report.severity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {report.page && <span>📍 {report.page}</span>}
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        <span className="capitalize">Status: {report.status}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary flex items-center gap-1">
                        <Gift className="h-4 w-4" />
                        +{report.cheqsRewarded}
                      </span>
                      <span className="text-xs text-muted-foreground">Cheqs</span>
                    </div>
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
