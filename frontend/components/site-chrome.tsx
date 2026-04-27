// shared site chrome (top nav + footer) used by the home page and the
// legal pages. dapp store url and skr mint live here so a future url
// change is one edit.
import Image from "next/image";
import Link from "next/link";

export const DAPP_STORE_URL = "https://dappstore.solanamobile.com";
export const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-pet-bg/80 border-b border-pet-blue/15">
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/nomi/icon.png"
            alt="NOMI logo"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
          <span className="text-xl font-bold tracking-tight">NOMI</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-pet-blue-dark">
          <Link href="/#features" className="hover:text-pet-ink transition-colors">Features</Link>
          <Link href="/#how" className="hover:text-pet-ink transition-colors">How it works</Link>
          <Link href="/#why" className="hover:text-pet-ink transition-colors">Why NOMI</Link>
          <Link href="/#faq" className="hover:text-pet-ink transition-colors">FAQ</Link>
        </div>
        <a
          href={DAPP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-2xl bg-pet-blue text-white text-sm font-bold shadow-soft hover:shadow-lift hover:-translate-y-px transition-all"
        >
          Get NOMI
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-pet-blue/10 bg-white/60">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 justify-between">
        <div className="flex items-center gap-3">
          <Image src="/nomi/icon.png" alt="" width={36} height={36} className="rounded-xl" />
          <div>
            <div className="text-base font-bold">NOMI</div>
            <div className="text-sm text-pet-blue-dark">Your on-chain companion.</div>
          </div>
        </div>
        <div className="flex flex-col md:items-end gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-pet-blue-dark">
            <Link href="/privacy" className="hover:text-pet-ink transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-pet-ink transition-colors">Terms</Link>
            <a
              href="mailto:bharadwaj465@gmail.com"
              className="hover:text-pet-ink transition-colors"
            >
              Contact
            </a>
            <a
              href="https://github.com/yash2k26/NomiApp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pet-ink transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="text-xs text-pet-blue-dark text-center md:text-right space-y-1">
            <div>
              SKR mint: <span className="font-mono break-all">{SKR_MINT}</span>
            </div>
            <div className="text-pet-blue-dark/70">Built on Solana mainnet · &copy; NOMI</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
