"use client";

import type { AdminSmbUploadResponse } from "@movie-server/shared";
import { FolderUp, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { smbApi } from "@/lib/smb-api";
import {
  statusFromUploadResult,
  type SmbUploadStatus,
} from "@/components/admin/smb-upload-toast";
import styles from "./smb-upload-panel.module.css";

const VIDEO_ACCEPT = ".mkv,.mp4,.avi,.mov,.wmv,.m4v,.ts,.m2ts,.webm,.mpg,.mpeg,video/*";

const VIDEO_EXT = new Set([
  ".mkv",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".m4v",
  ".ts",
  ".m2ts",
  ".webm",
  ".mpg",
  ".mpeg",
]);

function isVideoFile(name: string): boolean {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return false;
  return VIDEO_EXT.has(name.slice(idx).toLowerCase());
}

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

type UploadPick =
  | { mode: "file"; file: File }
  | { mode: "folder"; label: string; files: File[] };

function relativePathForFile(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.replace(/\\/g, "/");
  if (rel?.trim()) return rel.trim();
  return file.name;
}

function pickFromFileList(list: FileList | null, folder: boolean): UploadPick | null {
  if (!list?.length) return null;
  if (!folder) {
    const file = list[0];
    return file ? { mode: "file", file } : null;
  }
  const files = Array.from(list).filter((file) => isVideoFile(file.name));
  if (files.length === 0) return null;
  const firstPath = relativePathForFile(files[0]!);
  const label = firstPath.includes("/") ? firstPath.split("/")[0]! : firstPath;
  return { mode: "folder", label, files };
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const savingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const [pick, setPick] = useState<UploadPick | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [queueLabel, setQueueLabel] = useState<string | null>(null);

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

  const resetInputs = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const uploadOne = async (
    file: File,
    options: { relativePath?: string; scan: boolean; onFileProgress: (pct: number) => void },
  ) => {
    const filename = options.relativePath ?? file.name;
    const fileSize = file.size;

    return smbApi.upload(serverId, file, directoryPath, {
      scan: options.scan,
      relativePath: options.relativePath,
      onProgress: (xhrPercent) => {
        if (xhrPercent >= 100) {
          setProcessing(true);
          options.onFileProgress(UPLOAD_PHASE_MAX);
          emitStatus({ phase: "saving", filename, progress: UPLOAD_PHASE_MAX });
          startSavingProgress(filename, fileSize);
          return;
        }
        const display = mapNetworkProgress(xhrPercent);
        options.onFileProgress(display);
        emitStatus({ phase: "uploading", filename, progress: display });
      },
    });
  };

  const upload = async () => {
    if (!pick) return;
    setBusy(true);
    setProcessing(false);
    setDisplayProgress(0);
    clearSavingTimer();

    try {
      if (pick.mode === "file") {
        const file = pick.file;
        emitStatus({ phase: "uploading", filename: file.name, progress: 0 });
        const response = await uploadOne(file, {
          scan: true,
          onFileProgress: setDisplayProgress,
        });
        clearSavingTimer();
        setDisplayProgress(100);
        emitStatus({ ...statusFromUploadResult(response, file.name), progress: 100 });
        onUploaded?.(response);
      } else {
        const { files, label } = pick;
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        let uploadedBytes = 0;
        let lastResponse: AdminSmbUploadResponse | null = null;

        for (let index = 0; index < files.length; index++) {
          const file = files[index]!;
          const relativePath = relativePathForFile(file);
          setQueueLabel(`${index + 1}/${files.length}: ${relativePath}`);
          emitStatus({ phase: "uploading", filename: relativePath, progress: 0 });

          const response = await uploadOne(file, {
            relativePath,
            scan: index === files.length - 1,
            onFileProgress: (filePct) => {
              const weighted =
                totalBytes > 0
                  ? ((uploadedBytes + (file.size * filePct) / 100) / totalBytes) * 100
                  : filePct;
              setDisplayProgress(Math.min(99, weighted));
            },
          });

          uploadedBytes += file.size;
          lastResponse = response;
          clearSavingTimer();
        }

        setDisplayProgress(100);
        emitStatus({
          ...statusFromUploadResult(lastResponse!, `${label} (${files.length} files)`),
          progress: 100,
        });
        onUploaded?.(lastResponse!);
      }

      setPick(null);
      resetInputs();
    } catch (err) {
      clearSavingTimer();
      const message = err instanceof Error ? err.message : "Upload failed.";
      const filename =
        pick.mode === "file" ? pick.file.name : queueLabel ?? pick.mode === "folder" ? pick.label : "Upload";
      emitStatus({ phase: "error", filename, errorMessage: message, progress: 0 });
    } finally {
      setBusy(false);
      setProcessing(false);
      setQueueLabel(null);
    }
  };

  const pickSummary =
    pick?.mode === "file"
      ? `${pick.file.name} · ${formatBytes(pick.file.size)}`
      : pick?.mode === "folder"
        ? `${pick.label} · ${pick.files.length} video file${pick.files.length === 1 ? "" : "s"} · ${formatBytes(
            pick.files.reduce((sum, file) => sum + file.size, 0),
          )}`
        : null;

  return (
    <section className={styles.panel} aria-label="Upload video">
      <div className={styles.head}>
        <div className="min-w-0 flex-1">
          <h3 className={styles.title}>Upload to Samba</h3>
          <p className={styles.path} title={directoryLabel}>
            {directoryLabel}
          </p>
        </div>
        <Button type="button" size="sm" disabled={!pick || busy} onClick={() => void upload()}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {queueLabel ??
                (processing ? `Writing ${Math.round(progress)}%` : `Uploading ${Math.round(progress)}%`)}
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
          ref={fileInputRef}
          id="smb-upload-file"
          type="file"
          accept={VIDEO_ACCEPT}
          disabled={busy}
          className={styles.fileInput}
          onChange={(event) => {
            setPick(pickFromFileList(event.target.files, false));
            if (folderInputRef.current) folderInputRef.current.value = "";
            clearSavingTimer();
            onStatusChange?.(null);
          }}
        />
        <input
          ref={folderInputRef}
          id="smb-upload-folder"
          type="file"
          accept={VIDEO_ACCEPT}
          disabled={busy}
          className={styles.fileInput}
          multiple
          {...({ webkitdirectory: "true", mozdirectory: "true" } as InputHTMLAttributes<HTMLInputElement>)}
          onChange={(event) => {
            const next = pickFromFileList(event.target.files, true);
            setPick(next);
            if (fileInputRef.current) fileInputRef.current.value = "";
            clearSavingTimer();
            onStatusChange?.(null);
            if (event.target.files?.length && !next) {
              emitStatus({
                phase: "error",
                filename: "Folder",
                errorMessage: "No video files found in this folder.",
                progress: 0,
              });
            }
          }}
        />
        <div className={styles.pickActions}>
          <label htmlFor="smb-upload-file" className={styles.pickButton}>
            <Upload className="h-4 w-4" aria-hidden />
            Choose file
          </label>
          <label htmlFor="smb-upload-folder" className={styles.pickButton}>
            <FolderUp className="h-4 w-4" aria-hidden />
            Choose folder
          </label>
        </div>
        {pickSummary ? (
          <p className={styles.fileMeta}>{pickSummary}</p>
        ) : (
          <p className={styles.fileMeta}>
            Single video or a whole folder (subfolders kept). MKV, MP4, AVI, MOV, and other video formats.
          </p>
        )}
      </div>
    </section>
  );
}
