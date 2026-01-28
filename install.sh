#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then
  echo "ERROR: This script must be run with bash (not sh)"
  exit 1
fi

set -euo pipefail

### CONFIG #########################################################
BROKER_NAME="CyranoBroker"
BASE_DIR="/var/lib/scoring-broker"
CA_DIR="$BASE_DIR/ca"
BROKER_DIR="$BASE_DIR/broker"
MOSQ_CERT_DIR="/etc/mosquitto/certs"
MOSQ_CONF="/etc/mosquitto/mosquitto.conf"

DAYS_CA=3650
DAYS_BROKER=825
###################################################################

echo "==> Installing scoring broker identity for ${BROKER_NAME}"

### 1. Ensure required packages ##################################
echo "==> Installing required packages"
apt update
apt install -y mosquitto openssl avahi-daemon

### 2. Create directory structure #################################
echo "==> Creating directory structure"
mkdir -p "$CA_DIR" "$BROKER_DIR" "$MOSQ_CERT_DIR"

chmod 750 "$BASE_DIR"
chmod 750 "$CA_DIR" "$BROKER_DIR"

### 3. Generate CA #################################################
if [[ ! -f "$CA_DIR/ca.key" ]]; then
  echo "==> Generating CA"
  openssl genrsa -out "$CA_DIR/ca.key" 4096

  openssl req -x509 -new -nodes \
    -key "$CA_DIR/ca.key" \
    -sha256 \
    -days "$DAYS_CA" \
    -out "$CA_DIR/ca.crt" \
    -subj "/CN=${BROKER_NAME}-CA"
else
  echo "==> CA already exists, skipping"
fi

### 4. Generate Broker Certificate ################################
if [[ ! -f "$BROKER_DIR/broker.key" ]]; then
  echo "==> Generating broker certificate"
  openssl genrsa -out "$BROKER_DIR/broker.key" 2048

  openssl req -new \
    -key "$BROKER_DIR/broker.key" \
    -out "$BROKER_DIR/broker.csr" \
    -subj "/CN=${BROKER_NAME}"

  cat > "$BROKER_DIR/broker.ext" <<EOF
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${BROKER_NAME}
DNS.2 = ${BROKER_NAME}.local
EOF

  openssl x509 -req \
    -in "$BROKER_DIR/broker.csr" \
    -CA "$CA_DIR/ca.crt" \
    -CAkey "$CA_DIR/ca.key" \
    -CAcreateserial \
    -out "$BROKER_DIR/broker.crt" \
    -days "$DAYS_BROKER" \
    -sha256 \
    -extfile "$BROKER_DIR/broker.ext"
else
  echo "==> Broker certificate already exists, skipping"
fi

### 5. Install certificates for Mosquitto #########################
echo "==> Installing certificates for Mosquitto"
cp "$CA_DIR/ca.crt" "$MOSQ_CERT_DIR/ca.crt"
cp "$BROKER_DIR/broker.crt" "$MOSQ_CERT_DIR/server.crt"
cp "$BROKER_DIR/broker.key" "$MOSQ_CERT_DIR/server.key"

### 6. Permissions #################################################
echo "==> Setting permissions"
chown -R root:root "$BASE_DIR"
chown -R root:mosquitto "$MOSQ_CERT_DIR"

chmod 750 "$BASE_DIR"
chmod 750 "$CA_DIR" "$BROKER_DIR"
chmod 640 "$CA_DIR/ca.crt"
chmod 600 "$CA_DIR/ca.key"
chmod 640 "$BROKER_DIR/broker.crt"
chmod 600 "$BROKER_DIR/broker.key"
chmod 640 "$MOSQ_CERT_DIR/"*

### 7. Mosquitto configuration ####################################
if ! grep -q "CyranoBroker TLS" "$MOSQ_CONF"; then
  echo "==> Updating mosquitto.conf"

  cat >> "$MOSQ_CONF" <<'EOF'

##### CyranoBroker TLS ############################################
listener 8883
cafile /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
tls_version tlsv1.2
require_certificate false
allow_anonymous true
##################################################################
EOF
else
  echo "==> mosquitto.conf already updated"
fi

### 8. mDNS ########################################################
echo "==> Ensuring mDNS hostname ${BROKER_NAME}.local"
hostnamectl set-hostname "$BROKER_NAME"
systemctl enable avahi-daemon
systemctl restart avahi-daemon

### 9. Restart Mosquitto ##########################################
echo "==> Restarting Mosquitto"
systemctl restart mosquitto
systemctl enable mosquitto

echo
echo "✅ Scoring broker installed successfully"
echo "Broker name: ${BROKER_NAME}.local"
echo "CA certificate: $CA_DIR/ca.crt"
