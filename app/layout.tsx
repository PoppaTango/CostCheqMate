import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXTAUTH_URL || "https://costcheqmate.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cost CheqMate \u2013 AI Expense Tracker & Budget Planner",
    template: "%s | Cost CheqMate",
  },
  description:
    "Free AI-powered expense tracker and budget planner. Scan receipts, manage budgets by pay period, track bank allocations, and sync to OneDrive & Google Drive.",
  keywords: [
    "expense tracker",
    "budget planner",
    "receipt scanner",
    "AI expense tracker",
    "personal finance app",
    "money management",
    "budget tracking",
    "pay period tracker",
    "small business expense tracker",
  ],
  authors: [{ name: "Cost CheqMate" }],
  creator: "Cost CheqMate",
  publisher: "Cost CheqMate",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Cost CheqMate",
    title: "Cost CheqMate \u2013 AI Expense Tracker & Budget Planner",
    description:
      "Free AI-powered expense tracker. Scan receipts, manage budgets by pay period, track bank allocations, and export financial reports.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cost CheqMate - AI Expense Tracker & Budget Planner",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cost CheqMate \u2013 AI Expense Tracker & Budget Planner",
    description:
      "Free AI-powered expense tracker. Scan receipts, manage budgets, and take control of your finances.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      "msvalidate.01": process.env.BING_SITE_VERIFICATION || "",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9734496439434658"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebApplication",
                  "name": "Cost CheqMate",
                  "url": siteUrl,
                  "description": "Free AI-powered expense tracker and budget planner. Scan receipts with AI, manage budgets by pay period, track bank allocations, and sync receipts to OneDrive & Google Drive.",
                  "applicationCategory": "FinanceApplication",
                  "operatingSystem": "Web",
                  "offers": [
                    {
                      "@type": "Offer",
                      "price": "0",
                      "priceCurrency": "USD",
                      "name": "Free Plan",
                      "description": "Core expense tracking, receipt scanning, budget management, and pay period reports."
                    },
                    {
                      "@type": "Offer",
                      "price": "1.99",
                      "priceCurrency": "USD",
                      "name": "Premium Plan",
                      "description": "Unlock cloud sync, advanced analytics, and additional features.",
                      "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "1.99",
                        "priceCurrency": "USD",
                        "billingDuration": "P1M"
                      }
                    },
                    {
                      "@type": "Offer",
                      "price": "9.99",
                      "priceCurrency": "USD",
                      "name": "Business Plan",
                      "description": "Excel/CSV export, custom branding, and everything in Premium.",
                      "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "9.99",
                        "priceCurrency": "USD",
                        "billingDuration": "P1M"
                      }
                    }
                  ],
                  "featureList": [
                    "AI receipt scanning with automatic data extraction",
                    "Budget management with annual category budgets",
                    "Pay period calendar with income and expense tracking",
                    "Bank account allocation tracking",
                    "OneDrive and Google Drive receipt backup",
                    "Additional income tracking (e-transfers, cash, side hustles)",
                    "Comprehensive spending reports and analytics",
                    "Excel and CSV expense report export",
                    "Custom business branding with logo upload",
                    "Multi-currency support"
                  ],
                  "screenshot": `${siteUrl}/og-image.png`
                },
                {
                  "@type": "Organization",
                  "name": "Cost CheqMate",
                  "url": siteUrl,
                  "logo": `${siteUrl}/logo-cropped.png`,
                  "description": "Cost CheqMate helps individuals and small businesses track expenses, manage budgets, and organize financial records with AI-powered tools."
                },
                {
                  "@type": "FAQPage",
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "What is Cost CheqMate?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Cost CheqMate is a free AI-powered expense tracker and budget planner. It lets you scan receipts with AI, manage budgets by pay period, allocate funds to bank accounts, and sync receipts to OneDrive or Google Drive."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "How does the AI receipt scanning work?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Simply photograph any receipt and Cost CheqMate's AI-powered OCR extracts the merchant name, amount, and date automatically. It also suggests the expense category based on your spending history."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Is Cost CheqMate free?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes! Cost CheqMate offers a free plan with core features including expense tracking, receipt scanning, budget management, and pay period reports. Premium ($1.99/month) and Business ($9.99/month) plans unlock additional features."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Can I export my expense data?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes, Business plan users can export expense data as CSV or JSON files for use in Excel, Google Sheets, or accounting software."
                      }
                    },
                    {
                      "@type": "Question",
                      "name": "Does Cost CheqMate work for small businesses?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Absolutely. Cost CheqMate's Business plan includes features tailored for small businesses: custom branding with your own logo, data export for bookkeeping, cloud receipt backup organized by category, and bank account allocation tracking."
                      }
                    }
                  ]
                }
              ]
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
