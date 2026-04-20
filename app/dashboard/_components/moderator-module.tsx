// =============================================================================
// MODERATOR MODULE - Comprehensive administration panel for staff
// 
// Features:
// - User Management: Search, filter, edit roles/status/Cheqs, custom labels
// - Ban System: Issue, track, and revoke user bans
// - Warning System: Issue formal warnings to users
// - Notes System: Internal staff notes about users
// - Reports Queue: Community reports requiring review
// - Announcements: System-wide announcements
// - System Settings: Configure app settings (admin only)
// - Action Log: Full audit trail of all moderation actions
// - Payments: Track donations and revenue (admin/superuser only)
// - Audit Trail: Comprehensive audit logs (admin + authorized superusers)
// - Role Labels: Custom gamification labels (admin only)
//
// Role Hierarchy:
// - admin: Single application administrator with FULL control (cannot be demoted)
// - superuser: Delegated administrators with nearly full powers (cannot demote admin)
// - moderator: Staff who handle daily moderation tasks
// - premium: Paying users with enhanced features
// - free: Regular free users
// =============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Shield, ShieldAlert, Ban, History, Search, Edit, Coins, Crown,
  AlertTriangle, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight,
  User, Eye, RefreshCw, Activity, MessageSquare, FileText, Bell,
  Settings, DollarSign, AlertCircle, Plus, Trash2, Pin, Lock,
  UserCheck, UserX, Megaphone, CreditCard, TrendingUp, BarChart3,
} from "lucide-react";
import {
  OFFENSE_LABELS, STATUS_LABELS, ROLE_LABELS, BAN_DURATION_OPTIONS,
  WARNING_LABELS, NOTE_CATEGORY_LABELS, PRIORITY_LABELS, REPORT_STATUS_LABELS,
  ACTION_LABELS, getStatusColor, getRoleColor, getPriorityColor,
  formatModDate, getBanTimeRemaining, WARNING_SEVERITY_OPTIONS,
  canModerate, isAdmin, isOwner, isSuperUser, canManageUser, getAssignableRoles,
} from "@/lib/moderator";
import type { OffenseType, UserRole, WarningType, NoteCategory, ReportPriority } from "@/lib/moderator";

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  customRoleLabel: string | null;
  status: string;
  accountType: string;
  cheqs: number;
  isVerified: boolean;
  canViewAuditTrail: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  bans?: { id: string; reason: string; offense: string; endDate: string | null }[];
  premiumTrial?: {
    limit: number;
    usedActions: number;
    remainingActions: number;
    hasFullPremiumAccess: boolean;
    isFreeTrialEligible: boolean;
    nextResetAt: string;
  } | null;
}

interface RoleLabel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface BanData {
  id: string;
  reason: string;
  offense: string;
  evidence: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  revokedAt: string | null;
  user: { id: string; name: string | null; email: string | null };
  issuedBy: { id: string; name: string | null; email: string | null };
}

interface WarningData {
  id: string;
  type: string;
  reason: string;
  severity: number;
  acknowledged: boolean;
  expiresAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null };
  issuedBy: { id: string; name: string | null; email: string | null };
}

interface ReportData {
  id: string;
  reason: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string | null };
  reportedUser: { id: string; name: string | null; email: string | null; role: string };
  reviewedBy?: { id: string; name: string | null; email: string | null };
}

interface ActionData {
  id: string;
  action: string;
  details: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  targetUser: { id: string; name: string | null; email: string | null };
  performedBy: { id: string; name: string | null; email: string | null };
}

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  type: string;
  targetRoles: string[];
  isPinned: boolean;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  cheqsAwarded: number;
  createdAt: string;
  completedAt: string | null;
  user: { id: string; name: string | null; email: string | null };
}

interface Stats {
  users: { total: number; active: number; banned: number; suspended: number; moderators: number };
  bans: { active: number };
  actions: { total: number; recent: number };
}

interface SystemSettingsData {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  registrationEnabled: boolean;
  premiumPrice: number;
  premiumTrialMonthlyActionLimit: number;
  stripeEnabled: boolean;
  paymentEmail: string | null;
  paymentPhone: string | null;
  cheqsPerDollar: number;
  welcomeMessage: string | null;
}

interface StripeConfigData {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  isConnected: boolean;
  webhookUrl?: string;
}

