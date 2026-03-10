const fs = require('fs');
const { PAIRING_FILE } = require('./paths');

function isPairingEnabled() {
  try {
    const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
    if (!data.enabled) return false;

    const now = Math.floor(Date.now() / 1000);
    return data.expiresAt > now;
  } catch {
    return false;
  }
}

module.exports = { isPairingEnabled };