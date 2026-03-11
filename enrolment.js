const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const router = express.Router();

const CA_DIR = "/home/atlas/scoring-broker/ca";
const DEVICES_DIR = "/home/atlas/scoring-broker/devices";



// === Pairing state ===
let pairing = {
  enabled: false,
  expires: 0,
  challenge: null,
  deviceId: null
};

// HMAC helper
function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

function isPairingValid() {
  if (!pairing.enabled) return false;
  if (Date.now() > pairing.expires) {
    pairing.enabled = false;
    pairing.challenge = null;
    pairing.deviceId = null;
    return false;
  }
  return true;
}

// Operator enables pairing (localhost only)
router.post("/pairing/enable", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!ip.startsWith("127.") && ip !== "::1") return res.status(403).send("Forbidden");

  pairing.enabled = true;
  pairing.expires = Date.now() + 2 * 60 * 1000;
  console.log("[PAIRING] Enabled for 2 minutes by operator from", ip);
  res.send("Pairing enabled for 2 minutes");
});

// ESP requests challenge
router.post("/pair/start", express.json(), (req, res) => {
  if (!isPairingValid()) return res.status(403).send("Pairing not enabled");

  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).send("Missing deviceId");

  pairing.deviceId = deviceId;
  pairing.challenge = crypto.randomBytes(16).toString("hex");

  console.log("Pair start request from", deviceId);
  console.log("Generated challenge:", pairing.challenge);

  res.json({ challenge: pairing.challenge });
});

// ESP enrol
router.post("/enrol", express.json({ limit: "10kb" }), (req, res) => {
  const { deviceId, csrPem, auth } = req.body;
  if (!isPairingValid()) return res.status(403).send("Pairing window expired");
  if (!deviceId || !csrPem || !auth) return res.status(400).send("Missing parameters");

  if (deviceId !== pairing.deviceId) return res.status(403).send("Device not authorized");

  // verify HMAC using the stored challenge
  const expectedHmac = hmacSha256(pairing.challenge, deviceId + csrPem);
  if (expectedHmac !== auth) {
    console.log("[ENROL] HMAC mismatch for device:", deviceId);
    return res.status(403).send("Authentication failed");
  }

  console.log("[ENROL] HMAC verified for device:", deviceId);

  const csrPath = `/tmp/${deviceId}.csr`;
  const certPath = path.join(DEVICES_DIR, `${deviceId}.crt`);
  fs.writeFileSync(csrPath, csrPem);

  try {
    execFileSync("/usr/local/bin/sign-device-cert.sh", [csrPath, certPath]);
    console.log(`[ENROL] Certificate signed at ${certPath}`);
  } catch (err) {
    console.error("[ENROL] Signing failed:", err);
    return res.status(500).send("Signing failed");
  }

  const deviceCert = fs.readFileSync(certPath, "utf8");
  const caCert = fs.readFileSync(path.join(CA_DIR, "ca.crt"), "utf8");

  // Clear pairing
  pairing.enabled = false;
  pairing.challenge = null;
  pairing.deviceId = null;
  pairing.expires = 0;

  res.json({ deviceCert, caCert });
});


module.exports = router;