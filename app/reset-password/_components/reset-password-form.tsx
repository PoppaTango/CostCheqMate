"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Missing reset token. Use the full link from your email.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Failed to reset password.");
        return;
      }
      setSuccess("Password reset successful. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 dark:bg-[#0f1629]/90 backdrop-blur-xl relative z-10">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
      <CardHeader className="text-center space-y-2 relative">
        <CardTitle className="text-2xl">Set New Password</CardTitle>
        <CardDescription>Choose a new password for your account</CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {error ? (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setNewPassword(event.target.value)
                }
                className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setConfirmPassword(event.target.value)
                }
                className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full neon-glow-hover transition-all" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            {loading ? "Saving..." : "Reset Password"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Back to{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
            Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
