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

#!/usr/bin/env bash
set -euo pipefail

# StartAtBoot.sh — switch startup to PM2-based process manager
# This script will:
#  - install PM2 if missing
#  - remove the old systemd unit `mqtt-web.service` if present
#  - start the app under PM2 with one process per CPU
#  - configure PM2 to resurrect processes at boot

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_USER="${SUDO_USER:-$USER}"
HOME_DIR="$(eval echo ~${APP_USER})"

echo "App dir: $APP_DIR"
echo "App user: $APP_USER"

cd "$APP_DIR"

# Ensure Node.js is available
if ! command -v node &>/dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install pm2 if missing
if ! command -v pm2 &>/dev/null; then
    echo "Installing pm2 globally... (requires sudo)"
    sudo npm install -g pm2
fi

# Remove old systemd unit if it exists
if sudo systemctl list-unit-files --type=service | grep -q '^mqtt-web.service'; then
    echo "Removing existing mqtt-web.service..."
    sudo systemctl stop mqtt-web.service || true
    sudo systemctl disable mqtt-web.service || true
    sudo rm -f /etc/systemd/system/mqtt-web.service
    sudo systemctl daemon-reload || true
fi

echo "Starting app under PM2 (one process per CPU)..."
pm2 start server.js -i max --name mqtt-web --cwd "$APP_DIR"

echo "Configuring PM2 to start on boot for user $APP_USER..."
# Create the systemd startup unit for PM2 (runs as the app user)
sudo pm2 startup systemd -u "$APP_USER" --hp "$HOME_DIR"

echo "Saving PM2 process list for resurrection on reboot..."
pm2 save

echo "Done. Check status with: pm2 status"
echo "View logs: pm2 logs mqtt-web"
