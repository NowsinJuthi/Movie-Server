#!/usr/bin/env bash
# Mount a Samba share on the HOST so the API container can scan it via bind mount.
# Usage:
#   ./deploy/aapanel/mount-smb-share.sh SERVER_ID HOST SHARE USER PASS [MOUNT_ROOT]
#
# Example:
#   ./deploy/aapanel/mount-smb-share.sh 6aa46905f1680d12ad62aac1 103.114.38.211 12TB-Storage sohelonlineit 'your-password'

set -euo pipefail

SERVER_ID="${1:?server id (from admin UI)}"
HOST="${2:?smb host}"
SHARE="${3:?share name}"
USER="${4:?username}"
PASS="${5:?password}"
MOUNT_ROOT="${6:-/data/movies.amarpin.com/smb-mounts}"
MP="${MOUNT_ROOT}/${SERVER_ID}"
CRED="$(mktemp)"
trap 'rm -f "$CRED"' EXIT

chmod 600 "$CRED"
printf 'username=%s\npassword=%s\ndomain=WORKGROUP\n' "$USER" "$PASS" >"$CRED"
mkdir -p "$MP"

if mountpoint -q "$MP" 2>/dev/null; then
  echo "Already mounted: $MP"
  exit 0
fi

if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "Installing cifs-utils (required for mount.cifs)..."
  apt-get update -qq && apt-get install -y cifs-utils
fi

API_USER="${AMARPIN_API_USER:-www}"
WWW_UID="$(id -u "$API_USER")"
WWW_GID="$(id -g "$API_USER")"
BASE_OPTS="credentials=${CRED},uid=${WWW_UID},gid=${WWW_GID},iocharset=utf8,file_mode=0664,dir_mode=0775,vers=3.0,noserverino"
FAST_OPTS="${BASE_OPTS},cache=loose,actimeo=60"

if mount -t cifs "//${HOST}/${SHARE}" "$MP" -o "$FAST_OPTS" 2>/dev/null; then
  echo "Mounted //${HOST}/${SHARE} -> $MP (cache=loose)"
elif mount -t cifs "//${HOST}/${SHARE}" "$MP" -o "$BASE_OPTS"; then
  echo "Mounted //${HOST}/${SHARE} -> $MP (base options)"
else
  echo "Mount failed. Try: apt install cifs-utils && dmesg | tail -5" >&2
  exit 1
fi

ls "$MP" | head
