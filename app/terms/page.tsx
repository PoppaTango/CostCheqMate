import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Cost CheqMate — the rules and conditions for using our expense tracking application.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 12, 2026</p>

        <div className="space-y-8 text-[15px]">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Cost CheqMate (&quot;the App&quot;), operated by Imperial Solutions (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate is a personal and business finance management tool that helps users track expenses, manage budgets, scan receipts using AI-powered OCR, generate reports, and organize financial documents via cloud storage integrations. The App is available in free, premium, and business tiers with varying feature sets.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Account Registration</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must be at least 16 years of age to use Cost CheqMate.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. User Content &amp; Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of all data and content you submit to Cost CheqMate, including expense records, receipt images, categories, and financial settings. By using the App, you grant us a limited, non-exclusive license to process, store, and display your content solely for the purpose of providing our services.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              You are solely responsible for the accuracy of the financial data you enter. Cost CheqMate does not provide financial advice, tax guidance, or accounting services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Subscriptions &amp; Payments</h2>
            <h3 className="font-medium mt-4 mb-1.5">5.1 Free Tier</h3>
            <p className="text-muted-foreground leading-relaxed">
              The free tier provides access to core features including expense tracking, receipt scanning, budget management, and basic reporting.
            </p>
            <h3 className="font-medium mt-4 mb-1.5">5.2 Premium &amp; Business Tiers</h3>
            <p className="text-muted-foreground leading-relaxed">
              Premium and business subscriptions are billed monthly. Payments are processed securely through Stripe. Subscription details and pricing are displayed at the time of purchase.
            </p>
            <h3 className="font-medium mt-4 mb-1.5">5.3 Cheqs Rewards</h3>
            <p className="text-muted-foreground leading-relaxed">
              &quot;Cheqs&quot; are in-app reward points earned through usage. Cheqs can be redeemed for premium access but have no cash value and cannot be transferred, sold, or exchanged outside the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Cloud Storage Integration</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate offers optional integration with Google Drive and OneDrive. By connecting your cloud storage:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mt-2">
              <li>You authorize us to create folders and upload receipt files on your behalf.</li>
              <li>We only access files and folders created by Cost CheqMate.</li>
              <li>You may disconnect your cloud storage at any time from Settings.</li>
              <li>We are not responsible for data loss or unavailability caused by third-party cloud providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mt-2">
              <li>Use the App for any unlawful purpose or to violate any laws.</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or data.</li>
              <li>Upload malicious content, viruses, or harmful code.</li>
              <li>Abuse, harass, or threaten other users.</li>
              <li>Reverse-engineer, decompile, or attempt to extract the source code of the App.</li>
              <li>Use automated tools (bots, scrapers) to access the App without authorization.</li>
              <li>Circumvent or manipulate the Cheqs rewards system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. AI &amp; OCR Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate uses AI-powered optical character recognition (OCR) to extract data from receipt images. While we strive for accuracy, AI-extracted data may contain errors. You are responsible for reviewing and verifying all extracted information before saving expense records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cost CheqMate is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground mt-2">
              <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages.</li>
              <li>We are not responsible for financial decisions made based on data in the App.</li>
              <li>We are not liable for loss of data, revenue, or profits arising from your use of the App.</li>
              <li>Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may suspend or terminate your access to Cost CheqMate at any time, with or without cause, including for violations of these Terms. Upon termination, your right to use the App ceases immediately. You may also delete your account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be posted on this page with an updated &quot;Last updated&quot; date. Your continued use of Cost CheqMate after changes are posted constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Imperial Solutions operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Imperial Solutions</strong><br />
              Email: <a href="mailto:legal@costcheqmate.com" className="text-primary hover:underline">legal@costcheqmate.com</a>
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
