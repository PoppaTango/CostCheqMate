import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXTAUTH_URL || "https://costcheqmate.com";

export const metadata: Metadata = {
  title: "Cost CheqMate – Free AI Expense Tracker & Budget Planner App",
  description:
    "Cost CheqMate is a free AI-powered expense tracker and budget planner. Scan receipts with AI, manage budgets by pay period, track bank allocations, sync to OneDrive & Google Drive, and export reports. Perfect for personal finance and small business bookkeeping.",
  keywords: [
    "expense tracker",
    "budget planner",
    "receipt scanner app",
    "AI expense tracker",
    "personal finance app",
    "budget management tool",
    "pay period tracker",
    "bank allocation tracker",
    "small business expense tracker",
    "bookkeeping app",
    "money management app",
    "free expense tracker",
    "receipt scanning AI",
    "budget tracking app",
    "income tracker",
    "spending tracker",
    "financial planner",
    "OneDrive receipt backup",
    "Google Drive receipt sync",
    "expense report generator",
    "cost tracking app",
    "paycheque budget planner",
    "category budget tracker",
    "smart receipt scanner",
    "expense management",
  ],
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/about`,
    title: "Cost CheqMate – Free AI Expense Tracker & Budget Planner",
    description:
      "Scan receipts with AI, manage budgets by pay period, track bank allocations, and sync to the cloud. The smartest way to take control of your money.",
    siteName: "Cost CheqMate",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Cost CheqMate - AI Expense Tracker & Budget Planner",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cost CheqMate – Free AI Expense Tracker & Budget Planner",
    description:
      "Scan receipts with AI, manage budgets by pay period, and track bank allocations. Free personal finance app.",
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
