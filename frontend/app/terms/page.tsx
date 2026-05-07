// terms and conditions page — content ported verbatim from
// /Users/bluntbrain/Documents/code/ai-friend/NomiApp/LEGAL/terms-and-conditions.md
// (the source of truth for app store submission). do not divergence-edit;
// update the markdown first, then mirror here.
import type { Metadata } from "next";
import { Nav, Footer } from "../../components/site-chrome";

export const metadata: Metadata = {
  title: "Terms and Conditions — NOMI",
  description:
    "Terms governing the NOMI mobile Solana dApp. All blockchain transactions are final.",
};

export default function Terms() {
  return (
    <main className="min-h-screen bg-pet-bg text-pet-ink">
      <Nav />
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Terms and Conditions
          </h1>
          <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-pet-blue-dark">
            <div>
              <dt className="inline font-bold text-pet-ink">App: </dt>
              <dd className="inline">NOMI</dd>
            </div>
            <div>
              <dt className="inline font-bold text-pet-ink">Developer: </dt>
              <dd className="inline">Yash Bharadwaj</dd>
            </div>
            <div>
              <dt className="inline font-bold text-pet-ink">Effective Date: </dt>
              <dd className="inline">March 1, 2026</dd>
            </div>
            <div>
              <dt className="inline font-bold text-pet-ink">Last Updated: </dt>
              <dd className="inline">March 27, 2026</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-bold text-pet-ink">Contact: </dt>
              <dd className="inline">
                <a
                  href="mailto:bharadwaj465@gmail.com"
                  className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
                >
                  bharadwaj465@gmail.com
                </a>
              </dd>
            </div>
          </dl>
        </header>

        <div className="space-y-10 text-[17px] leading-relaxed text-pet-blue-dark [&>section>h2]:text-2xl [&>section>h2]:font-bold [&>section>h2]:text-pet-ink [&>section>h2]:mb-4 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:pl-1">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using the NOMI mobile application
              (&ldquo;App&rdquo;), you agree to be bound by these Terms and Conditions
              (&ldquo;Terms&rdquo;). If you do not agree, do not use the App.
            </p>
            <p>
              These Terms apply to all users of the App, including users who connect a Solana
              wallet and make in-app purchases.
            </p>
          </section>

          <section>
            <h2>2. Description of the App</h2>
            <p>NOMI is a mobile Solana dApp that allows users to:</p>
            <ul className="list-disc pl-6">
              <li>Mint a virtual companion NFT on the Solana mainnet blockchain</li>
              <li>Purchase in-app accessories, emote animations, and cosmetic items using SOL</li>
              <li>Subscribe to premium tiers (Plus, Pro) for enhanced features</li>
              <li>Participate in spin wheel mechanics and adventure zones</li>
              <li>Level up and evolve their companion through care and engagement</li>
              <li>Connect a compatible Solana wallet (e.g. Phantom, Solflare)</li>
            </ul>
          </section>

          <section>
            <h2>3. Eligibility</h2>
            <p>
              You must be at least 18 years of age (or the age of majority in your jurisdiction)
              to use this App and make blockchain transactions. By using the App, you represent
              and warrant that you meet this requirement.
            </p>
          </section>

          <section>
            <h2>4. Blockchain Transactions and No Refunds</h2>
            <p>
              All purchases within NOMI are executed as real, irreversible transactions on the{" "}
              <strong className="text-pet-ink">Solana mainnet blockchain</strong>. By confirming
              any transaction in your connected wallet, you acknowledge and agree:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong className="text-pet-ink">All sales are final.</strong> No refunds will be
                issued under any circumstances.
              </li>
              <li>
                Blockchain transactions are{" "}
                <strong className="text-pet-ink">irreversible</strong> once confirmed on-chain.
              </li>
              <li>
                You are solely responsible for reviewing and confirming all transaction details
                before signing.
              </li>
              <li>
                Network fees (transaction fees / &ldquo;gas&rdquo;) are non-refundable regardless
                of outcome.
              </li>
              <li>
                Failed transactions due to insufficient balance, network congestion, or wallet
                rejection do not entitle you to a refund.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Wallet Responsibility</h2>
            <p>
              NOMI does not custody, store, or have access to your private keys, seed phrases,
              or any wallet credentials. You are solely responsible for:
            </p>
            <ul className="list-disc pl-6">
              <li>The security and backup of your wallet and private keys</li>
              <li>Any and all transactions you authorize through your connected wallet</li>
              <li>Maintaining sufficient SOL balance for transactions and network fees</li>
              <li>Any loss of funds resulting from compromised wallet credentials</li>
            </ul>
          </section>

          <section>
            <h2>6. NFT Ownership</h2>
            <p>
              When you successfully mint a NOMI companion NFT, you receive ownership of that
              specific NFT token on the Solana blockchain. You have the right to hold, transfer,
              or sell the token. However:
            </p>
            <ul className="list-disc pl-6">
              <li>
                The Developer retains all intellectual property rights to the underlying 3D
                artwork, animations, brand assets, and the NOMI name/logo.
              </li>
              <li>
                Owning the NFT does not grant you rights to reproduce, distribute, or commercially
                exploit the underlying art or brand assets.
              </li>
              <li>
                The Developer is not responsible for any loss of NFT value or changes in market
                conditions.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. Premium Subscriptions</h2>
            <ul className="list-disc pl-6">
              <li>Plus and Pro tier subscriptions require a one-time SOL transaction per period.</li>
              <li>
                Subscriptions <strong className="text-pet-ink">do not auto-renew</strong>. Each
                subscription period requires a manual transaction confirmation.
              </li>
              <li>
                Features associated with a subscription are only available during the active
                subscription period.
              </li>
              <li>Subscription fees are non-refundable.</li>
            </ul>
          </section>

          <section>
            <h2>8. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6">
              <li>Exploit, hack, reverse-engineer, or attempt to circumvent any part of the App</li>
              <li>Use the App for any unlawful or fraudulent purpose</li>
              <li>
                Attempt to obtain in-app items or features without completing the required payment
              </li>
              <li>Use automated bots, scripts, or tools to interact with the App</li>
              <li>
                Interfere with other users&apos; enjoyment of the App or the integrity of the
                Solana network
              </li>
            </ul>
          </section>

          <section>
            <h2>9. Intellectual Property</h2>
            <p>
              All content in the App — including but not limited to the 3D pet model, animations,
              UI design, graphics, sound, and the NOMI brand — is the intellectual property of
              Yash Bharadwaj. You may not copy, reproduce, distribute, or create derivative works
              without explicit written permission.
            </p>
          </section>

          <section>
            <h2>10. Disclaimer of Warranties</h2>
            <p>
              The App is provided <strong className="text-pet-ink">&ldquo;as is&rdquo;</strong> and{" "}
              <strong className="text-pet-ink">&ldquo;as available&rdquo;</strong> without any
              warranties of any kind, express or implied. We do not warrant that:
            </p>
            <ul className="list-disc pl-6">
              <li>The App will be uninterrupted, error-free, or secure</li>
              <li>Blockchain transactions will confirm within any specific timeframe</li>
              <li>The value of any digital asset (SOL, NFTs) will be stable or increase</li>
            </ul>
          </section>

          <section>
            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, the Developer shall not be liable
              for any indirect, incidental, special, consequential, or punitive damages arising
              from:
            </p>
            <ul className="list-disc pl-6">
              <li>Your use of or inability to use the App</li>
              <li>
                Any loss of digital assets (SOL, NFTs) due to wallet compromise, market conditions,
                or network failures
              </li>
              <li>
                Any errors, bugs, or downtime in the App or underlying blockchain infrastructure
              </li>
            </ul>
          </section>

          <section>
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless the Developer from any claims, damages, or
              expenses arising from your use of the App, your violation of these Terms, or your
              violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2>13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Significant changes will be
              reflected by an updated &ldquo;Last Updated&rdquo; date. Continued use of the App
              after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2>14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of <strong className="text-pet-ink">India</strong>.
              Any disputes arising from these Terms or your use of the App shall be subject to the
              exclusive jurisdiction of the courts of India.
            </p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>For any questions regarding these Terms:</p>
            <ul className="list-none pl-0 [&>li]:before:content-['—'] [&>li]:before:text-pet-blue [&>li]:before:mr-3">
              <li>
                <strong className="text-pet-ink">Email:</strong>{" "}
                <a
                  href="mailto:bharadwaj465@gmail.com"
                  className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
                >
                  bharadwaj465@gmail.com
                </a>
              </li>
              <li>
                <strong className="text-pet-ink">Support Email:</strong>{" "}
                <a
                  href="mailto:nomin8543427@gmail.com"
                  className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
                >
                  nomin8543427@gmail.com
                </a>
              </li>
              <li>
                <strong className="text-pet-ink">GitHub:</strong>{" "}
                <a
                  href="https://github.com/yash2k26/NomiApp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
                >
                  github.com/yash2k26/NomiApp
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
      <Footer />
    </main>
  );
}
