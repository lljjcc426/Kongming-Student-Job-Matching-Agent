#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  printf 'Run this installer with sudo.\n' >&2
  exit 1
fi
bundle=$(cd "$(dirname "$0")" && pwd)
if [ ! -f "$bundle/server/httpServer.js" ] || [ ! -f "$bundle/package-lock.json" ]; then
  printf 'Extract the complete gateway bundle before installation.\n' >&2
  exit 1
fi
export PATH=/opt/kongming/node/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != 24 ]; then
  printf 'Install Node.js 24 LTS before running this installer.\n' >&2
  exit 1
fi
if [ ! -f /etc/kongming/gateway.env ]; then
  printf 'Create /etc/kongming/gateway.env with server-only credentials first.\n' >&2
  exit 1
fi
chmod 600 /etc/kongming/gateway.env
chown root:root /etc/kongming/gateway.env
port=$(node --env-file=/etc/kongming/gateway.env -p 'Number(process.env.GATEWAY_PORT || 8787)')
if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
  printf 'Invalid GATEWAY_PORT in the server environment file.\n' >&2
  exit 1
fi
if ! id kongming >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/kongming --shell /usr/sbin/nologin kongming
fi
install -d -m 750 -o kongming -g kongming /var/lib/kongming /var/cache/kongming
install -d -m 755 /opt/kongming/releases
release=$(mktemp -d /opt/kongming/releases/gateway-XXXXXXXX)
cp -R "$bundle/server" "$release/server"
cp "$bundle/package.json" "$bundle/package-lock.json" "$release/"
chown -R kongming:kongming "$release"
runuser -u kongming -- env PATH="$PATH" npm_config_cache=/var/cache/kongming npm ci --prefix "$release" --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:root "$release"
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
ln -sfn "$release" /opt/kongming/current
install -m 644 "$bundle/kongming-gateway.service" /etc/systemd/system/kongming-gateway.service
systemctl daemon-reload
systemctl enable kongming-gateway
systemctl restart kongming-gateway
for attempt in 1 2 3 4 5; do
  if curl --fail --silent "http://127.0.0.1:$port/api/gateway?operation=status"; then
    printf '\nPrivate gateway started; public HTTPS access is not enabled.\n'
    exit 0
  fi
  sleep 2
done
printf 'Gateway health check failed; inspect systemctl status kongming-gateway.\n' >&2
exit 1
