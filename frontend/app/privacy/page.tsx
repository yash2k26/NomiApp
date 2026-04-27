// privacy policy page — content ported verbatim from
// /Users/bluntbrain/Documents/code/ai-friend/NomiApp/LEGAL/privacy-policy.md
// (the source of truth for app store submission). do not divergence-edit;
// update the markdown first, then mirror here.
import type { Metadata } from "next";
import { Nav, Footer } from "../../components/site-chrome";

export const metadata: Metadata = {
  title: "Privacy Policy — NOMI",
  description:
    "How NOMI handles (and does not handle) your data. Local-only state, no analytics, no PII.",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-pet-bg text-pet-ink">
      <Nav />
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Privacy Policy
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
            <h2>Overview</h2>
            <p>
              NOMI is a mobile Solana dApp where users care for a virtual companion NFT.
              We are committed to protecting your privacy. This policy explains what
              data we collect (and don&apos;t collect), how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2>1. Information We Do Not Collect</h2>
            <p>NOMI does <strong className="text-pet-ink">not</strong> collect, store, or transmit:</p>
            <ul className="list-disc pl-6">
              <li>Your name, email address, or any personally identifiable information</li>
              <li>Private keys, seed phrases, or wallet credentials of any kind</li>
              <li>Device identifiers, advertising IDs, or unique hardware identifiers</li>
              <li>IP addresses or location data</li>
              <li>Usage analytics, behavioral telemetry, or crash reports</li>
            </ul>
          </section>

          <section>
            <h2>2. Information Stored Locally on Your Device</h2>
            <p>
              NOMI stores the following data <strong className="text-pet-ink">locally on your device only</strong>{" "}
              using standard React Native device storage:
            </p>
            <ul className="list-disc pl-6">
              <li>Your pet&apos;s name, mood, level, and care state</li>
              <li>Items purchased and owned in the shop</li>
              <li>App preferences and settings</li>
            </ul>
            <p>
              This data never leaves your device and is not transmitted to any server we operate.
            </p>
          </section>

          <section>
            <h2>3. Blockchain Data</h2>
            <p>
              NOMI interacts with the <strong className="text-pet-ink">Solana mainnet blockchain</strong>.
              When you perform in-app actions such as:
            </p>
            <ul className="list-disc pl-6">
              <li>Minting your companion NFT</li>
              <li>Purchasing shop items or emotes</li>
              <li>Subscribing to a premium tier</li>
              <li>Spinning the reward wheel</li>
            </ul>
            <p>
              ...those transactions are signed by your wallet and recorded on the{" "}
              <strong className="text-pet-ink">public Solana ledger</strong>. This is the nature of
              blockchain technology — transaction data is publicly visible. We do not control or
              collect this data; it is inherent to the Solana network.
            </p>
            <p>
              Your wallet&apos;s <strong className="text-pet-ink">public address</strong> is used
              locally on-device to display your balance and owned assets. It is not stored on or
              transmitted to any server we operate.
            </p>
          </section>

          <section>
            <h2>4. Wallet Integration</h2>
            <p>
              NOMI integrates with Solana-compatible wallets (such as Phantom or Solflare) using
              the <strong className="text-pet-ink">Solana Mobile Wallet Adapter</strong> protocol.
              This is a local device-to-device protocol. Your private keys and seed phrases remain
              entirely within your wallet app at all times. NOMI never has access to them.
            </p>
          </section>

          <section>
            <h2>5. Third-Party Services</h2>
            <p>NOMI uses the following third-party infrastructure:</p>
            <div className="mt-4 overflow-x-auto rounded-3xl border border-pet-blue/15 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-pet-blue-light/60 text-pet-ink">
                  <tr>
                    <th className="px-4 py-3 font-bold">Service</th>
                    <th className="px-4 py-3 font-bold">Purpose</th>
                    <th className="px-4 py-3 font-bold">Privacy Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pet-blue/10">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-pet-ink">Helius RPC</td>
                    <td className="px-4 py-3">Solana blockchain queries</td>
                    <td className="px-4 py-3">
                      <a
                        href="https://www.helius.dev/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
                      >
                        helius.dev/privacy-policy
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-pet-ink">Solana Mobile Wallet Adapter</td>
                    <td className="px-4 py-3">Local wallet signing protocol</td>
                    <td className="px-4 py-3">Local only, no data transmitted</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-pet-ink">Metaplex Token Metadata</td>
                    <td className="px-4 py-3">On-chain NFT standard</td>
                    <td className="px-4 py-3">Public Solana ledger</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2>6. Children&apos;s Privacy</h2>
            <p>
              NOMI is not directed to children under the age of 13. We do not knowingly collect
              any personal information from children. If you are a parent or guardian and believe
              your child has used the app, please contact us at{" "}
              <a
                href="mailto:bharadwaj465@gmail.com"
                className="text-pet-blue hover:text-pet-blue-dark underline underline-offset-2"
              >
                bharadwaj465@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2>7. Data Security</h2>
            <p>
              Since NOMI does not collect or store personal data on any servers, there is no
              personal data at risk on our end. All pet state and preferences are stored locally
              on your device using standard platform security.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>
              Since we do not collect personal data, there is no data to access, correct, or
              delete. If you uninstall the app, all locally stored data is removed from your
              device.
            </p>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Updates will be reflected by
              a new &ldquo;Last Updated&rdquo; date at the top of this document. Continued use of
              the app after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2>10. Contact Us</h2>
            <p>For any privacy-related questions or concerns, please contact:</p>
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
