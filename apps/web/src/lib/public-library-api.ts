import type { PublicLibrariesResponse, PublicLibraryBrowseResponse } from "@movie-server/shared";
import { apiFetch } from "./api";

export const publicLibraryApi = {
  list: () => apiFetch<PublicLibrariesResponse>("/libraries"),
  browse: (id: string) => apiFetch<PublicLibraryBrowseResponse>(`/libraries/${id}`),
};
