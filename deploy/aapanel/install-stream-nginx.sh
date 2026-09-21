#!/usr/bin/env bash
# Insert stream location into the live aaPanel vhost so /api/v1/stream/ hits Next.js :3000.
set -euo pipefail
VHOST="${1:-/www/server/panel/vhost/nginx/movies.amarpin.com.conf}"
MARKER="location ^~ /api/v1/stream/"
python3 - "$VHOST" << 'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
if "location ^~ /api/v1/stream/" in text:
    print(f"already present: {path}")
    raise SystemExit(0)
block = """
    location ^~ /api/v1/stream/ {
        if ($http_user_agent ~* "(IDM|Internet.Download.Manager|Download.Master|FDM|Free.Download.Manager)") {
            return 403;
        }
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_buffering off;
        proxy_request_buffering off;
    }

"""
needle = "include /www/server/panel/vhost/nginx/proxy/movies.amarpin.com/*.conf;"
idx = text.find(needle)
if idx < 0:
    raise SystemExit(f"proxy include not found in {path}")
path.write_text(text[:idx] + block + text[idx:])
print(f"inserted stream location into {path}")
PY
nginx -t
nginx -s reload
echo "nginx stream location OK"
