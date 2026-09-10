"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/components/branding/site-brand";
import { brandingAssetSrc } from "@/lib/settings-api";

export default function HomePage() {
  const { siteName, logoUrl } = useBranding();
  const logoSrc = brandingAssetSrc(logoUrl);

  return (
    <main className="auth-backdrop min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-2xl font-bold tracking-tight text-primary">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={siteName} className="h-9 w-auto max-w-[200px] object-contain" />
          ) : (
            siteName
          )}
        </span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Your private cinema
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Stream your library. Control every seat.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          An Emby-style media platform with Netflix-style profiles, subscriptions, and
          secure accounts. Playback is never trusted from the browser.
        </p>
        <div className="mt-10 flex gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Create account</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/subscribe">View plans</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
