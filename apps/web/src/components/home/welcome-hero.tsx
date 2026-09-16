"use client";

import { hasMinimumRole, LibraryKind, UserRole, type HomeCard } from "@movie-server/shared";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Film,
  Home,
  Play,
  Search,
  Shield,
  Sparkles,
  Tv,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useBranding } from "@/components/branding/site-brand";
import { PosterImage } from "@/components/home/poster-image";
import { Button } from "@/components/ui/button";
import { homeApi } from "@/lib/home-api";
import { publicLibraryApi } from "@/lib/public-library-api";
import { searchApi } from "@/lib/search-api";
import { subscriptionApi } from "@/lib/subscription-api";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import styles from "./welcome-hero.module.css";

function uniqueFeaturedCards(cards: HomeCard[]): HomeCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.kind}-${card.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function WelcomeHero() {
  const { siteName } = useBranding();
  const { user, status } = useAuthStore();
  const profile = useProfileStore((state) => state.activeProfile);

  const entitlementQuery = useQuery({
    queryKey: ["subscription-entitlement"],
    queryFn: subscriptionApi.entitlement,
    enabled: status === "authenticated",
  });
  const entitled = Boolean(entitlementQuery.data?.entitlement.entitled);
  const staff = Boolean(user && hasMinimumRole(user.role, UserRole.Admin));
  const canBrowse = entitled || staff;

  const librariesQuery = useQuery({
    queryKey: ["public-libraries"],
    queryFn: publicLibraryApi.list,
    staleTime: 60_000,
  });

  const homeQuery = useQuery({
    queryKey: ["home", profile?.id, "discover"],
    queryFn: homeApi.browse,
    enabled: canBrowse && Boolean(profile),
    staleTime: 45_000,
  });

  const trendingQuery = useQuery({
    queryKey: ["search-trending", "discover"],
    queryFn: searchApi.trending,
    enabled: canBrowse && Boolean(profile),
    staleTime: 60_000,
  });

  const libraries = librariesQuery.data?.libraries ?? [];
  const heroBackdrop =
    homeQuery.data?.hero?.backdropUrl ??
    homeQuery.data?.hero?.posterUrl ??
    homeQuery.data?.slider?.[0]?.backdropUrl ??
    homeQuery.data?.slider?.[0]?.posterUrl ??
    null;

  const featured = useMemo(() => {
    const pool: HomeCard[] = [];
    if (homeQuery.data?.hero) pool.push(homeQuery.data.hero);
    if (homeQuery.data?.slider?.length) pool.push(...homeQuery.data.slider);
    for (const row of homeQuery.data?.rows ?? []) {
      pool.push(...row.items.slice(0, 6));
    }
    return uniqueFeaturedCards(pool).slice(0, 14);
  }, [homeQuery.data]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        {heroBackdrop ? (
          <div className={styles.heroBackdrop} aria-hidden>
            <PosterImage
              src={heroBackdrop}
              alt=""
              priority
              className={`${styles.heroBackdropImage} absolute inset-0 h-full w-full`}
            />
          </div>
        ) : (
          <div className={styles.heroMesh} aria-hidden />
        )}
        <div className={styles.heroGrid} aria-hidden />
        <div className={styles.heroFadeLeft} aria-hidden />
        <div className={styles.heroFadeBottom} aria-hidden />

        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Discover
          </p>
          <h1 className={styles.title}>
            Your cinema,
            <span className={styles.titleAccent}> curated for you</span>
          </h1>
          <p className={styles.lead}>
            Explore {siteName}&apos;s library with cinematic browsing, smart search, and secure
            streaming built for your household.
          </p>

          <div className={styles.actions}>
            <Button size="lg" className={styles.primaryBtn} asChild>
              <Link href="/home">
                <Play className="mr-2 h-4 w-4 fill-current" />
                Start watching
              </Link>
            </Button>
            <Button size="lg" variant="outline" className={styles.secondaryBtn} asChild>
              <Link href="/home/search">
                <Search className="mr-2 h-4 w-4" />
                Search titles
              </Link>
            </Button>
          </div>

          <div className={styles.stats}>
            <span className={styles.stat}>
              <Film className={`h-3.5 w-3.5 ${styles.statIcon}`} aria-hidden />
              Movies & series
            </span>
            <span className={styles.stat}>
              <Users className={`h-3.5 w-3.5 ${styles.statIcon}`} aria-hidden />
              Family profiles
            </span>
            <span className={styles.stat}>
              <Shield className={`h-3.5 w-3.5 ${styles.statIcon}`} aria-hidden />
              Secure playback
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.quickGrid}>
          <Link href="/home" className={styles.quickCard}>
            <span className={styles.quickCardGlow} aria-hidden />
            <span className={styles.quickIcon}>
              <Home className="h-4 w-4" />
            </span>
            <span className={styles.quickLabel}>Home</span>
            <span className={styles.quickDesc}>Continue where you left off</span>
          </Link>
          <Link href="/home/search" className={styles.quickCard}>
            <span className={styles.quickCardGlow} aria-hidden />
            <span className={styles.quickIcon}>
              <Search className="h-4 w-4" />
            </span>
            <span className={styles.quickLabel}>Search</span>
            <span className={styles.quickDesc}>Find movies, shows & people</span>
          </Link>
          <Link href="/profiles" className={styles.quickCard}>
            <span className={styles.quickCardGlow} aria-hidden />
            <span className={styles.quickIcon}>
              <Compass className="h-4 w-4" />
            </span>
            <span className={styles.quickLabel}>Profiles</span>
            <span className={styles.quickDesc}>Switch viewer & preferences</span>
          </Link>
          <Link href="/subscribe" className={styles.quickCard}>
            <span className={styles.quickCardGlow} aria-hidden />
            <span className={styles.quickIcon}>
              <Sparkles className="h-4 w-4" />
            </span>
            <span className={styles.quickLabel}>Plans</span>
            <span className={styles.quickDesc}>Unlock full library access</span>
          </Link>
        </div>
      </section>

      {libraries.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Browse collections</h2>
              <p className={styles.sectionHint}>Jump into a library curated for you</p>
            </div>
          </div>
          <div className={styles.libraryGrid}>
            {libraries.map((library) => (
              <Link key={library.id} href={`/home/library/${library.id}`} className={styles.libraryCard}>
                <div className={styles.libraryArt}>
                  {library.imageUrl ? (
                    <PosterImage
                      src={library.imageUrl}
                      alt=""
                      className={`${styles.libraryArtImage} absolute inset-0 h-full w-full`}
                    />
                  ) : (
                    <span className={styles.libraryArtFallback} aria-hidden>
                      {library.kind === LibraryKind.Tv ? (
                        <Tv className="h-10 w-10" />
                      ) : (
                        <Film className="h-10 w-10" />
                      )}
                    </span>
                  )}
                </div>
                <div className={styles.libraryBody}>
                  <p className={styles.libraryKind}>
                    {library.kind === LibraryKind.Tv ? "TV Shows" : "Movies"}
                  </p>
                  <p className={styles.libraryName}>{library.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Featured picks</h2>
              <p className={styles.sectionHint}>Hand-picked titles from your catalog</p>
            </div>
            <Link href="/home" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className={`${styles.featuredScroller} brand-scrollbar`}>
            {featured.map((card) => (
              <Link
                key={`${card.kind}-${card.id}`}
                href={card.href}
                className={styles.featuredCard}
              >
                <div className={styles.featuredPoster}>
                  <PosterImage
                    src={card.posterUrl ?? card.backdropUrl}
                    alt=""
                    className={`${styles.featuredPosterImage} h-full w-full`}
                  />
                </div>
                <p className={styles.featuredTitle}>{card.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {(trendingQuery.data?.items.length ?? 0) > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>Popular searches</h2>
              <p className={styles.sectionHint}>Trending queries from your library</p>
            </div>
          </div>
          <div className={styles.trendingRow}>
            {trendingQuery.data?.items.map((item) => (
              <Link
                key={item.query}
                href={`/home/search?q=${encodeURIComponent(item.query)}`}
                className={styles.trendingPill}
              >
                <Search className="h-3.5 w-3.5 text-primary" aria-hidden />
                {item.query}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>Built for streaming at home</h2>
            <p className={styles.sectionHint}>Everything you need for a premium library experience</p>
          </div>
        </div>
        <div className={styles.featuresGrid}>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <Film className="h-5 w-5" />
            </span>
            <h3 className={styles.featureTitle}>Your media, beautifully organized</h3>
            <p className={styles.featureText}>
              Movies and series from your libraries, sorted into rows, genres, and collections you
              can browse in seconds.
            </p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <Users className="h-5 w-5" />
            </span>
            <h3 className={styles.featureTitle}>Profiles for every viewer</h3>
            <p className={styles.featureText}>
              Separate watch history, recommendations, and parental controls for each member of
              your household.
            </p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <Shield className="h-5 w-5" />
            </span>
            <h3 className={styles.featureTitle}>Secure by design</h3>
            <p className={styles.featureText}>
              Playback is authorized on the server — your browser never gets unrestricted access to
              source files.
            </p>
          </article>
        </div>
      </section>

      <div className={styles.footerSpace} />
    </main>
  );
}
