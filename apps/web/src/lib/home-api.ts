import type { HomeCard, HomeResponse, MovieListResponse, PublicMovie, PublicSeries, SeriesListResponse } from "@movie-server/shared";
import { apiFetch } from "./api";

export const homeApi = {
  browse: () => apiFetch<HomeResponse>("/home"),
};

export function movieToSearchCard(movie: PublicMovie, myListIds: string[]): HomeCard {
  return {
    id: movie.id,
    kind: "movie",
    title: movie.title,
    year: movie.releaseYear,
    description: movie.description,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    maturityRating: movie.maturityRating,
    certification: movie.certification,
    genres: movie.genres,
    ratings: movie.ratings,
    maxResolution: movie.maxResolution,
    playable: movie.playable,
    featured: movie.featured,
    trending: movie.trending,
    popular: movie.popular,
    badges: [],
    href: `/home/movies/${movie.id}`,
    watchHref: `/home/movies/${movie.id}/watch`,
    progressRatio: null,
    episodeLabel: null,
    inMyList: myListIds.includes(movie.id),
  };
}

export function seriesToSearchCard(series: PublicSeries, myListIds: string[]): HomeCard {
  return {
    id: series.id,
    kind: "series",
    title: series.title,
    year: series.firstAirYear,
    description: series.description,
    posterUrl: series.posterUrl,
    backdropUrl: series.backdropUrl,
    maturityRating: series.maturityRating,
    certification: series.certification,
    genres: series.genres,
    ratings: series.ratings,
    maxResolution: null,
    playable: series.availability === "available",
    featured: series.featured,
    trending: series.trending,
    popular: series.popular,
    badges: ["Series"],
    href: `/home/series/${series.id}`,
    watchHref: `/home/series/${series.id}`,
    progressRatio: null,
    episodeLabel: null,
    inMyList: myListIds.includes(series.id),
  };
}

export function mergeSearchCards(
  movies: MovieListResponse | undefined,
  series: SeriesListResponse | undefined,
  myListIds: string[],
): HomeCard[] {
  return [
    ...(movies?.items ?? []).map((item) => movieToSearchCard(item, myListIds)),
    ...(series?.items ?? []).map((item) => seriesToSearchCard(item, myListIds)),
  ];
}
