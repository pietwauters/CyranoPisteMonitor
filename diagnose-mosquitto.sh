#!/bin/bash
# Diagnose Mosquitto SSL configuration issues

echo "=== Mosquitto SSL Configuration Diagnostics ==="
echo ""

echo "1. Checking Mosquitto service status..."
sudo systemctl status mosquitto.service --no-pager -l

echo ""
echo "2. Checking recent Mosquitto logs..."
sudo journalctl -xeu mosquitto.service --no-pager -n 30

echo ""
echo "3. Checking certificate files..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$SCRIPT_DIR/server.cert" ]; then
    echo "✓ server.cert exists at: $SCRIPT_DIR/server.cert"
    ls -lh "$SCRIPT_DIR/server.cert"
else
    echo "✗ server.cert NOT found at: $SCRIPT_DIR/server.cert"
fi

if [ -f "$SCRIPT_DIR/server.key" ]; then
    echo "✓ server.key exists at: $SCRIPT_DIR/server.key"
    ls -lh "$SCRIPT_DIR/server.key"
else
    echo "✗ server.key NOT found at: $SCRIPT_DIR/server.key"
fi

echo ""
echo "4. Checking Mosquitto configuration files..."
echo "Main config:"
cat /etc/mosquitto/mosquitto.conf 2>/dev/null || echo "Cannot read main config"

echo ""
echo "Additional configs in conf.d:"
ls -la /etc/mosquitto/conf.d/ 2>/dev/null || echo "No conf.d directory"

if [ -d /etc/mosquitto/conf.d/ ]; then
    for conf in /etc/mosquitto/conf.d/*.conf; do
        if [ -f "$conf" ]; then
            echo ""
            echo "--- Content of $conf ---"
            cat "$conf"
        fi
    done
fi

echo ""
echo "5. Testing Mosquitto configuration..."
mosquitto -c /etc/mosquitto/mosquitto.conf -t 2>&1 || echo "Configuration test failed"
