import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { NavLinks } from "@/components/ui/nav-links";
import { applicationConfig } from "@/config/application";
import { brandingConfig } from "@/config/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: brandingConfig.appName,
    template: `%s · ${brandingConfig.appName}`,
  },
  description: applicationConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <span className="text-sm font-semibold tracking-tight">{brandingConfig.appName}</span>
            <NavLinks items={applicationConfig.navigation} />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</div>
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
            <span>{brandingConfig.appName}</span>
            <span>v{applicationConfig.version}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
