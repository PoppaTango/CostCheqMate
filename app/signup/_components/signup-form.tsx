"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mail, Lock, User, Loader2, UserPlus, AlertCircle } from "lucide-react";

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  // Honeypot field for bot detection - hidden from users, bots fill it
  const [honeypot, setHoneypot] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, honeypot }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Auto sign in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but failed to sign in. Please go to login.");
      } else {
        router.replace("/dashboard");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  return (
    <TooltipProvider>
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 dark:bg-[#0f1629]/90 backdrop-blur-xl relative z-10">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />
        <CardHeader className="text-center space-y-2 relative">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Start tracking your expenses today</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field - hidden from humans, bots fill it */}
            <div className="absolute -left-[9999px] opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
              <label htmlFor="website_url">Website (leave blank)</label>
              <input
                type="text"
                id="website_url"
                name="website_url"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Your display name (optional)</TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Enter your email address</TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>At least 6 characters</TooltipContent>
              </Tooltip>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 border-border/50 focus:border-primary focus:ring-primary/20"
                      required
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Re-enter your password</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" className="w-full neon-glow-hover transition-all" size="lg" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-5 w-5 mr-2" />
                  )}
                  Create Account
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create your account with email and password</TooltipContent>
            </Tooltip>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-[#0f1629] px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign up with your Google account</TooltipContent>
          </Tooltip>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
