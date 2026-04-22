import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import ResetPasswordForm from "./_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your Cost CheqMate password securely.",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/50 to-purple-50/50 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a] flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="mb-8 text-center relative z-10">
        <Link href="/login" className="flex items-center justify-center gap-4 mb-3 hover:opacity-90 transition-opacity">
          <AppLogo size="md" className="w-20 h-20 rounded-2xl neon-glow shadow-xl" priority />
        </Link>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 via-primary to-purple-500 bg-clip-text text-transparent">
          Cost CheqMate
        </h1>
        <p className="text-muted-foreground mt-1">Choose a new password</p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
