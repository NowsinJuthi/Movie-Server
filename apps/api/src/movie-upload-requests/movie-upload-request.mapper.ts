import type { MovieUploadRequestRow } from '@movie-server/shared';
import { MovieUploadRequestDocument } from './schemas/movie-upload-request.schema';

export function toMovieUploadRequestRow(doc: MovieUploadRequestDocument): MovieUploadRequestRow {
  return {
    id: String(doc._id),
    title: doc.title,
    year: doc.year ?? null,
    note: doc.note ?? null,
    status: doc.status,
    adminNote: doc.adminNote ?? null,
    userId: String(doc.userId),
    userEmail: doc.userEmail,
    userDisplayName: doc.userDisplayName,
    profileId: doc.profileId ? String(doc.profileId) : null,
    profileName: doc.profileName ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
