export type PlayerMediaInfo = {
  year?: number | null;
  description?: string | null;
  genres?: string[];
  runtimeMinutes?: number | null;
  maturityRating?: string | null;
  certification?: string | null;
  cast?: Array<{ name: string; character?: string | null; imageUrl?: string | null }>;
  directors?: string[];
  writers?: string[];
  ratings?: {
    imdb?: number | null;
    tmdb?: number | null;
    audience?: number | null;
  };
  posterUrl?: string | null;
};
