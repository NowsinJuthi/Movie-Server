export const MovieUploadRequestStatus = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Fulfilled: 'fulfilled',
  Rejected: 'rejected',
} as const;

export type MovieUploadRequestStatus =
  (typeof MovieUploadRequestStatus)[keyof typeof MovieUploadRequestStatus];

export const ContentUploadRequestKind = {
  Movie: 'movie',
  Tv: 'tv',
} as const;

export type ContentUploadRequestKind =
  (typeof ContentUploadRequestKind)[keyof typeof ContentUploadRequestKind];

export const CONTENT_UPLOAD_REQUEST_KINDS = [
  ContentUploadRequestKind.Movie,
  ContentUploadRequestKind.Tv,
] as const;

export const MOVIE_UPLOAD_REQUEST_STATUSES = [
  MovieUploadRequestStatus.Pending,
  MovieUploadRequestStatus.InProgress,
  MovieUploadRequestStatus.Fulfilled,
  MovieUploadRequestStatus.Rejected,
] as const;

export type PublicSiteFeatures = {
  movieUploadRequestsEnabled: boolean;
};

export type MovieUploadRequestRow = {
  id: string;
  kind: ContentUploadRequestKind;
  title: string;
  year: number | null;
  note: string | null;
  status: MovieUploadRequestStatus;
  adminNote: string | null;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  profileId: string | null;
  profileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMovieUploadRequestInput = {
  kind?: ContentUploadRequestKind;
  title: string;
  year?: number;
  note?: string;
  profileId?: string;
};

export type UpdateMovieUploadRequestInput = {
  status?: MovieUploadRequestStatus;
  adminNote?: string;
};
