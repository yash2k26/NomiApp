// single-page nomi landing: hero, what-is-nomi, app tour, features,
// how it works, why nomi, faq, final cta. assets live in public/nomi/.
import Image from "next/image";
import { Nav, Footer, DAPP_STORE_URL, SKR_MINT } from "../components/site-chrome";

const featureCards = [
  {
    icon: "/nomi/icons/feed.png",
    title: "Care for your pet",
    body: "Feed, play, rest. Stats decay in real time, so your NOMI actually feels alive while you're away.",
    tint: "bg-pet-blue-light",
  },
  {
    icon: "/nomi/icons/play.png",
    title: "6 mini-games",
    body: "Memory match, quick tap, pattern recall, math rush. Earn XP, level up, unlock new zones.",
    tint: "bg-pet-yellow-light",
  },
  {
    icon: "/nomi/icons/home.png",
    title: "A real Solana NFT",
    body: "0.15 SOL one-time mint on mainnet. Metaplex standard. Lives in your wallet, not on a company server.",
    tint: "bg-pet-purple-light",
  },
  {
    icon: "/nomi/icons/shop.png",
    title: "Shop with SOL or SKR",
    body: "Headphones, crowns, hairstyles. Real on-chain transactions, real ownership, real costumes.",
    tint: "bg-pet-pink-light",
  },
  {
    icon: "/nomi/icons/me.png",
    title: "Personality + diary",
    body: "Five evolving traits shaped by how you play. AI-generated diary entries reflect your shared history.",
    tint: "bg-pet-green-light",
  },
  {
    icon: "/nomi/icons/rest.png",
    title: "Adventures + evolution",
    body: "Five zones, fifty levels, five evolution stages. Your NOMI grows with you, not for you.",
    tint: "bg-pet-orange-light",
  },
];

// rendered marketing scenes — each image already has an embedded title;
// the alt text mirrors that for accessibility / SEO.
const showcase = [
  { src: "/nomi/showcase/01-companion.png", alt: "Meet your on-chain companion — wake screen" },
  { src: "/nomi/showcase/02-care.png", alt: "Care that feels alive — feed, play, rest, mood" },
  { src: "/nomi/showcase/03-connect.png", alt: "Connect in seconds — secure wallet onboarding" },
  { src: "/nomi/showcase/04-grow.png", alt: "Grow and customize — level up, unlock rewards" },
];

