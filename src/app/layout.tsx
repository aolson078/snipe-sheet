import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Snipe Sheet — Token Launch Intelligence",
  description:
    "Paste a contract address. Get an instant risk score. Stop aping blind.",
  openGraph: {
    title: "Snipe Sheet",
    description: "Token launch intelligence for DeFi traders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-[#fafafa]">
        <nav className="border-b border-[#262626] px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-mono text-lg font-bold tracking-tight">
            SNIPE<span className="text-[#22c55e]">SHEET</span>
          </a>
          <div className="flex items-center gap-6 text-sm text-[#a1a1aa]">
            <a href="/" className="hover:text-white transition-colors">
              Check
            </a>
            <a href="/feed" className="hover:text-white transition-colors">
              Feed
            </a>
          </div>
        </nav>
        <PostHogProvider>
          <main className="flex-1">{children}</main>
        </PostHogProvider>
      </body>
    </html>
  );
}
