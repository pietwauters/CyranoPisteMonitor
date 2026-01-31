#!/bin/bash
# Setup HTTPS for mqtt-web server
# Run this script on the server after git pull

set -e

echo "=== Setting up HTTPS for mqtt-web ==="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Working directory: $SCRIPT_DIR"

# Get server's IP address
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"

# Generate self-signed certificate if it doesn't exist
if [ ! -f "server.key" ] || [ ! -f "server.cert" ]; then
    echo "Generating SSL certificate..."
    openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$SERVER_IP"
    
    # Set proper permissions
    chmod 600 server.key
    chmod 644 server.cert
    
    echo "✓ SSL certificate generated at $SCRIPT_DIR"
else
    echo "✓ SSL certificate already exists"
fi

# Restart the service
echo "Restarting mqtt-web..."

# Check if running under PM2
if command -v pm2 &> /dev/null && pm2 list | grep -q "mqtt-web"; then
    echo "Found PM2 process, restarting..."
    pm2 restart mqtt-web
elif systemctl is-active --quiet mqtt-web.service 2>/dev/null; then
    echo "Found systemd service, restarting..."
    sudo systemctl restart mqtt-web.service
else
    echo "Warning: Could not find running service."
    echo "You may need to manually restart the server with:"
    echo "  pm2 restart mqtt-web"
    echo "  OR"
    echo "  sudo systemctl restart mqtt-web.service"
fi

echo ""
echo "=== HTTPS Setup Complete ==="
echo "Server is now accessible at:"
echo "  https://$SERVER_IP:3000"
echo ""
echo "Note: You'll need to accept the security warning in your browser"
echo "on first visit (Advanced -> Proceed to site)"
