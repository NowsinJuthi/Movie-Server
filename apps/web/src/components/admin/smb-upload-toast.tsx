"use client";

import type { AdminSmbUploadResponse } from "@movie-server/shared";
import { AlertCircle, CheckCircle2, CloudUpload, HardDriveUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./smb-upload-toast.module.css";

export type SmbUploadToastPhase = "uploading" | "saving" | "success" | "error";

export type SmbUploadStatus = {
  phase: SmbUploadToastPhase;
  filename: string;
  progress?: number;
  libraryName?: string | null;
  scanStarted?: boolean;
  sizeBytes?: number;
  errorMessage?: string;
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SmbUploadStatusCard({
  phase,
  filename,
  progress = 0,
  libraryName,
  scanStarted,
  sizeBytes,
  errorMessage,
  inline = false,
}: SmbUploadStatus & { inline?: boolean }) {
  const isSuccess = phase === "success";
  const isError = phase === "error";
  const isSaving = phase === "saving";
  const isUploading = phase === "uploading";

  const title = isSuccess
    ? "Upload complete"
    : isError
      ? "Upload failed"
      : isSaving
        ? "Writing to Samba share"
        : "Uploading video";

  const message = isSuccess
    ? libraryName
      ? scanStarted
        ? `Added to ${libraryName}. Library scan started — the title will appear after scan finishes.`
        : `Saved to ${libraryName}.`
      : "File is on the share. Link this folder as a media library, then rescan."
    : isError
      ? errorMessage || "Something went wrong while uploading."
      : isSaving
        ? "The file reached AmarPin. Copying to your network storage — large files may take a few minutes."
        : "Sending file to the server. Keep this page open until finished.";

  return (
    <div
      className={cn(
        styles.card,
        inline && styles.cardInline,
        isSuccess && styles.cardSuccess,
        isError && styles.cardError,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          styles.iconWrap,
          isSuccess && styles.iconWrapSuccess,
          isError && styles.iconWrapError,
        )}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : isError ? (
          <AlertCircle className="h-5 w-5" aria-hidden />
        ) : isSaving ? (
          <HardDriveUpload className={`h-5 w-5 ${styles.spin}`} aria-hidden />
        ) : (
          <CloudUpload className={`h-5 w-5 ${styles.spin}`} aria-hidden />
        )}
      </div>

      <div className={styles.body}>
        <p className={cn(styles.eyebrow, isError && styles.eyebrowError)}>
          {isSuccess ? "Samba upload" : isError ? "Samba upload" : "AmarPin · Samba"}
        </p>
        <p className={styles.title}>{title}</p>
        <p className={styles.filename} title={filename}>
          {filename}
          {sizeBytes ? ` · ${formatBytes(sizeBytes)}` : ""}
        </p>
        <p className={styles.message}>{message}</p>

        {isSuccess && libraryName ? (
          <span className={styles.meta}>
            {scanStarted ? "Scan running" : "Library linked"}
          </span>
        ) : null}

        {(isUploading || isSaving) && (
          <>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className={styles.progressBar}
                style={{ width: `${Math.max(Math.min(progress, 100), 4)}%` }}
              />
            </div>
            <p className={styles.progressLabel}>
              {isSaving
                ? `${Math.round(progress)}% — writing to Samba share…`
                : `${Math.round(progress)}% — sending to server…`}
            </p>
          </>
        )}

        {isSuccess ? (
          <>
            <div className={styles.progressTrack} aria-hidden>
              <div className={styles.progressBar} style={{ width: "100%" }} />
            </div>
            <p className={styles.progressLabel}>100% — upload complete</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function statusFromUploadResult(
  result: AdminSmbUploadResponse,
  filename: string,
): SmbUploadStatus {
  return {
    phase: "success",
    filename: result.filename || filename,
    progress: 100,
    libraryName: result.libraryName,
    scanStarted: Boolean(result.scan),
    sizeBytes: result.sizeBytes,
  };
}
