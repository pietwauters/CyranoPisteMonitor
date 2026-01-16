#!/usr/bin/env bash
# Disable MQTT Web Dashboard startup (supports PM2-managed processes)

APP_USER="${SUDO_USER:-$USER}"
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Disabling MQTT Web Dashboard startup for user: $APP_USER"

# If pm2 is managing the app for the app user, stop and remove pm2 entry
if command -v pm2 &>/dev/null; then
    echo "Stopping pm2-managed app (if running) as $APP_USER..."
    sudo -u "$APP_USER" pm2 delete mqtt-web || true
    sudo -u "$APP_USER" pm2 save || true
fi

# Remove any systemd pm2 unit for the app user
PM2_UNIT="pm2-$APP_USER.service"
if sudo systemctl list-unit-files --type=service | grep -q "^${PM2_UNIT}"; then
    echo "Removing systemd unit $PM2_UNIT..."
    sudo systemctl stop "$PM2_UNIT" || true
    sudo systemctl disable "$PM2_UNIT" || true
    sudo rm -f /etc/systemd/system/$PM2_UNIT
    sudo systemctl daemon-reload || true
fi

echo "Removing legacy mqtt-web.service if present..."
if [ -f /etc/systemd/system/mqtt-web.service ]; then
    sudo systemctl stop mqtt-web.service || true
    sudo systemctl disable mqtt-web.service || true
    sudo rm -f /etc/systemd/system/mqtt-web.service
    sudo systemctl daemon-reload || true
fi

echo ""
echo "✓ Startup disabled for mqtt-web (pm2/systemd cleaned)."
echo "You can still run the server manually: cd $APP_DIR && node server.js"
