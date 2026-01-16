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

# StartAtBoot.sh — safe PM2 setup for running mqtt-web as the app user
# Usage: run as the app user (recommended) or with sudo; script will
# detect the original user and ensure pm2 processes run under that user.

APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# prefer SUDO_USER if the script was invoked with sudo, otherwise current user
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

# Install pm2 globally if missing (requires sudo)
if ! command -v pm2 &>/dev/null; then
    echo "Installing pm2 globally..."
    sudo npm install -g pm2
fi

# Ensure PM2 home directory exists and is owned by the app user
sudo mkdir -p "$HOME_DIR/.pm2"
sudo chown -R "$APP_USER":"$APP_USER" "$HOME_DIR/.pm2"

echo "Starting app under PM2 as user $APP_USER (one process per CPU)..."
# Start the app as the app user so PM2 and processes are owned by that user
sudo -u "$APP_USER" pm2 start server.js -i max --name mqtt-web --cwd "$APP_DIR"

echo "Saving PM2 process list (as $APP_USER)..."
sudo -u "$APP_USER" pm2 save

echo "Configuring PM2 to start on boot for user $APP_USER..."
# This creates the systemd unit (runs as root) but targets the app user
sudo pm2 startup systemd -u "$APP_USER" --hp "$HOME_DIR"

echo "Done. Check status with: sudo -u $APP_USER pm2 status"
echo "View logs: sudo -u $APP_USER pm2 logs mqtt-web"
