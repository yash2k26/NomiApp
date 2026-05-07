// root layout: loads fredoka, sets brand metadata + og tags, applies font var
import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-fredoka",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nomi.app"),
  title: "NOMI — The pet that lives on Solana",
  description:
    "Your on-chain companion that misses you when you're gone. Mint, name, and care for a real Solana NFT pet that remembers you.",
  icons: { icon: "/nomi/favicon.png", apple: "/nomi/icon.png" },
  openGraph: {
    title: "NOMI — The pet that lives on Solana",
    description:
      "Your on-chain companion that misses you when you're gone.",
    images: ["/nomi/icon.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOMI — The pet that lives on Solana",
    description:
      "Your on-chain companion that misses you when you're gone.",
    images: ["/nomi/icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F1F8FF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fredoka.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
