#!/usr/bin/env bash
# Root-only CIFS mount helper for AmarPin API (www user calls via sudo).
# Usage:
#   amarpin-mount-smb SERVER_ID HOST SHARE CRED_FILE MOUNT_ROOT [PORT]
#
# Install once: ./deploy/aapanel/install-smb-mount-helper.sh

set -euo pipefail

SERVER_ID="${1:?server id}"
HOST="${2:?smb host}"
SHARE="${3:?share name}"
CRED_FILE="${4:?credentials file}"
MOUNT_ROOT="${5:?mount root}"
PORT="${6:-445}"

if [[ ! "$SERVER_ID" =~ ^[a-fA-F0-9]{24}$ ]]; then
  echo "Invalid server id (expected 24-char MongoDB ObjectId)." >&2
  exit 1
fi

if [[ "$HOST" == */* ]] || [[ "$SHARE" == */* ]] || [[ "$HOST" == *\\* ]] || [[ "$SHARE" == *\\* ]]; then
  echo "Host and share must not contain path separators." >&2
  exit 1
fi

if [[ ! -f "$CRED_FILE" ]]; then
  echo "Credentials file not found: $CRED_FILE" >&2
  exit 1
fi

resolve_dir() {
  mkdir -p "$1"
  readlink -f "$1"
}

ROOT="$(resolve_dir "$MOUNT_ROOT")"
MP="$(resolve_dir "${MOUNT_ROOT}/${SERVER_ID}")"
CRED_REAL="$(readlink -f "$CRED_FILE")"
CRED_DIR="$(resolve_dir "${ROOT}/.credentials")"

if [[ "$MP" != "$ROOT" && "$MP" != "$ROOT"/* ]]; then
  echo "Mount point must stay under SMB mount root." >&2
  exit 1
fi

if [[ "$CRED_REAL" != "$CRED_DIR"/* ]]; then
  echo "Credentials file must stay under ${CRED_DIR}/." >&2
  exit 1
fi

if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "cifs-utils is required (mount.cifs not found)." >&2
  exit 1
fi

if mountpoint -q "$MP" 2>/dev/null; then
  echo "Already mounted: $MP"
  exit 0
fi

SOURCE="//${HOST}/${SHARE}"
if [[ "$PORT" != "445" && -n "$PORT" ]]; then
  SOURCE="${SOURCE}:${PORT}"
fi

BASE_OPTS="credentials=${CRED_REAL},uid=0,gid=0,iocharset=utf8,file_mode=0644,dir_mode=0755,noserverino,sec=ntlmssp,cache=loose,actimeo=60"
VERS_ATTEMPTS=(3.0 3.1.1 2.1)

for vers in "${VERS_ATTEMPTS[@]}"; do
  if mount -t cifs "$SOURCE" "$MP" -o "${BASE_OPTS},vers=${vers}" 2>/dev/null; then
    echo "Mounted ${SOURCE} -> ${MP} (vers=${vers})"
    exit 0
  fi
done

if mount -t cifs "$SOURCE" "$MP" -o "$BASE_OPTS"; then
  echo "Mounted ${SOURCE} -> ${MP}"
  exit 0
fi

echo "Mount failed for ${SOURCE} -> ${MP}" >&2
exit 1
