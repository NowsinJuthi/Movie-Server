"use client";

import type { AdminSmbUploadResponse } from "@movie-server/shared";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { smbApi } from "@/lib/smb-api";
import {
  statusFromUploadResult,
  type SmbUploadStatus,
} from "@/components/admin/smb-upload-toast";
import styles from "./smb-upload-panel.module.css";

const VIDEO_ACCEPT = ".mkv,.mp4,.avi,.mov,.wmv,.m4v,.ts,.m2ts,.webm,.mpg,.mpeg,video/*";

/** Network upload fills 0–70% of the bar; Samba write animates 70–98%; success = 100%. */
const UPLOAD_PHASE_MAX = 70;
const SAVING_PHASE_CAP = 98;

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function mapNetworkProgress(xhrPercent: number): number {
  return Math.min(UPLOAD_PHASE_MAX, Math.round((xhrPercent / 100) * UPLOAD_PHASE_MAX));
}

function savingTick(fileSize: number): { intervalMs: number; step: number } {
  if (fileSize > 2 * 1024 * 1024 * 1024) return { intervalMs: 450, step: 0.35 };
  if (fileSize > 500 * 1024 * 1024) return { intervalMs: 320, step: 0.55 };
  return { intervalMs: 220, step: 0.85 };
}

export function SmbUploadPanel({
  serverId,
  directoryPath,
  directoryLabel,
  onUploaded,
  onStatusChange,
}: {
  serverId: string;
  directoryPath: string;
  directoryLabel: string;
  onUploaded?: (result: AdminSmbUploadResponse) => void;
  onStatusChange?: (status: SmbUploadStatus | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);

  const clearSavingTimer = () => {
    if (savingTimerRef.current) {
      clearInterval(savingTimerRef.current);
      savingTimerRef.current = null;
    }
  };

  useEffect(() => () => clearSavingTimer(), []);

  const emitStatus = (status: SmbUploadStatus) => {
    onStatusChange?.({ ...status, progress: Math.round(status.progress ?? 0) });
  };

  const setDisplayProgress = (next: number) => {
    progressRef.current = next;
    setProgress(next);
  };

  const startSavingProgress = (filename: string, fileSize: number) => {
    clearSavingTimer();
    const { intervalMs, step } = savingTick(fileSize);

    savingTimerRef.current = setInterval(() => {
      const prev = progressRef.current;
      if (prev >= SAVING_PHASE_CAP) return;
      const next = Math.min(SAVING_PHASE_CAP, prev + step);
      setDisplayProgress(next);
      emitStatus({ phase: "saving", filename, progress: next });
    }, intervalMs);
  };

  const upload = async () => {
    if (!file) return;
    const filename = file.name;
    const fileSize = file.size;
    setBusy(true);
    setProcessing(false);
    setDisplayProgress(0);
    clearSavingTimer();

    emitStatus({ phase: "uploading", filename, progress: 0 });

    try {
      const response = await smbApi.upload(serverId, file, directoryPath, {
        scan: true,
        onProgress: (xhrPercent) => {
          if (xhrPercent >= 100) {
            setProcessing(true);
            setDisplayProgress(UPLOAD_PHASE_MAX);
            emitStatus({ phase: "saving", filename, progress: UPLOAD_PHASE_MAX });
            startSavingProgress(filename, fileSize);
            return;
          }
          const display = mapNetworkProgress(xhrPercent);
          setDisplayProgress(display);
          emitStatus({ phase: "uploading", filename, progress: display });
        },
      });

      clearSavingTimer();
      setDisplayProgress(100);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";

      const success = { ...statusFromUploadResult(response, filename), progress: 100 };
      emitStatus(success);
      onUploaded?.(response);
    } catch (err) {
      clearSavingTimer();
      const message = err instanceof Error ? err.message : "Upload failed.";
      emitStatus({ phase: "error", filename, errorMessage: message, progress: 0 });
    } finally {
      setBusy(false);
      setProcessing(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="Upload video">
      <div className={styles.head}>
        <div className="min-w-0 flex-1">
          <h3 className={styles.title}>Upload to Samba</h3>
          <p className={styles.path} title={directoryLabel}>
            {directoryLabel}
          </p>
        </div>
        <Button type="button" size="sm" disabled={!file || busy} onClick={() => void upload()}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {processing ? `Writing ${Math.round(progress)}%` : `Uploading ${Math.round(progress)}%`}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Start upload
            </>
          )}
        </Button>
      </div>

      <div className={styles.dropZone}>
        <input
          ref={inputRef}
          id="smb-upload-file"
          type="file"
          accept={VIDEO_ACCEPT}
          disabled={busy}
          className={styles.fileInput}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            clearSavingTimer();
            onStatusChange?.(null);
          }}
        />
        {file ? (
          <p className={styles.fileMeta}>
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : (
          <p className={styles.fileMeta}>MKV, MP4, AVI, MOV and other video formats</p>
        )}
      </div>
    </section>
  );
}