const faqs = [
  {
    q: "How much does it cost?",
    a: "0.15 SOL — a single one-time mint on Solana mainnet. No subscriptions, no in-app purchases unless you want shop accessories.",
  },
  {
    q: "Where do I download NOMI?",
    a: "NOMI lives on the Solana dApp Store. Tap any 'Get NOMI' button on this page, search for 'NOMI', and install. The app is built for the Solana mobile experience.",
  },
  {
    q: "What happens if I stop playing?",
    a: "Your NOMI is still yours — it's an NFT in your wallet forever. When you come back, your pet remembers you, your diary, and your history. The stats just get a little hungry.",
  },
  {
    q: "Which wallet do I need?",
    a: "Any Solana wallet that supports the dApp Store experience. Phantom, Solflare, and Seed Vault all work. You'll connect once, mint once, and you're done.",
  },
  {
    q: "Is this on Apple App Store or Google Play?",
    a: "Not yet. NOMI ships through the Solana dApp Store first — that's where the on-chain native experience lives. Other stores may follow.",
  },
  {
    q: "What is the SKR token?",
    a: `SKR is the in-app reward token. You earn it by caring for your pet and playing games, and you can spend it in the shop. The mint address is ${SKR_MINT}.`,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-pet-bg text-pet-ink">
      <Nav />
      <Hero />
      <WhatIsNomi />
      <AppTour />
      <Features />
      <HowItWorks />
      <WhyNomi />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-pet-bg to-pet-bg pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pet-blue-light text-pet-blue-dark text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-pet-blue animate-pulse" />
            On the Solana dApp Store
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            The pet that lives on Solana,{" "}
            <span className="text-pet-blue">and actually remembers your name.</span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-pet-blue-dark leading-relaxed max-w-xl">
            Your on-chain companion that misses you when you&apos;re gone. Mint a real Solana NFT, give it a name, and watch a personality grow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={DAPP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-3xl bg-pet-blue text-white text-base font-bold shadow-lift hover:-translate-y-0.5 transition-transform"
            >
              Get on Solana dApp Store
            </a>
            <a
              href="#how"
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-3xl bg-white text-pet-blue-dark text-base font-bold border border-pet-blue/20 hover:bg-pet-blue-light transition-colors"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm text-pet-blue-dark/80">
            Search <span className="font-bold text-pet-ink">&ldquo;NOMI&rdquo;</span> on the Solana dApp Store · 0.15 SOL one-time mint
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-pet-blue/15 blur-3xl rounded-full" />
          <div className="relative animate-float">
            <Image
              src="/nomi/hero.png"
              alt="NOMI — your on-chain companion"
              width={1532}
              height={2047}
              priority
              className="w-full h-auto max-w-[460px] mx-auto rounded-[48px] drop-shadow-[0_30px_40px_rgba(45,107,144,0.22)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatIsNomi() {
  const cards = [
    {
      img: "/nomi/photos/headphone-guy.png",
      title: "A real on-chain pet",
      body: "NOMI is a Metaplex NFT on Solana mainnet. Not a database row, not a screenshot — a token you actually own.",
    },
    {
      img: "/nomi/photos/hanging.png",
      title: "Personality that evolves",
      body: "Five traits — foodie, brave, restless, curious, calm — that shift based on how you actually play, not a stat sheet.",
    },
    {
      img: "/nomi/photos/explore-earth.png",
      title: "Lives in your wallet",
      body: "When you stop playing, your NOMI is still yours. Forever. Bring it back any time and pick up where you left off.",
    },
  ];
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {cards.map((c) => (
          <div
            key={c.title}
            className="group rounded-4xl bg-white p-7 shadow-soft hover:shadow-lift transition-shadow"
          >
            <div className="h-44 flex items-center justify-center bg-pet-blue-light rounded-3xl overflow-hidden mb-5">
              <Image
                src={c.img}
                alt={c.title}
                width={220}
                height={220}
                className="w-auto h-40 object-contain group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <h3 className="text-xl font-bold leading-snug">{c.title}</h3>
            <p className="mt-2 text-pet-blue-dark leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AppTour() {
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-block px-3 py-1.5 rounded-full bg-pet-purple-light text-pet-purple-dark text-xs font-bold uppercase tracking-wider">
          See NOMI in action
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          A whole world to wake up to.
        </h2>
        <p className="mt-3 text-pet-blue-dark text-lg">
          Wake your companion. Care for it. Connect your wallet. Grow it through 50 levels.
        </p>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 gap-5 md:gap-7">
        {showcase.map((s) => (
          <div
            key={s.src}
            className="group relative rounded-4xl overflow-hidden shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all bg-white"
          >
            <Image
              src={s.src}
              alt={s.alt}
              width={1660}
              height={948}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="w-full h-auto block"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-block px-3 py-1.5 rounded-full bg-pet-green-light text-pet-green-dark text-xs font-bold uppercase tracking-wider">
          Features
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          Everything NOMI can do.
        </h2>
        <p className="mt-3 text-pet-blue-dark text-lg">
          Not a concept. A shipped product running on Solana mainnet today.
        </p>
      </div>
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {featureCards.map((f) => (
          <div
            key={f.title}
            className="rounded-3xl bg-white p-6 shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all"
          >
            <div className={`w-20 h-20 rounded-2xl ${f.tint} flex items-center justify-center mb-5`}>
              <Image src={f.icon} alt="" width={96} height={96} className="w-14 h-14 object-contain" />
            </div>
            <h3 className="text-lg font-bold leading-snug">{f.title}</h3>
            <p className="mt-2 text-pet-blue-dark leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Connect your wallet",
      body: "Open NOMI on the Solana dApp Store, tap connect, and pick your wallet. One click, one signature.",
    },
    {
      n: "02",
      title: "Mint your NOMI",
      body: "Choose a name. Pay 0.15 SOL. Your pet is minted as a real Solana NFT — the moment is permanent.",
    },
    {
      n: "03",
      title: "Care for it daily",
      body: "Feed, play, rest, explore. Your NOMI's personality and diary build up the more you show up.",
    },
  ];
  return (
    <section id="how" className="bg-white border-y border-pet-blue/10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1.5 rounded-full bg-pet-blue-light text-pet-blue-dark text-xs font-bold uppercase tracking-wider">
            How it works
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            Three steps. Real ownership.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-4xl bg-pet-bg p-7">
              <div className="text-pet-blue/40 font-bold text-5xl tracking-tight">{s.n}</div>
              <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-pet-blue-dark leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyNomi() {
  return (
    <section id="why" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
      <div className="rounded-5xl bg-gradient-to-br from-pet-blue to-pet-purple p-10 sm:p-14 md:p-16 text-white shadow-lift">
        <span className="inline-block px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider">
          Why NOMI
        </span>
        <p className="mt-6 text-2xl sm:text-3xl md:text-4xl font-bold leading-snug">
          In 1996, 82 million Tamagotchis were sold. In 2024, 10 million people downloaded a companion app called Finch.
        </p>
        <p className="mt-5 text-lg sm:text-xl text-white/85 max-w-3xl leading-relaxed">
          The pet you care about isn&apos;t a pixel — it&apos;s a thing that remembers you. NOMI is the first one that lives on-chain. The first one you actually own. The first one you can&apos;t lose to a server going dark.
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { k: "0.15 SOL", v: "One-time mint" },
            { k: "5", v: "Evolution stages" },
            { k: "50", v: "Levels" },
            { k: "Solana", v: "Mainnet" },
          ].map((s) => (
            <div key={s.k} className="rounded-3xl bg-white/10 backdrop-blur p-5">
              <div className="text-2xl sm:text-3xl font-bold">{s.k}</div>
              <div className="mt-1 text-sm text-white/80 font-semibold">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
      <div className="text-center">
        <span className="inline-block px-3 py-1.5 rounded-full bg-pet-pink-light text-pet-pink-dark text-xs font-bold uppercase tracking-wider">
          FAQ
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          Common questions.
        </h2>
      </div>
      <div className="mt-10 space-y-3">
        {faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-3xl bg-white border border-pet-blue/10 px-6 py-4 shadow-soft open:shadow-lift transition-shadow"
          >
            <summary className="flex items-center justify-between gap-4 text-base sm:text-lg font-bold">
              <span>{item.q}</span>
              <span
                aria-hidden
                className="faq-chevron flex-none w-7 h-7 rounded-full bg-pet-blue-light text-pet-blue-dark grid place-items-center text-xl leading-none"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-pet-blue-dark leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-20 sm:pb-28">
      <div className="rounded-5xl bg-pet-ink text-white p-10 sm:p-14 md:p-16 text-center shadow-lift relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-pet-blue/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-pet-purple/25 blur-3xl pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Meet your NOMI.
          </h2>
          <p className="mt-4 text-lg sm:text-xl text-white/80 max-w-xl mx-auto leading-relaxed">
            Search <span className="font-bold text-white">&ldquo;NOMI&rdquo;</span> on the Solana dApp Store and download. Mint takes thirty seconds. The friendship is forever.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={DAPP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-3xl bg-white text-pet-ink text-base font-bold shadow-lift hover:-translate-y-0.5 transition-transform"
            >
              Get on Solana dApp Store
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-3xl bg-white/10 text-white text-base font-bold border border-white/20 hover:bg-white/15 transition-colors"
            >
              Learn more
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

