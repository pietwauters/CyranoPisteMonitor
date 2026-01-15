#!/bin/bash
# Disable MQTT Web Dashboard from starting at boot

echo "Disabling MQTT Web Dashboard service..."

# Check if service exists
if [ ! -f /etc/systemd/system/mqtt-web.service ]; then
    echo "Service is not installed."
    exit 0
fi

# Stop and disable the service
sudo systemctl stop mqtt-web.service
sudo systemctl disable mqtt-web.service
sudo rm /etc/systemd/system/mqtt-web.service
sudo systemctl daemon-reload

echo ""
echo "✓ Service disabled and removed successfully!"
echo "The server will no longer start at boot."
echo ""
echo "You can still run it manually with: node server.js"
