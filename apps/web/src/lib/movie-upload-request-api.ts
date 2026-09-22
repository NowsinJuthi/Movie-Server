import type {
  CreateMovieUploadRequestInput,
  MovieUploadRequestRow,
  PublicSiteFeatures,
} from "@movie-server/shared";
import { apiFetch } from "./api";

export const movieUploadRequestApi = {
  features: () => apiFetch<PublicSiteFeatures>("/settings/features"),
  create: (input: CreateMovieUploadRequestInput) =>
    apiFetch<MovieUploadRequestRow>("/movie-upload-requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  mine: () => apiFetch<MovieUploadRequestRow[]>("/movie-upload-requests/mine"),
};
