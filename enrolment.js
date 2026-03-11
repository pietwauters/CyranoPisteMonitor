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
  deviceId: null,
  code: null,
  challenge: null,
  confirmed: false
};

// Utility: reset pairing state
function resetPairing() {
  pairing.enabled = false;
  pairing.expires = 0;
  pairing.deviceId = null;
  pairing.code = null;
  pairing.challenge = null;
  pairing.confirmed = false;
}

// Utility: check pairing window
function isPairingValid() {
  if (!pairing.enabled) return false;

  if (Date.now() > pairing.expires) {
    console.log("[PAIRING] Pairing window expired");
    resetPairing();
    return false;
  }

  return true;
}

// HMAC helper
function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

//
// ====================
// Operator: Enable pairing
// ====================
router.post("/pairing/enable", (req, res) => {

  const ip = req.ip || req.connection.remoteAddress;

  if (!ip.startsWith("127.") && ip !== "::1") {
    return res.status(403).send("Forbidden: operator-only endpoint");
  }

  resetPairing();

  pairing.enabled = true;
  pairing.expires = Date.now() + 2 * 60 * 1000;

  console.log("[PAIRING] Enabled for 2 minutes by operator from", ip);

  res.send("Pairing enabled for 2 minutes");
});

//
// ====================
// ESP: Start pairing
// ====================
router.post("/pair/start", express.json(), (req, res) => {

  if (!isPairingValid()) {
    return res.status(403).send("Pairing not enabled");
  }

  const { deviceId, pairingCode } = req.body;

  if (!deviceId || !pairingCode) {
    return res.status(400).send("Missing parameters");
  }

  if (!pairing.deviceId) {
    console.log("[PAIRING] Pair start request from", deviceId);
    console.log("[PAIRING] Device pairing code:", pairingCode);

    pairing.deviceId = deviceId;
    pairing.code = pairingCode;
  }

  // If operator has confirmed, return challenge
  if (pairing.confirmed && pairing.challenge) {
    return res.json({ challenge: pairing.challenge });
  }

  // otherwise tell ESP to wait
  res.json({ status: "waiting_for_operator" });
});
//
// ====================
// Operator: Confirm pairing code
// ====================
router.post("/pair/confirm", express.json(), (req, res) => {

  const { pairingCode } = req.body;

  if (!pairing.deviceId) {
    return res.status(400).send("No device waiting for pairing");
  }

  if (pairingCode !== pairing.code) {
    console.log("[PAIRING] Wrong code entered by operator");
    return res.status(403).send("Invalid pairing code");
  }

  pairing.confirmed = true;

  pairing.challenge = crypto.randomBytes(16).toString("hex");

  console.log("[PAIRING] Operator confirmed device:", pairing.deviceId);
  console.log("[PAIRING] Challenge generated");

  res.send("Pairing confirmed");
});

//
// ====================
// ESP: Enrol device
// ====================
router.post("/enrol", express.json({ limit: "10kb" }), (req, res) => {

  console.log("[ENROL] Received enrol request");

  if (!isPairingValid()) {
    return res.status(403).send("Pairing not enabled or expired");
  }

  const { deviceId, csrPem, auth } = req.body;

  if (!deviceId || !csrPem || !auth) {
    return res.status(400).send("Missing parameters");
  }

  if (!pairing.confirmed) {
    return res.status(403).send("Pairing not confirmed by operator");
  }

  if (deviceId !== pairing.deviceId) {
    console.log("[ENROL] Unexpected device:", deviceId);
    return res.status(403).send("Unexpected device");
  }

  const expectedHmac = hmacSha256(
    pairing.code,
    deviceId + csrPem + pairing.challenge
  );

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
    console.log("[ENROL] Certificate signed:", certPath);
  } catch (err) {
    console.error("[ENROL] Signing failed:", err);
    return res.status(500).send("Signing failed");
  }

  const deviceCert = fs.readFileSync(certPath, "utf8");
  const caCert = fs.readFileSync(path.join(CA_DIR, "ca.crt"), "utf8");

  console.log("[PAIRING] Completed for", deviceId);

  resetPairing();

  res.json({
    deviceCert,
    caCert
  });
});

module.exports = router;