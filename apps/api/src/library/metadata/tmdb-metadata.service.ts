import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sniffImageMime } from '../../common/security/image-bytes';
import { mapTmdbGenres } from './tmdb-genres';
import type { MovieGenre } from '@movie-server/shared';

const TMDB_API = 'https://api.themoviedb.org';
const TMDB_IMAGE = 'https://image.tmdb.org';
const FETCH_MS = 8_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type RemoteArtwork = {
  buffer: Buffer;
  mimetype: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type CatalogPerson = {
  name: string;
  character?: string | null;
  order?: number;
  imageUrl?: string | null;
};

export type CatalogMetadata = {
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  year?: number;
  runtimeMinutes?: number;
  genres: MovieGenre[];
  tmdbRating?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  cast: CatalogPerson[];
  directors: string[];
  writers: string[];
};

type TmdbSearchMovie = {
  results?: Array<{
    id?: number;
    title?: string;
    original_title?: string;
    overview?: string;
    release_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    genre_ids?: number[];
  }>;
};

type TmdbMovieDetail = {
  id?: number;
  title?: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  runtime?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: Array<{ id?: number; name?: string }>;
  credits?: TmdbCredits;
};

type TmdbCredits = {
  cast?: Array<{ name?: string; character?: string; order?: number; profile_path?: string | null }>;
  crew?: Array<{ name?: string; job?: string }>;
};

type TmdbSearchTv = {
  results?: Array<{
    id?: number;
    name?: string;
    original_name?: string;
    overview?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    genre_ids?: number[];
  }>;
};

type TmdbTvDetail = {
  name?: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  episode_run_time?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genres?: Array<{ id?: number; name?: string }>;
  credits?: TmdbCredits;
};

@Injectable()
export class TmdbMetadataService {
  private readonly logger = new Logger(TmdbMetadataService.name);

  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(this.apiKey());
  }

  async searchMovie(title: string, year?: number): Promise<CatalogMetadata | null> {
    if (!this.enabled() || !title.trim()) {
      return null;
    }
    const query = new URLSearchParams({ query: title.trim(), include_adult: 'false' });
    if (year) {
      query.set('year', String(year));
    }
    const search = await this.getJson<TmdbSearchMovie>(`/3/search/movie?${query.toString()}`);
    const hit = search?.results?.[0];
    if (!hit?.id) {
      return null;
    }
    const detail = await this.getJson<TmdbMovieDetail>(`/3/movie/${hit.id}?append_to_response=credits`);
    const source = detail ?? hit;
    const release = source.release_date ?? hit.release_date;
    const parsedYear = release ? Number(release.slice(0, 4)) : year;
    const people = mapCredits(detail?.credits);
    return {
      title: (detail?.title ?? hit.title ?? title).trim(),
      originalTitle: (detail?.original_title ?? hit.original_title) ?? null,
      overview: (detail?.overview ?? hit.overview)?.trim() || null,
      year: Number.isFinite(parsedYear) ? parsedYear : year,
      runtimeMinutes: detail?.runtime && detail.runtime > 0 ? detail.runtime : undefined,
      genres: mapTmdbGenres(
        detail?.genres ?? (hit.genre_ids ?? []).map((id) => ({ id })),
      ),
      tmdbRating: typeof (detail?.vote_average ?? hit.vote_average) === 'number' ? (detail?.vote_average ?? hit.vote_average) : null,
      posterPath: detail?.poster_path ?? hit.poster_path ?? null,
      backdropPath: detail?.backdrop_path ?? hit.backdrop_path ?? null,
      cast: people.cast,
      directors: people.directors,
      writers: people.writers,
    };
  }

  async searchSeries(title: string, year?: number): Promise<CatalogMetadata | null> {
    if (!this.enabled() || !title.trim()) {
      return null;
    }
    const query = new URLSearchParams({ query: title.trim(), include_adult: 'false' });
    if (year) {
      query.set('first_air_date_year', String(year));
    }
    const search = await this.getJson<TmdbSearchTv>(`/3/search/tv?${query.toString()}`);
    const hit = search?.results?.[0];
    if (!hit?.id) {
      return null;
    }
    const detail = await this.getJson<TmdbTvDetail>(`/3/tv/${hit.id}?append_to_response=aggregate_credits,credits`);
    const source = detail ?? hit;
    const air = source.first_air_date ?? hit.first_air_date;
    const parsedYear = air ? Number(air.slice(0, 4)) : year;
    const people = mapCredits(detail?.credits);
    return {
      title: (detail?.name ?? hit.name ?? title).trim(),
      originalTitle: (detail?.original_name ?? hit.original_name) ?? null,
      overview: (detail?.overview ?? hit.overview)?.trim() || null,
      year: Number.isFinite(parsedYear) ? parsedYear : year,
      runtimeMinutes: detail?.episode_run_time?.[0] && detail.episode_run_time[0] > 0 ? detail.episode_run_time[0] : undefined,
      genres: mapTmdbGenres(
        detail?.genres ?? (hit.genre_ids ?? []).map((id) => ({ id })),
      ),
      tmdbRating: typeof (detail?.vote_average ?? hit.vote_average) === 'number' ? (detail?.vote_average ?? hit.vote_average) : null,
      posterPath: detail?.poster_path ?? hit.poster_path ?? null,
      backdropPath: detail?.backdrop_path ?? hit.backdrop_path ?? null,
      cast: people.cast,
      directors: people.directors,
      writers: people.writers,
    };
  }

  async downloadPoster(posterPath: string | null | undefined): Promise<RemoteArtwork | null> {
    return this.downloadImage(posterPath, 'w780');
  }

  async downloadBackdrop(backdropPath: string | null | undefined): Promise<RemoteArtwork | null> {
    return this.downloadImage(backdropPath, 'w1280');
  }

  private apiKey(): string {
    return this.config.get<string>('TMDB_API_KEY')?.trim() ?? '';
  }

  private async getJson<T>(pathAndQuery: string): Promise<T | null> {
    const url = `${TMDB_API}${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(this.apiKey())}`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        this.logger.debug(`TMDB ${response.status} for ${pathAndQuery.split('?')[0]}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.debug(`TMDB lookup failed: ${error instanceof Error ? error.message : 'error'}`);
      return null;
    }
  }

  private async downloadImage(imagePath: string | null | undefined, size: 'w780' | 'w1280'): Promise<RemoteArtwork | null> {
    if (!imagePath || !/^\/[A-Za-z0-9._-]+$/.test(imagePath)) {
      return null;
    }
    const url = `${TMDB_IMAGE}/t/p/${size}${imagePath}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
      if (!response.ok) {
        return null;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
        return null;
      }
      const mime = sniffImageMime(bytes);
      if (!mime) {
        return null;
      }
      return { buffer: bytes, mimetype: mime };
    } catch (error) {
      this.logger.debug(`TMDB image download failed: ${error instanceof Error ? error.message : 'error'}`);
      return null;
    }
  }
}

function mapCredits(credits?: TmdbCredits | null): {
  cast: CatalogPerson[];
  directors: string[];
  writers: string[];
} {
  const cast = (credits?.cast ?? [])
    .filter((member) => Boolean(member.name?.trim()))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 24)
    .map((member, index) => ({
      name: member.name!.trim(),
      character: member.character?.trim() || null,
      order: member.order ?? index,
      imageUrl: tmdbProfileUrl(member.profile_path),
    }));

  const directors: string[] = [];
  const writers: string[] = [];
  for (const member of credits?.crew ?? []) {
    const name = member.name?.trim();
    if (!name) continue;
    if (member.job === 'Director' && !directors.includes(name)) {
      directors.push(name);
    }
    if ((member.job === 'Writer' || member.job === 'Screenplay') && !writers.includes(name)) {
      writers.push(name);
    }
  }
  return {
    cast,
    directors: directors.slice(0, 8),
    writers: writers.slice(0, 8),
  };
}

function tmdbProfileUrl(profilePath?: string | null): string | null {
  if (!profilePath || !/^\/[A-Za-z0-9._-]+$/.test(profilePath)) {
    return null;
  }
  return `${TMDB_IMAGE}/t/p/w185${profilePath}`;
}
