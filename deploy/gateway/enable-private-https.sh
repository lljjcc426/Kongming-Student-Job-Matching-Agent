#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ] || [ "$#" -ne 2 ]; then
  printf 'Usage: sudo bash enable-private-https.sh PUBLIC_IPV4 ALLOWED_IPV4/32\n' >&2
  exit 1
fi
gateway_ip=$1
allowed_cidr=$2
python3 - "$gateway_ip" "$allowed_cidr" <<'PY'
import ipaddress
import sys

address = ipaddress.IPv4Address(sys.argv[1])
network = ipaddress.IPv4Network(sys.argv[2], strict=True)
if not address.is_global or not network.network_address.is_global or network.prefixlen != 32:
    raise SystemExit('Use a public server IPv4 and exactly one public /32 test source.')
PY

bundle=$(cd "$(dirname "$0")" && pwd)
certificate=/etc/letsencrypt/live/kongming-ip/fullchain.pem
target=/etc/nginx/sites-available/kongming-bootstrap
for required in "$certificate" /etc/letsencrypt/live/kongming-ip/cert.pem /etc/letsencrypt/live/kongming-ip/chain.pem /etc/letsencrypt/live/kongming-ip/privkey.pem "$target" /etc/kongming/gateway.env /opt/kongming/certbot/bin/certbot; do
  if [ ! -f "$required" ]; then
    printf 'Missing prerequisite: %s\n' "$required" >&2
    exit 1
  fi
done
openssl verify -CApath /etc/ssl/certs -untrusted /etc/letsencrypt/live/kongming-ip/chain.pem -verify_ip "$gateway_ip" /etc/letsencrypt/live/kongming-ip/cert.pem
openssl x509 -in "$certificate" -noout -checkend 86400
bash -n "$bundle/reload-nginx.sh"
systemd-analyze verify "$bundle/kongming-certbot-renew.service" "$bundle/kongming-certbot-renew.timer"

backup=$(mktemp /etc/nginx/kongming-bootstrap-backup.XXXXXX)
rendered=$(mktemp /etc/nginx/kongming-https.XXXXXX)
trap 'rm -f "$rendered"' EXIT
install -m 600 "$target" "$backup"
sed -e "s/__GATEWAY_IP__/$gateway_ip/g" -e "s@__ALLOWED_CIDR__@$allowed_cidr@g" "$bundle/nginx-private-https.conf" > "$rendered"
install -m 644 "$rendered" "$target"
if ! /usr/sbin/nginx -t; then
  install -m 644 "$backup" "$target"
  exit 1
fi
if ! systemctl reload nginx; then
  install -m 644 "$backup" "$target"
  /usr/sbin/nginx -t && systemctl reload nginx
  exit 1
fi

install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
install -m 750 "$bundle/reload-nginx.sh" /etc/letsencrypt/renewal-hooks/deploy/kongming-nginx
install -m 644 "$bundle/kongming-certbot-renew.service" /etc/systemd/system/kongming-certbot-renew.service
install -m 644 "$bundle/kongming-certbot-renew.timer" /etc/systemd/system/kongming-certbot-renew.timer
systemctl daemon-reload
systemctl enable --now kongming-certbot-renew.timer

python3 - <<'PY'
from pathlib import Path
import os

environment = Path('/etc/kongming/gateway.env')
lines = [line for line in environment.read_text().splitlines() if not line.startswith('GATEWAY_TRUST_PROXY=')]
lines.append('GATEWAY_TRUST_PROXY=1')
environment.write_text('\n'.join(lines) + '\n')
os.chmod(environment, 0o600)
PY
systemctl restart kongming-gateway
for attempt in 1 2 3 4 5; do
  if curl --fail --silent 'http://127.0.0.1:8787/api/gateway?operation=status' > /dev/null; then
    printf 'Private HTTPS ready for %s only; verify external TLS and renewal dry-run next.\n' "$allowed_cidr"
    exit 0
  fi
  sleep 2
done
printf 'Gateway restart health check failed.\n' >&2
exit 1
