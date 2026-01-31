#!/bin/bash
# Setup HTTPS for mqtt-web server
# Run this script on the server after git pull

set -e

echo "=== Setting up HTTPS for mqtt-web ==="

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
    
    echo "✓ SSL certificate generated"
else
    echo "✓ SSL certificate already exists"
fi

# Restart the service
echo "Restarting mqtt-web service..."
sudo systemctl restart mqtt-web.service

echo ""
echo "=== HTTPS Setup Complete ==="
echo "Server is now accessible at:"
echo "  https://$SERVER_IP:3000"
echo ""
echo "Note: You'll need to accept the security warning in your browser"
echo "on first visit (Advanced -> Proceed to site)"
