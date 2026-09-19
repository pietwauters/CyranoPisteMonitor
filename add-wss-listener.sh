#!/usr/bin/env bash
# Adds a WSS (WebSocket over TLS) listener on port 9002 to mosquitto,
# so browsers served over HTTPS can connect.

set -euo pipefail

MOSQ_CONF="/etc/mosquitto/mosquitto.conf"

if grep -q "openpiste WSS" "$MOSQ_CONF" 2>/dev/null; then
  echo "WSS listener already present in $MOSQ_CONF"
  exit 0
fi

cat >> "$MOSQ_CONF" <<'EOF'

##### openpiste WSS ############################################
listener 9002
protocol websockets
cafile /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
tls_version tlsv1.2
require_certificate false
allow_anonymous true
################################################################
EOF

echo "Restarting mosquitto..."
systemctl restart mosquitto

echo "Done. Mosquitto now listens on WSS port 9002."
