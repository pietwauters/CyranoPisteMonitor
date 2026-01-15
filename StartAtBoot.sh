#!/bin/bash
# Enable MQTT Web Dashboard to start at boot

# Get the current directory and user
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURRENT_USER="$USER"

echo "Setting up MQTT Web Dashboard service..."
echo "User: $CURRENT_USER"
echo "Directory: $SCRIPT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

NODE_PATH=$(which node)
echo "Node.js path: $NODE_PATH"

# Create the service file
SERVICE_FILE="/tmp/mqtt-web.service"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=MQTT Web Dashboard
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_PATH $SCRIPT_DIR/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mqtt-web

[Install]
WantedBy=multi-user.target
EOF

# Copy service file to systemd
echo "Installing service (requires sudo)..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/mqtt-web.service
sudo systemctl daemon-reload
sudo systemctl enable mqtt-web.service
sudo systemctl start mqtt-web.service

# Clean up
rm "$SERVICE_FILE"

echo ""
echo "✓ Service installed and started successfully!"
echo ""
echo "Useful commands:"
echo "  Check status:  sudo systemctl status mqtt-web.service"
echo "  View logs:     sudo journalctl -u mqtt-web.service -f"
echo "  Stop service:  sudo systemctl stop mqtt-web.service"
echo "  Restart:       sudo systemctl restart mqtt-web.service"
echo ""
echo "The server will now start automatically at boot."
echo "Access the dashboard at: http://localhost:3000"
