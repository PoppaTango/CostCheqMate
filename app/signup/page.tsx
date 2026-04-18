import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppLogo } from "@/components/app-logo";
import SignupForm from "./_components/signup-form";

export const metadata: Metadata = {
  title: "Sign Up Free",
  description: "Create a free Cost CheqMate account. AI-powered receipt scanning, budget tracking, and pay period management — start in under a minute.",
};

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/50 to-purple-50/50 dark:from-[#0a0f1a] dark:via-[#0d1425] dark:to-[#0f0d1a] flex flex-col items-center justify-center p-4 relative">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl" />
      </div>
      
      <div className="mb-8 text-center relative z-10">
        <div className="flex items-center justify-center gap-4 mb-3">
          <AppLogo size="md" className="w-20 h-20 rounded-2xl neon-glow shadow-xl" priority />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 via-primary to-purple-500 bg-clip-text text-transparent">
          Cost CheqMate
        </h1>
        <p className="text-muted-foreground mt-1">Expense tracking for individuals &amp; businesses</p>
      </div>
      <SignupForm />
    </div>
  );
}
