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

mount -t cifs "//${HOST}/${SHARE}" "$MP" \
  -o "credentials=${CRED},uid=0,gid=0,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,noserverino,cache=loose,actimeo=60"

echo "Mounted //${HOST}/${SHARE} -> $MP"
ls "$MP" | head
