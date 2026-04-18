"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import {
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Scan,
  Shield,
  Zap,
  CloudUpload,
  Building2,
  CreditCard,
  Calendar,
  TrendingUp,
  Users,
  Receipt,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Brand icons                                                         */
/* ------------------------------------------------------------------ */
function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat counter pill                                                  */
/* ------------------------------------------------------------------ */
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
        {value}
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card with image                                            */
/* ------------------------------------------------------------------ */
function FeatureCard({
  image,
  icon: Icon,
  title,
  desc,
  color,
  bg,
  brandIcons,
}: {
  image: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  bg: string;
  brandIcons?: ("google" | "microsoft")[];
}) {
  return (
    <div className="group relative rounded-2xl border border-border/50 bg-card overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all">
      {/* Image */}
      <div className="relative aspect-[16/10] bg-muted">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {/* Icon badge */}
        <div className={`absolute bottom-3 left-3 w-9 h-9 rounded-lg ${bg} backdrop-blur-sm flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      {/* Text */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-semibold text-lg">{title}</h3>
          {brandIcons && (
            <div className="flex items-center gap-1">
              {brandIcons.includes("google") && <GoogleIcon className="h-4 w-4" />}
              {brandIcons.includes("microsoft") && <MicrosoftIcon className="h-4 w-4" />}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main About / Landing Page                                          */
/* ------------------------------------------------------------------ */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0c1424] to-[#130d20] dark:opacity-100 opacity-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-cyan-50/20 to-purple-50/20 dark:opacity-0 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Zap className="h-3.5 w-3.5" />
                AI-Powered Expense Intelligence
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight mb-6">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
                  Expense Tracking
                </span>
                <br />
                <span className="text-foreground">Built for How You Actually Get Paid</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Cost CheqMate aligns your budgets with your pay periods — not arbitrary calendar months.
                Scan receipts with AI, automate bank allocations, and keep every dollar accounted for,
                whether you&apos;re a freelancer or managing a team of 50.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup">
                  <Button size="lg" className="neon-glow w-full sm:w-auto text-base">
                    Start Free Today
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                    See Features
                  </Button>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-6 mt-10 pt-8 border-t border-border/40">
                <StatPill value="10 sec" label="Avg. Receipt Scan" />
                <StatPill value="100%" label="Free Core Features" />
                <StatPill value="256-bit" label="Bank-Grade Encryption" />
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                <Image
                  src="/images/about/hero-dashboard.jpg"
                  alt="Modern workspace with financial dashboard showing expense analytics and budget tracking"
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-background/95 backdrop-blur-xl border border-border/60 rounded-xl p-4 shadow-xl max-w-[200px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Receipt Scanned</p>
                    <p className="text-xs text-muted-foreground">$42.87 · Groceries</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ────────────────────────────────────── */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Receipt className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">AI-powered receipt OCR</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">Enterprise-grade security</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <GoogleIcon className="h-4 w-4 flex-shrink-0" />
              <MicrosoftIcon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Google Drive & OneDrive sync</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">Built for individuals & businesses</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES WITH IMAGES ────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Master Your Finances</h2>
            <p className="text-muted-foreground text-lg">
              From receipt scanning to pay-period budgets, Cost CheqMate gives individuals and
              businesses the visibility they need to stay on track.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              image="/images/about/feature-scanning.jpg"
              icon={Scan}
              title="Smart Receipt Scanning"
              desc="Point your camera at any receipt. Our vision AI extracts merchant, amount, date, and category in seconds — no manual entry."
              color="text-cyan-400"
              bg="bg-cyan-500/20"
            />
            <FeatureCard
              image="/images/about/feature-calendar.jpg"
              icon={Calendar}
              title="Pay Period Budgets"
              desc="Budget around your actual pay schedule — weekly, bi-weekly, semi-monthly, or monthly. See exactly what you can spend each cycle."
              color="text-blue-400"
              bg="bg-blue-500/20"
            />
            <FeatureCard
              image="/images/about/feature-bank.jpg"
              icon={Building2}
              title="Bank Account Allocations"
              desc="Link categories to bank accounts and know exactly how much to transfer each payday — savings, debt paydown, or business expenses."
              color="text-purple-400"
              bg="bg-purple-500/20"
            />
            <FeatureCard
              image="/images/about/feature-budget.jpg"
              icon={BarChart3}
              title="Real-Time Analytics"
              desc="Interactive charts show spending by category, trends over time, and budget utilization — all updating as you scan receipts."
              color="text-rose-400"
              bg="bg-rose-500/20"
            />
            <FeatureCard
              image="/images/about/feature-cloud.jpg"
              icon={CloudUpload}
              title="Cloud Receipt Backup"
              desc="Automatically sync scanned receipts as organized PDFs to Google Drive or OneDrive — perfect for tax season and audits."
              brandIcons={["google", "microsoft"]}
              color="text-indigo-400"
              bg="bg-indigo-500/20"
            />
            <FeatureCard
              image="/images/about/feature-income.jpg"
              icon={TrendingUp}
              title="Additional Income Tracking"
              desc="Log e-transfers, cash payments, side hustles, and reimbursements alongside your regular pay for the complete financial picture."
              color="text-amber-400"
              bg="bg-amber-500/20"
            />
          </div>
        </div>
      </section>

      {/* ── SCANNING SHOWCASE ────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden shadow-xl ring-1 ring-border/30 order-2 lg:order-1">
              <Image
                src="/images/about/mobile-scanning.jpg"
                alt="Person scanning a receipt with a smartphone using Cost CheqMate AI-powered receipt scanning"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Receipt Intelligence</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Snap. Scan. Done.</h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Our AI vision model reads any receipt in seconds — printed, handwritten, or faded.
                It auto-fills the merchant, total, date, and even suggests the right budget category
                based on your spending history.
              </p>
              <ul className="space-y-4">
                {[
                  "Works with photos, PDFs, and camera capture",
                  "Smart category prediction learns your habits",
                  "Receipts auto-saved to cloud storage as organized PDFs",
                  "Edit any field before saving — you stay in control",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Get Started</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Up and Running in 3 Minutes</h2>
            <p className="text-muted-foreground text-lg">
              No credit card required. Set up your pay schedule, create budget categories, and start scanning receipts immediately.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: CreditCard,
                title: "Configure Your Pay",
                desc: "Enter your net pay, frequency, and first pay date. Cost CheqMate automatically builds your pay period calendar.",
              },
              {
                step: "02",
                icon: BarChart3,
                title: "Set Budget Categories",
                desc: "Create categories like Groceries, Rent, Gas — each with an annual budget. Link them to bank accounts for automatic allocation.",
              },
              {
                step: "03",
                icon: Scan,
                title: "Scan & Track",
                desc: "Photograph receipts, and our AI handles the rest. Watch your budgets update in real-time as you spend.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <span className="text-7xl font-black text-primary/10 absolute -top-6 -left-2 select-none">
                  {s.step}
                </span>
                <div className="relative bg-card border border-border/50 rounded-2xl p-6 pt-10 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <s.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR BUSINESS ─────────────────────────────────────────── */}
      <section id="business" className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-500 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Building2 className="h-3.5 w-3.5" />
                For Business
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Expense Management That Scales With Your Business
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Whether you&apos;re a sole proprietor tracking deductibles or a growing team
                managing project expenses, Cost CheqMate gives you audit-ready records
                without the complexity of enterprise software.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: Receipt,
                    title: "Tax-Ready Receipt Archive",
                    desc: "Every scanned receipt is stored as a dated, categorized PDF — ready for your accountant or CRA audit.",
                  },
                  {
                    icon: Users,
                    title: "Multi-Account Tracking",
                    desc: "Separate personal, business, and project expenses with dedicated bank account allocations.",
                  },
                  {
                    icon: CloudUpload,
                    title: "Automated Cloud Backup",
                    desc: "Receipts auto-sync to Google Drive or OneDrive organized by year and category — no more shoebox filing.",
                    brands: ["google", "microsoft"] as ("google" | "microsoft")[],
                  },
                  {
                    icon: BarChart3,
                    title: "Spending Insights & Reports",
                    desc: "Visual analytics by category, pay period, and trend — export data anytime for bookkeeping.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{item.title}</h4>
                        {"brands" in item && item.brands && (
                          <div className="flex items-center gap-1">
                            {(item.brands as ("google" | "microsoft")[]).includes("google") && <GoogleIcon className="h-4 w-4" />}
                            {(item.brands as ("google" | "microsoft")[]).includes("microsoft") && <MicrosoftIcon className="h-4 w-4" />}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business images */}
            <div className="space-y-6">
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden shadow-xl ring-1 ring-border/30">
                <Image
                  src="/images/about/business-team.jpg"
                  alt="Business team reviewing financial reports and expense data in a modern conference room"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg ring-1 ring-border/30">
                  <Image
                    src="/images/about/expense-reports.jpg"
                    alt="Organized desk with receipts, calculator, and laptop showing expense reports"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                </div>
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg ring-1 ring-border/30">
                  <Image
                    src="/images/about/small-business.jpg"
                    alt="Small business owner using tablet to manage finances and track expenses"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE ───────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl ring-1 ring-border/30">
              <Image
                src="/images/about/hero-receipt.jpg"
                alt="Professional reviewing and scanning receipt documents with digital tools"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Why Cost CheqMate</p>
              <h2 className="text-3xl sm:text-4xl font-bold mb-8">Designed for Real-World Finances</h2>
              <div className="space-y-6">
                {[
                  {
                    icon: Zap,
                    title: "Lightning-Fast AI OCR",
                    desc: "Receipt scanning takes seconds, not minutes. Our vision model handles blurry, faded, and handwritten receipts.",
                  },
                  {
                    icon: Calendar,
                    title: "Pay-Period First",
                    desc: "Most apps force monthly budgets. Cost CheqMate works around your actual pay schedule — weekly, bi-weekly, or custom.",
                  },
                  {
                    icon: Shield,
                    title: "Secure & Private",
                    desc: "256-bit encryption, Google SSO authentication, and your data is never shared with third parties.",
                    brands: ["google"] as ("google" | "microsoft")[],
                  },
                  {
                    icon: Building2,
                    title: "Personal & Business",
                    desc: "Manage personal budgets and business expenses in one place with separate bank account allocations.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{item.title}</h4>
                        {"brands" in item && item.brands && (
                          <div className="flex items-center gap-1">
                            {(item.brands as ("google" | "microsoft")[]).includes("google") && <GoogleIcon className="h-4 w-4" />}
                            {(item.brands as ("google" | "microsoft")[]).includes("microsoft") && <MicrosoftIcon className="h-4 w-4" />}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-cyan-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Take Control of Your Expenses?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join professionals and businesses who have transformed their
            financial habits with Cost CheqMate. Free to start — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="neon-glow w-full sm:w-auto text-base">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                Sign In
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Integrations */}
          <div className="mt-12 pt-8 border-t border-border/40">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Integrates with</p>
            <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GoogleIcon className="h-6 w-6" />
                <span className="text-sm font-medium">Google</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MicrosoftIcon className="h-6 w-6" />
                <span className="text-sm font-medium">Microsoft</span>
              </div>
            </div>
          </div>

          {/* Company attribution */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <p className="text-sm text-muted-foreground">
              An <span className="font-semibold text-foreground">Imperial Solutions</span> product
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Building intelligent financial tools for individuals and businesses
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
