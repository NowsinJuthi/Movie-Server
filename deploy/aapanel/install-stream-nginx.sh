#!/usr/bin/env bash
# Point aaPanel /api/v1 at Next.js :3000 and pin /api/v1/stream/ in the vhost.
set -euo pipefail

python3 << 'PY'
from pathlib import Path

proxy_dir = Path("/www/server/panel/vhost/nginx/proxy/movies.amarpin.com")
if proxy_dir.is_dir():
    for path in proxy_dir.glob("*"):
        if not path.is_file():
            continue
        text = path.read_text(errors="ignore")
        if "127.0.0.1:4000" in text and "api/v1" in text:
            path.write_text(text.replace("http://127.0.0.1:4000", "http://127.0.0.1:3000"))
            print(f"proxy 4000→3000: {path}")

vhosts = [
    Path("/www/server/panel/vhost/nginx/movies.amarpin.com.conf"),
    Path("/www/server/nginx/conf/vhost/movies.amarpin.com.conf"),
]
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
for path in vhosts:
    if not path.is_file():
        continue
    text = path.read_text()
    if "location ^~ /api/v1/stream/" not in text:
        idx = text.find(needle)
        if idx < 0:
            print(f"skip insert, no proxy include: {path}")
            continue
        path.write_text(text[:idx] + block + text[idx:])
        print(f"inserted stream location: {path}")
    else:
        print(f"stream location already present: {path}")
PY

nginx -t
nginx -s reload
echo "nginx stream/API now via Next.js :3000"
