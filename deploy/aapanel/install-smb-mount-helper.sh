#!/usr/bin/env bash
# One-time VPS setup: allow AmarPin API (www) to mount Samba shares from the admin UI.
# Run as root on the VPS:
#   cd /www/wwwroot/movies.amarpin.com
#   sudo bash deploy/aapanel/install-smb-mount-helper.sh

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/aapanel/install-smb-mount-helper.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER_SRC="${SCRIPT_DIR}/amarpin-mount-smb.sh"
HELPER_DST="/usr/local/bin/amarpin-mount-smb"
SUDOERS_FILE="/etc/sudoers.d/amarpin-smb-mount"
API_USER="${AMARPIN_API_USER:-www}"

if [[ ! -f "$HELPER_SRC" ]]; then
  echo "Missing ${HELPER_SRC}" >&2
  exit 1
fi

if ! id "$API_USER" >/dev/null 2>&1; then
  echo "API user not found: ${API_USER} (set AMARPIN_API_USER if different)" >&2
  exit 1
fi

echo "Installing cifs-utils (if needed)..."
if ! command -v mount.cifs >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y cifs-utils
fi

echo "Installing mount helper -> ${HELPER_DST}"
install -m 755 -o root -g root "$HELPER_SRC" "$HELPER_DST"

echo "Configuring sudo for ${API_USER}..."
printf '%s ALL=(root) NOPASSWD: %s\n' "$API_USER" "$HELPER_DST" >"$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"

if ! visudo -cf "$SUDOERS_FILE"; then
  rm -f "$SUDOERS_FILE"
  echo "Invalid sudoers entry — removed ${SUDOERS_FILE}" >&2
  exit 1
fi

MOUNT_ROOT="${SMB_MOUNT_ROOT:-/www/wwwroot/movies.amarpin.com/storage/smb-mounts}"
mkdir -p "$MOUNT_ROOT/.credentials"
chown -R "${API_USER}:${API_USER}" "$MOUNT_ROOT"

echo ""
echo "Done. Samba mounts from Admin → File manager will use sudo automatically."
echo "Mount root: ${MOUNT_ROOT}"
echo "Verify: sudo -u ${API_USER} sudo ${HELPER_DST} 2>&1 | head -1 || true"
echo "Restart API: systemctl restart amarpin-api"
echo ""
echo "If Samba was mounted before this update, remount so files are owned by ${API_USER}:"
echo "  sudo umount ${MOUNT_ROOT}/<server-id>   # for each active mount"
echo "  Then browse the share again in Admin → File manager."
