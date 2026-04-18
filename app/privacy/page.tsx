import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Cost CheqMate — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 12, 2026</p>

        <div className="space-y-8 text-[15px]">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate (&quot;we&quot;, &quot;our&quot;, or &quot;the App&quot;) is operated by Imperial Solutions. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application. Please read this policy carefully. By using Cost CheqMate, you consent to the practices described herein.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
            <h3 className="font-medium mt-4 mb-1.5">2.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect your name, email address, and (if using email/password signup) a hashed version of your password. If you sign in via Google SSO, we receive your Google profile name, email, and profile image URL.
            </p>
            <h3 className="font-medium mt-4 mb-1.5">2.2 Financial Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may voluntarily enter expense details, income settings, budget categories, and bank account names. Receipt images you upload are processed via AI-powered OCR to extract merchant names, amounts, and dates. We store this data to provide our services.
            </p>
            <h3 className="font-medium mt-4 mb-1.5">2.3 Cloud Storage Connections</h3>
            <p className="text-muted-foreground leading-relaxed">
              If you choose to connect Google Drive or OneDrive, we store OAuth tokens necessary to upload receipt files on your behalf. We only access folders and files created by the App — we do not read, modify, or delete any other files in your cloud storage.
            </p>
            <h3 className="font-medium mt-4 mb-1.5">2.4 Automatically Collected Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may collect standard log data such as your IP address, browser type, device type, and pages visited. This is used for security, analytics, and improving the user experience.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>To provide, maintain, and improve Cost CheqMate&apos;s features and services.</li>
              <li>To process and display your expenses, budgets, and reports.</li>
              <li>To perform OCR on uploaded receipts and extract expense data.</li>
              <li>To upload receipt files to your connected cloud storage accounts.</li>
              <li>To manage your account and subscriptions (free, premium, or business tiers).</li>
              <li>To send important account-related notifications (e.g., security alerts).</li>
              <li>To detect and prevent fraud, abuse, or unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Data Sharing &amp; Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do <strong>not</strong> sell, rent, or trade your personal information to third parties. We may share data only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mt-2">
              <li><strong>Service Providers:</strong> We use third-party services (e.g., cloud hosting, payment processing via Stripe, AI/OCR processing) that may process your data on our behalf under strict confidentiality agreements.</li>
              <li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process, we may disclose information to comply with applicable obligations.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Data Storage &amp; Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on secure servers. Passwords are hashed using bcrypt. OAuth tokens for cloud storage are encrypted at rest. We use HTTPS for all communications. While we implement reasonable security measures, no system is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide our services. If you delete your account, we will remove your personal data within a reasonable timeframe, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Withdraw consent for data processing.</li>
              <li>Export your data in a portable format.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              To exercise any of these rights, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate uses essential cookies for authentication (session tokens) and theme preferences. We do not use third-party tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate is not intended for individuals under the age of 16. We do not knowingly collect personal information from children. If we learn that we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &quot;Last updated&quot; date. Your continued use of Cost CheqMate after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Imperial Solutions</strong><br />
              Email: <a href="mailto:privacy@costcheqmate.com" className="text-primary hover:underline">privacy@costcheqmate.com</a>
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