interface StripeTestResult {
  connected: boolean;
  accountId?: string;
  businessName?: string;
  country?: string;
  currency?: string;
  livemode?: boolean;
  error?: string;
}

interface ModeratorModuleProps {
  currentUserRole: string;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function ModeratorModule({ currentUserRole }: ModeratorModuleProps) {
  const { toast } = useToast();
  
  // Tab and loading state
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  
  // Bans state
  const [bans, setBans] = useState<BanData[]>([]);
  const [banPage, setBanPage] = useState(1);
  const [banPages, setBanPages] = useState(1);
  
  // Warnings state
  const [warnings, setWarnings] = useState<WarningData[]>([]);
  const [warningPage, setWarningPage] = useState(1);
  const [warningPages, setWarningPages] = useState(1);
  
  // Reports state
  const [reports, setReports] = useState<ReportData[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState("pending");
  const [reportPage, setReportPage] = useState(1);
  const [reportPages, setReportPages] = useState(1);
  
  // Actions state
  const [actions, setActions] = useState<ActionData[]>([]);
  const [actionPage, setActionPage] = useState(1);
  const [actionPages, setActionPages] = useState(1);
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  
  // Payments state
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [paymentTotals, setPaymentTotals] = useState<{ totalRevenue: number; totalTransactions: number } | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState<SystemSettingsData | null>(null);
  
  // Stripe config state
  const [stripeConfig, setStripeConfig] = useState<StripeConfigData | null>(null);
  const [stripeTestResult, setStripeTestResult] = useState<StripeTestResult | null>(null);
  const [stripeTesting, setStripeTesting] = useState(false);
  const [stripeKeyForm, setStripeKeyForm] = useState({ publishableKey: "", secretKey: "", webhookSecret: "" });
  const [stripeEditing, setStripeEditing] = useState<"publishableKey" | "secretKey" | "webhookSecret" | null>(null);
  const [stripeSaving, setStripeSaving] = useState(false);
  
  // Dialog states
  const [editDialog, setEditDialog] = useState<{ type: string | null; user: UserData | null }>({
    type: null, user: null,
  });
  const [banDialog, setBanDialog] = useState<UserData | null>(null);
  const [warningDialog, setWarningDialog] = useState<UserData | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<UserData | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [reportDialog, setReportDialog] = useState<ReportData | null>(null);
  const [announcementDialog, setAnnouncementDialog] = useState(false);
  
  // Form states
  const [banForm, setBanForm] = useState({
    reason: "", offense: "other" as OffenseType, evidence: "", duration: "7_days",
  });
  const [warningForm, setWarningForm] = useState({
    type: "verbal" as WarningType, reason: "", severity: 1,
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: "", content: "", type: "info", targetRoles: ["user", "moderator", "admin", "owner"], isPinned: false,
  });
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  // -------------------------------------------------------------------------
  // DATA FETCHING FUNCTIONS
  // -------------------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/moderator/stats");
      if (res.ok) setStats(await res.json());
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set("search", userSearch);
      if (userRoleFilter && userRoleFilter !== "all") params.set("role", userRoleFilter);
      if (userStatusFilter && userStatusFilter !== "all") params.set("status", userStatusFilter);
      params.set("page", userPage.toString());
      
      const res = await fetch(`/api/moderator/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUserPages(data.pagination.pages);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [userSearch, userRoleFilter, userStatusFilter, userPage]);

  const fetchBans = useCallback(async () => {
    try {
      const res = await fetch(`/api/moderator/bans?page=${banPage}`);
      if (res.ok) {
        const data = await res.json();
        setBans(data.bans);
        setBanPages(data.pagination.pages);
      }
    } catch (error) {
      console.error("Error fetching bans:", error);
    }
  }, [banPage]);

  const fetchWarnings = useCallback(async () => {
    try {
      const res = await fetch(`/api/moderator/warnings?page=${warningPage}`);
      if (res.ok) {
        const data = await res.json();
        setWarnings(data.warnings);
        setWarningPages(data.pagination.pages);
      }
    } catch (error) {
      console.error("Error fetching warnings:", error);
    }
  }, [warningPage]);

  const fetchReports = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (reportStatusFilter !== "all") params.set("status", reportStatusFilter);
      params.set("page", reportPage.toString());
      
      const res = await fetch(`/api/moderator/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports);
        setReportPages(data.pagination.pages);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    }
  }, [reportStatusFilter, reportPage]);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/moderator/actions?page=${actionPage}`);
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions);
        setActionPages(data.pagination.pages);
      }
    } catch (error) {
      console.error("Error fetching actions:", error);
    }
  }, [actionPage]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/moderator/announcements?activeOnly=false");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/moderator/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }, []);

  const fetchStripeConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/moderator/stripe-config");
      if (res.ok) {
        setStripeConfig(await res.json());
      }
    } catch (error) {
      console.error("Error fetching Stripe config:", error);
    }
  }, []);

  const handleTestStripeConnection = async () => {
    setStripeTesting(true);
    setStripeTestResult(null);
    try {
      const res = await fetch("/api/moderator/stripe-config", { method: "POST" });
      const data = await res.json();
      setStripeTestResult(data);
    } catch {
      setStripeTestResult({ connected: false, error: "Network error" });
    } finally {
      setStripeTesting(false);
    }
  };

  const handleSaveStripeKey = async (field: "publishableKey" | "secretKey" | "webhookSecret") => {
    const value = stripeKeyForm[field];
    if (!value.trim()) return;
    setStripeSaving(true);
    try {
      const res = await fetch("/api/moderator/stripe-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setStripeConfig(prev => prev ? { ...prev, ...data } : data);
        setStripeEditing(null);
        setStripeKeyForm(prev => ({ ...prev, [field]: "" }));
        toast({ title: "Stripe key updated successfully" });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving key", variant: "destructive" });
    } finally {
      setStripeSaving(false);
    }
  };

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/history");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments);
        setPaymentTotals(data.totals);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    }
  }, []);

  // Initial load and tab-based data fetching
  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, [fetchStats, fetchUsers]);

  useEffect(() => {
    if (activeTab === "bans") fetchBans();
    if (activeTab === "warnings") fetchWarnings();
    if (activeTab === "reports") fetchReports();
    if (activeTab === "actions") fetchActions();
    if (activeTab === "announcements") fetchAnnouncements();
    if (activeTab === "settings") { fetchSettings(); if (isOwner(currentUserRole)) fetchStripeConfig(); }
    if (activeTab === "payments") fetchPayments();
  }, [activeTab, currentUserRole, fetchBans, fetchWarnings, fetchReports, fetchActions, fetchAnnouncements, fetchSettings, fetchStripeConfig, fetchPayments]);

  // -------------------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------------------

  const handleEditUser = async () => {
    if (!editDialog.type || !editDialog.user) return;
    try {
      const res = await fetch(`/api/moderator/users/${editDialog.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: editDialog.type, value: editValue, reason: editReason }),
      });
      if (res.ok) {
        toast({ title: "Success", description: `User ${editDialog.type} updated` });
        setEditDialog({ type: null, user: null });
        setEditValue("");
        setEditReason("");
        fetchUsers();
        fetchStats();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
  };

  const handleIssueBan = async () => {
    if (!banDialog) return;
    try {
      const res = await fetch("/api/moderator/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: banDialog.id, ...banForm }),
      });
      if (res.ok) {
        toast({ title: "Ban Issued", description: `${banDialog.name || banDialog.email} has been banned` });
        setBanDialog(null);
        setBanForm({ reason: "", offense: "other", evidence: "", duration: "7_days" });
        fetchUsers(); fetchBans(); fetchStats();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to issue ban", variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    try {
      const res = await fetch("/api/moderator/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteDialog.id, reason: deleteReason }),
      });
      if (res.ok) {
        toast({ title: "User Deleted", description: `${deleteDialog.name || deleteDialog.email} has been permanently deleted` });
        setDeleteDialog(null);
        setDeleteReason("");
        fetchUsers(); fetchStats();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const handleRevokeBan = async (banId: string) => {
    const reason = prompt("Reason for revoking (optional):");
    try {
      const res = await fetch(`/api/moderator/bans/${banId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        toast({ title: "Ban Revoked" });
        fetchBans(); fetchUsers(); fetchStats();
      }
    } catch {
      toast({ title: "Error", description: "Failed to revoke ban", variant: "destructive" });
    }
  };

  const handleIssueWarning = async () => {
    if (!warningDialog) return;
    try {
      const res = await fetch("/api/moderator/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: warningDialog.id, ...warningForm }),
      });
      if (res.ok) {
        toast({ title: "Warning Issued" });
        setWarningDialog(null);
        setWarningForm({ type: "verbal", reason: "", severity: 1 });
        fetchWarnings();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to issue warning", variant: "destructive" });
    }
  };

  const handleUpdateReport = async (status: string, resolution?: string) => {
    if (!reportDialog) return;
    try {
      const res = await fetch(`/api/moderator/reports/${reportDialog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });
      if (res.ok) {
        toast({ title: "Report Updated" });
        setReportDialog(null);
        fetchReports();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleCreateAnnouncement = async () => {
    try {
      const res = await fetch("/api/moderator/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcementForm),
      });
      if (res.ok) {
        toast({ title: "Announcement Created" });
        setAnnouncementDialog(false);
        setAnnouncementForm({ title: "", content: "", type: "info", targetRoles: ["user", "moderator", "admin", "owner"], isPinned: false });
        fetchAnnouncements();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleUpdateSettings = async (field: string, value: unknown) => {
    try {
      const res = await fetch("/api/moderator/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast({ title: "Settings Updated" });
        fetchSettings();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  // -------------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------------

  const getStatusBadge = (status: string) => (
    <Badge variant="outline" className={getStatusColor(status)}>
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
    </Badge>
  );

  const getRoleBadge = (role: string) => (
    <Badge variant="outline" className={getRoleColor(role)}>
      {ROLE_LABELS[role as UserRole] || role}
    </Badge>
  );

  // Check which tabs this user can access
  // Access controls - SuperUsers can access payments, only Admin can access settings
  const canAccessPayments = isSuperUser(currentUserRole);  // admin + superuser
  const canAccessSettings = isAdmin(currentUserRole);      // admin only
  const canManageAnnouncements = isAdmin(currentUserRole);

  // -------------------------------------------------------------------------
  // MAIN RENDER
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-500" />
            Moderator Panel
            <Badge className={getRoleColor(currentUserRole)}>
              {ROLE_LABELS[currentUserRole as UserRole] || currentUserRole}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">Comprehensive moderation tools</p>
        </div>
        <Button onClick={() => { fetchStats(); fetchUsers(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.users.total}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.users.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Ban className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.bans.active}</p>
                  <p className="text-xs text-muted-foreground">Active Bans</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.users.moderators}</p>
                  <p className="text-xs text-muted-foreground">Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.actions.recent}</p>
                  <p className="text-xs text-muted-foreground">Actions (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="bans" className="gap-1"><Ban className="h-4 w-4" />Bans</TabsTrigger>
          <TabsTrigger value="warnings" className="gap-1"><AlertTriangle className="h-4 w-4" />Warnings</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><FileText className="h-4 w-4" />Reports</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1"><Megaphone className="h-4 w-4" />Announce</TabsTrigger>
          <TabsTrigger value="actions" className="gap-1"><History className="h-4 w-4" />Log</TabsTrigger>
          {canAccessPayments && (
            <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-4 w-4" />Payments</TabsTrigger>
          )}
          {canAccessSettings && (
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-4 w-4" />Settings</TabsTrigger>
          )}
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="All Roles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="free">Free User</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="superuser">Super User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.name || "No name"}</p>
                            {user.isVerified && <UserCheck className="h-4 w-4 text-green-500" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {getRoleBadge(user.role)}
                        {getStatusBadge(user.status)}
                        <Badge variant="outline" className="gap-1"><Coins className="h-3 w-3" />{user.cheqs}</Badge>
                        {user.premiumTrial?.isFreeTrialEligible && (
                          <Badge
                            variant="outline"
                            className={
                              user.premiumTrial.remainingActions > 0
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                            }
                          >
                            Trial {user.premiumTrial.usedActions}/{user.premiumTrial.limit}
                          </Badge>
                        )}
                        {user.accountType === "premium" && (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                            <Crown className="h-3 w-3 mr-1" />Premium
                          </Badge>
                        )}
                        {user.accountType === "business" && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                            <Crown className="h-3 w-3 mr-1" />Business
                          </Badge>
                        )}
                      </div>
                      {user.premiumTrial?.isFreeTrialEligible && (
                        <p className="text-xs text-muted-foreground md:text-right">
                          Remaining this month:{" "}
                          <span className="font-medium">{user.premiumTrial.remainingActions}</span>{" "}
                          • Reset: {new Date(user.premiumTrial.nextResetAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {canManageUser(currentUserRole, user.role) && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { setEditDialog({ type: "role", user }); setEditValue(user.role); }}>
                              <Shield className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditDialog({ type: "status", user }); setEditValue(user.status); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setEditDialog({ type: "cheqs", user }); setEditValue(user.cheqs.toString()); }}>
                              <Coins className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setWarningDialog(user)}>
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                            {user.status !== "banned" && (
                              <Button variant="destructive" size="sm" onClick={() => setBanDialog(user)}>
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin(currentUserRole) && (
                              <Button variant="destructive" size="sm" onClick={() => setDeleteDialog(user)} title="Delete User Permanently">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {userPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {userPage} of {userPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setUserPage((p) => Math.min(userPages, p + 1))} disabled={userPage === userPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BANS TAB */}
        <TabsContent value="bans">
          <Card>
            <CardHeader>
              <CardTitle>Active Bans</CardTitle>
              <CardDescription>Manage user bans</CardDescription>
            </CardHeader>
            <CardContent>
              {bans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No active bans</div>
              ) : (
                <div className="space-y-3">
                  {bans.map((ban) => (
                    <div key={ban.id} className="p-4 rounded-lg border">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ban.user.name || ban.user.email}</span>
                            <Badge variant="outline" className="bg-red-500/10 text-red-600">
                              {OFFENSE_LABELS[ban.offense as OffenseType] || ban.offense}
                            </Badge>
                            {ban.isActive ? <Badge className="bg-red-500">Active</Badge> : <Badge variant="outline">Revoked</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{ban.reason}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{getBanTimeRemaining(ban.endDate)}</span>
                            <span>By: {ban.issuedBy.name || ban.issuedBy.email}</span>
                          </div>
                        </div>
                        {ban.isActive && (
                          <Button variant="outline" size="sm" onClick={() => handleRevokeBan(ban.id)}>
                            <XCircle className="h-4 w-4 mr-2" />Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WARNINGS TAB */}
        <TabsContent value="warnings">
          <Card>
            <CardHeader>
              <CardTitle>User Warnings</CardTitle>
              <CardDescription>Track issued warnings</CardDescription>
            </CardHeader>
            <CardContent>
              {warnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No warnings issued</div>
              ) : (
                <div className="space-y-3">
                  {warnings.map((warning) => (
                    <div key={warning.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{warning.user.name || warning.user.email}</span>
                            <Badge variant="outline">{WARNING_LABELS[warning.type as WarningType]}</Badge>
                            <Badge variant="outline">Severity: {warning.severity}/5</Badge>
                            {warning.acknowledged && <Badge className="bg-green-500">Acknowledged</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{warning.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Issued by {warning.issuedBy.name || warning.issuedBy.email} on {formatModDate(warning.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <Select value={reportStatusFilter} onValueChange={setReportStatusFilter}>
                <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>User Reports</CardTitle>
              <CardDescription>Community-submitted reports</CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No reports to review</div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 rounded-lg border cursor-pointer hover:bg-accent/50" onClick={() => setReportDialog(report)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Report: {report.reportedUser.name || report.reportedUser.email}</span>
                            <Badge variant="outline" className={getPriorityColor(report.priority)}>
                              {PRIORITY_LABELS[report.priority as keyof typeof PRIORITY_LABELS]}
                            </Badge>
                            <Badge variant="outline">{REPORT_STATUS_LABELS[report.status as keyof typeof REPORT_STATUS_LABELS]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{report.reason}: {report.description.substring(0, 100)}...</p>
                          <p className="text-xs text-muted-foreground mt-1">From: {report.reporter.email} • {formatModDate(report.createdAt)}</p>
                        </div>
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANNOUNCEMENTS TAB */}
        <TabsContent value="announcements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>System Announcements</CardTitle>
                <CardDescription>Manage announcements visible to users</CardDescription>
              </div>
              {canManageAnnouncements && (
                <Button onClick={() => setAnnouncementDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />New Announcement
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No announcements</div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        {ann.isPinned && <Pin className="h-4 w-4 text-amber-500" />}
                        <span className="font-medium">{ann.title}</span>
                        <Badge variant="outline">{ann.type}</Badge>
                        {ann.isActive ? <Badge className="bg-green-500">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{ann.content.substring(0, 200)}...</p>
                      <p className="text-xs text-muted-foreground mt-2">Target: {ann.targetRoles.join(", ")} • {formatModDate(ann.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIONS LOG TAB */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Action Log</CardTitle>
              <CardDescription>Complete audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No actions recorded</div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <div key={action.id} className="p-4 rounded-lg border">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{ACTION_LABELS[action.action as keyof typeof ACTION_LABELS] || action.action}</Badge>
                            <span className="text-sm">on</span>
                            <span className="font-medium">{action.targetUser.name || action.targetUser.email}</span>
                          </div>
                          {action.previousValue && action.newValue && (
                            <p className="text-sm text-muted-foreground">
                              Changed: <span className="font-medium">{action.previousValue}</span> → <span className="font-medium">{action.newValue}</span>
                            </p>
                          )}
                          {action.reason && <p className="text-sm text-muted-foreground">Reason: {action.reason}</p>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>By: {action.performedBy.name || action.performedBy.email}</p>
                          <p>{formatModDate(action.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {actionPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setActionPage((p) => Math.max(1, p - 1))} disabled={actionPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {actionPage} of {actionPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setActionPage((p) => Math.min(actionPages, p + 1))} disabled={actionPage === actionPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS TAB (Admin+ only) */}
        {canAccessPayments && (
          <TabsContent value="payments">
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-10 w-10 text-green-500" />
                    <div>
                      <p className="text-3xl font-bold">${paymentTotals?.totalRevenue?.toFixed(2) || "0.00"}</p>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-10 w-10 text-blue-500" />
                    <div>
                      <p className="text-3xl font-bold">{paymentTotals?.totalTransactions || 0}</p>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No payments yet</div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="p-4 rounded-lg border flex items-center justify-between">
                        <div>
                          <p className="font-medium">{payment.user.name || payment.user.email}</p>
                          <p className="text-sm text-muted-foreground">{payment.type} • {formatModDate(payment.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-500">${payment.amount.toFixed(2)} {payment.currency}</p>
                          <Badge variant="outline" className={payment.status === "completed" ? "bg-green-500/10 text-green-600" : ""}>
                            {payment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* SETTINGS TAB (Admin+ only) */}
        {canAccessSettings && settings && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure application settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Site Name</Label>
                    <Input value={settings.siteName} onChange={(e) => handleUpdateSettings("siteName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cheqs Per Dollar</Label>
                    <Input type="number" inputMode="numeric" value={settings.cheqsPerDollar} onChange={(e) => handleUpdateSettings("cheqsPerDollar", parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Free Premium Actions / Month</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={settings.premiumTrialMonthlyActionLimit}
                      onChange={(e) =>
                        handleUpdateSettings(
                          "premiumTrialMonthlyActionLimit",
                          Math.max(0, parseInt(e.target.value || "0", 10))
                        )
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Maintenance Mode</p>
                    <p className="text-sm text-muted-foreground">Disable access for regular users</p>
                  </div>
                  <Switch checked={settings.maintenanceMode} onCheckedChange={(v) => handleUpdateSettings("maintenanceMode", v)} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Allow New Registrations</p>
                    <p className="text-sm text-muted-foreground">Enable user signups</p>
                  </div>
                  <Switch checked={settings.registrationEnabled} onCheckedChange={(v) => handleUpdateSettings("registrationEnabled", v)} />
                </div>
                {isOwner(currentUserRole) && (
                  <>
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-4 flex items-center gap-2"><Lock className="h-4 w-4" />Payment Settings (Owner Only)</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>E-Transfer Email</Label>
                          <Input value={settings.paymentEmail || ""} onChange={(e) => handleUpdateSettings("paymentEmail", e.target.value)} placeholder="email@example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label>E-Transfer Phone</Label>
                          <Input value={settings.paymentPhone || ""} onChange={(e) => handleUpdateSettings("paymentPhone", e.target.value)} placeholder="+1234567890" />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div className="space-y-2">
                          <Label>Premium Monthly Price (CAD)</Label>
                          <Input type="number" inputMode="decimal" step="0.01" min="0" value={settings.premiumPrice} onChange={(e) => handleUpdateSettings("premiumPrice", parseFloat(e.target.value))} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border mt-4">
                        <div>
                          <p className="font-medium">Enable Stripe Payments</p>
                          <p className="text-sm text-muted-foreground">Allow users to make payments via Stripe</p>
                        </div>
                        <Switch checked={settings.stripeEnabled} onCheckedChange={(v) => handleUpdateSettings("stripeEnabled", v)} />
                      </div>
                    </div>

                    {/* STRIPE API CONFIGURATION */}
                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4" />Stripe API Configuration</h3>

                      {/* Connection status */}
                      {stripeConfig && (
                        <div className={`flex items-center gap-3 p-4 rounded-lg border mb-4 ${stripeConfig.isConnected ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                          <div className={`h-3 w-3 rounded-full ${stripeConfig.isConnected ? "bg-green-500" : "bg-yellow-500"}`} />
                          <div className="flex-1">
                            <p className="font-medium">{stripeConfig.isConnected ? "Stripe Connected" : "Stripe Not Fully Connected"}</p>
                            <p className="text-sm text-muted-foreground">
                              {stripeConfig.isConnected
                                ? `Keys configured${!stripeConfig.hasWebhookSecret ? " — webhook secret missing (webhooks won't verify)" : ""}`
                                : "Add your Stripe API keys below to enable payments"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleTestStripeConnection}
                            disabled={stripeTesting || !stripeConfig.hasSecretKey}
                          >
                            {stripeTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                            <span className="ml-1.5">{stripeTesting ? "Testing..." : "Test"}</span>
                          </Button>
                        </div>
                      )}

                      {/* Test result */}
                      {stripeTestResult && (
                        <div className={`p-3 rounded-lg border mb-4 text-sm ${stripeTestResult.connected ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                          {stripeTestResult.connected ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span>Connected to <strong>{stripeTestResult.businessName}</strong> ({stripeTestResult.accountId}) — {stripeTestResult.livemode ? "🟢 Live Mode" : "🟡 Test Mode"} — {stripeTestResult.currency?.toUpperCase()}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span>Connection failed: {stripeTestResult.error}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Key fields */}
                      <div className="space-y-3">
                        {(["publishableKey", "secretKey", "webhookSecret"] as const).map((field) => {
                          const labels: Record<string, string> = { publishableKey: "Publishable Key", secretKey: "Secret Key", webhookSecret: "Webhook Secret" };
                          const prefixes: Record<string, string> = { publishableKey: "pk_", secretKey: "sk_", webhookSecret: "whsec_" };
                          const hasKeyMap: Record<string, boolean> = stripeConfig ? { publishableKey: stripeConfig.hasPublishableKey, secretKey: stripeConfig.hasSecretKey, webhookSecret: stripeConfig.hasWebhookSecret } : {};
                          const hasKey = hasKeyMap[field] || false;
                          const maskedValue = stripeConfig ? stripeConfig[field as keyof StripeConfigData] as string : "";
                          const isEditing = stripeEditing === field;

                          return (
                            <div key={field} className="p-3 rounded-lg border space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm font-medium">{labels[field]}</Label>
                                  {hasKey ? (
                                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">Configured</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-600">Missing</Badge>
                                  )}
                                </div>
                                {!isEditing && (
                                  <Button size="sm" variant="ghost" onClick={() => { setStripeEditing(field); setStripeKeyForm(prev => ({ ...prev, [field]: "" })); }}>
                                    <Edit className="h-3.5 w-3.5 mr-1" />{hasKey ? "Update" : "Add"}
                                  </Button>
                                )}
                              </div>
                              {hasKey && !isEditing && (
                                <p className="text-xs text-muted-foreground font-mono">{maskedValue}</p>
                              )}
                              {isEditing && (
                                <div className="flex gap-2">
                                  <Input
                                    type="password"
                                    placeholder={`Paste your ${prefixes[field]}... key`}
                                    value={stripeKeyForm[field]}
                                    onChange={(e) => setStripeKeyForm(prev => ({ ...prev, [field]: e.target.value }))}
                                    className="font-mono text-sm"
                                  />
                                  <Button size="sm" onClick={() => handleSaveStripeKey(field)} disabled={stripeSaving || !stripeKeyForm[field].trim()}>
                                    {stripeSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save"}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setStripeEditing(null)}>Cancel</Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Webhook URL */}
                      {stripeConfig?.webhookUrl && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                          <Label className="text-sm font-medium">Webhook Endpoint URL</Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-2">Add this URL in your Stripe Dashboard → Developers → Webhooks</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-background p-2 rounded border font-mono break-all">{stripeConfig.webhookUrl}</code>
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(stripeConfig.webhookUrl || ""); toast({ title: "Copied!" }); }}>
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">Events to listen for: <code className="text-xs">checkout.session.completed</code>, <code className="text-xs">payment_intent.payment_failed</code></p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* EDIT USER DIALOG */}
      <Dialog open={!!editDialog.type} onOpenChange={() => setEditDialog({ type: null, user: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editDialog.type}</DialogTitle>
            <DialogDescription>Update {editDialog.user?.name || editDialog.user?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editDialog.type === "role" && (
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getAssignableRoles(currentUserRole).map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {editDialog.type === "status" && (
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            )}
            {editDialog.type === "cheqs" && (
              <Input type="number" inputMode="numeric" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            )}
            <Textarea placeholder="Reason (optional)" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ type: null, user: null })}>Cancel</Button>
            <Button onClick={handleEditUser}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BAN DIALOG */}
      <Dialog open={!!banDialog} onOpenChange={() => setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-red-500" />Issue Ban</DialogTitle>
            <DialogDescription>Ban {banDialog?.name || banDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={banForm.offense} onValueChange={(v) => setBanForm({ ...banForm, offense: v as OffenseType })}>
              <SelectTrigger><SelectValue placeholder="Offense Type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(OFFENSE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={banForm.duration} onValueChange={(v) => setBanForm({ ...banForm, duration: v })}>
              <SelectTrigger><SelectValue placeholder="Duration" /></SelectTrigger>
              <SelectContent>
                {BAN_DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Reason *" value={banForm.reason} onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })} />
            <Textarea placeholder="Evidence (optional)" value={banForm.evidence} onChange={(e) => setBanForm({ ...banForm, evidence: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleIssueBan} disabled={!banForm.reason}>Issue Ban</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE USER DIALOG (Admin Only) */}
      <Dialog open={!!deleteDialog} onOpenChange={() => { setDeleteDialog(null); setDeleteReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" />Delete User Permanently</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteDialog?.name || deleteDialog?.email}</strong> and all their associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
              <strong>Warning:</strong> This will delete all user data including cheqs, bans, warnings, notes, reports, and action history.
            </div>
            <div>
              <Label>Reason for deletion *</Label>
              <Textarea placeholder="Why is this user being deleted?" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialog(null); setDeleteReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={!deleteReason.trim()}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WARNING DIALOG */}
      <Dialog open={!!warningDialog} onOpenChange={() => setWarningDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Issue Warning</DialogTitle>
            <DialogDescription>Warn {warningDialog?.name || warningDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={warningForm.type} onValueChange={(v) => setWarningForm({ ...warningForm, type: v as WarningType })}>
              <SelectTrigger><SelectValue placeholder="Warning Type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(WARNING_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warningForm.severity.toString()} onValueChange={(v) => setWarningForm({ ...warningForm, severity: parseInt(v) })}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                {WARNING_SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Reason *" value={warningForm.reason} onChange={(e) => setWarningForm({ ...warningForm, reason: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialog(null)}>Cancel</Button>
            <Button onClick={handleIssueWarning} disabled={!warningForm.reason}>Issue Warning</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REPORT REVIEW DIALOG */}
      <Dialog open={!!reportDialog} onOpenChange={() => setReportDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          {reportDialog && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium">Reported User: {reportDialog.reportedUser.name || reportDialog.reportedUser.email}</p>
                <p className="text-sm text-muted-foreground">Role: {reportDialog.reportedUser.role}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="font-medium">{reportDialog.reason}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{reportDialog.description}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Reported By</Label>
                <p>{reportDialog.reporter.name || reportDialog.reporter.email}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleUpdateReport("dismissed")}>Dismiss</Button>
            <Button variant="outline" onClick={() => handleUpdateReport("reviewing")}>Mark Reviewing</Button>
            <Button onClick={() => handleUpdateReport("resolved", "Reviewed and action taken if necessary")}>Resolve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ANNOUNCEMENT DIALOG */}
      <Dialog open={announcementDialog} onOpenChange={setAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title *" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
            <Textarea placeholder="Content *" rows={4} value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} />
            <Select value={announcementForm.type} onValueChange={(v) => setAnnouncementForm({ ...announcementForm, type: v })}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="danger">Danger</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={announcementForm.isPinned} onCheckedChange={(v) => setAnnouncementForm({ ...announcementForm, isPinned: v })} />
              <Label>Pin to top</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateAnnouncement} disabled={!announcementForm.title || !announcementForm.content}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
