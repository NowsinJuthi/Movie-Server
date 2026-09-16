import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import { brandingIcons, loadPublicBranding } from "@/lib/branding-head";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await loadPublicBranding();

  return {
    title: branding.siteName,
    description: "Private media streaming with subscription access.",
    applicationName: branding.siteName,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: branding.siteName,
    },
    formatDetection: {
      telephone: false,
    },
    icons: brandingIcons(branding),
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#01131a" },
    { media: "(prefers-color-scheme: dark)", color: "#01131a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
