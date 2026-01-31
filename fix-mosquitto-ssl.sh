#!/bin/bash
# Fix Mosquitto SSL configuration

set -e

echo "=== Fixing Mosquitto SSL Configuration ==="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if certificates exist
if [ ! -f "$SCRIPT_DIR/server.cert" ] || [ ! -f "$SCRIPT_DIR/server.key" ]; then
    echo "Error: Certificate files not found!"
    echo "Please run ./setup-https.sh first"
    exit 1
fi

# Create mosquitto certs directory if it doesn't exist
echo "Creating certificate directory for Mosquitto..."
sudo mkdir -p /etc/mosquitto/certs-web

# Copy certificates to mosquitto-readable location
echo "Copying certificates to /etc/mosquitto/certs-web/..."
sudo cp "$SCRIPT_DIR/server.cert" /etc/mosquitto/certs-web/
sudo cp "$SCRIPT_DIR/server.key" /etc/mosquitto/certs-web/

# Set proper permissions
echo "Setting proper permissions..."
sudo chown mosquitto:mosquitto /etc/mosquitto/certs-web/server.cert
sudo chown mosquitto:mosquitto /etc/mosquitto/certs-web/server.key
sudo chmod 644 /etc/mosquitto/certs-web/server.cert
sudo chmod 600 /etc/mosquitto/certs-web/server.key

# Backup existing mosquitto config
echo "Backing up mosquitto.conf..."
sudo cp /etc/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf.backup.$(date +%Y%m%d-%H%M%S)

# Remove the problematic SSL websocket config from main config
echo "Fixing mosquitto configuration..."
sudo sed -i '/^# WebSocket listener (secure - for HTTPS)/,/^keyfile \/home\/atlas/d' /etc/mosquitto/mosquitto.conf

# Add corrected SSL websocket config
echo "Adding corrected SSL websocket listener..."
sudo tee -a /etc/mosquitto/mosquitto.conf > /dev/null << 'EOF'

# WebSocket listener (secure - for HTTPS)
listener 9002
protocol websockets
certfile /etc/mosquitto/certs-web/server.cert
keyfile /etc/mosquitto/certs-web/server.key
allow_anonymous true
EOF

echo ""
echo "Configuration updated. Testing..."

# Try to start mosquitto
echo "Restarting Mosquitto..."
if sudo systemctl restart mosquitto; then
    echo ""
    echo "✓ Mosquitto restarted successfully!"
    echo ""
    echo "WebSocket listeners:"
    echo "  - ws://  (insecure) on port 9001"
    echo "  - wss:// (secure)   on port 9002"
    echo ""
    sudo systemctl status mosquitto --no-pager -l
else
    echo ""
    echo "✗ Failed to restart Mosquitto"
    echo "Check logs with: sudo journalctl -xeu mosquitto.service"
    exit 1
fi
