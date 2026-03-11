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
  expires: 0
};

// Utility: is pairing window still valid
function isPairingValid() {
  return pairing.enabled && Date.now() < pairing.expires;
}

// HMAC helper
function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

// ====================
// Operator-only: Enable pairing
// Accept requests only from localhost
// ====================
router.post("/pairing/enable", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!ip.startsWith("127.") && ip !== "::1") {
    return res.status(403).send("Forbidden: operator-only endpoint");
  }

  pairing.enabled = true;
  pairing.expires = Date.now() + 2 * 60 * 1000; // 2 min window
  console.log("[PAIRING] Enabled for 2 minutes by operator from", ip);

  res.send("Pairing enabled for 2 minutes");
});

router.post("/pair/start", express.json(), (req, res) => {

  if (!isPairingValid()) {
    return res.status(403).send("Pairing not enabled");
  }

  const { deviceId, pairingCode } = req.body;

  if (!deviceId || !pairingCode) {
    return res.status(400).send("Missing parameters");
  }

  console.log("Pair start request from", deviceId);
  console.log("Device pairing code:", pairingCode);

  // store pending device
  pairing.deviceId = deviceId;
  pairing.code = pairingCode;

  // generate challenge
  const challenge = crypto.randomBytes(16).toString("hex");
  pairing.challenge = challenge;

  res.json({ challenge });

});

// ====================
// ESP: Enrol device
// ====================
router.post("/enrol", express.json({ limit: "10kb" }), (req, res) => {
  console.log("[ENROL] Received enrol request");

  if (!isPairingValid()) {
    console.log("[ENROL] Pairing window not enabled or expired");
    return res.status(403).send("Pairing not enabled or expired");
  }

  const { deviceId, csrPem, auth } = req.body;

  if (!deviceId || !csrPem || !auth) {
    console.log("[ENROL] Missing parameters in request body");
    return res.status(400).send("Missing parameters");
  }

  // ESP pairing code is generated locally by the device
  // HMAC is computed using (deviceId + csrPem)
  const expectedHmac = hmacSha256(pairing.code, deviceId + csrPem + pairing.challenge);

  if (expectedHmac !== auth) {
    console.log("[ENROL] HMAC mismatch for device:", deviceId);
    return res.status(403).send("Authentication failed");
  }

  console.log("[ENROL] HMAC verified for device:", deviceId);

  // Paths for CSR and signed cert
  const csrPath = `/tmp/${deviceId}.csr`;
  const certPath = path.join(DEVICES_DIR, `${deviceId}.crt`);

  // Write CSR to temp file
  fs.writeFileSync(csrPath, csrPem);
  console.log(`[ENROL] CSR written to ${csrPath}`);

  // Sign device certificate
  try {
    execFileSync("/usr/local/bin/sign-device-cert.sh", [csrPath, certPath]);
    console.log(`[ENROL] Certificate signed at ${certPath}`);
  } catch (err) {
    console.error("[ENROL] Signing failed:", err);
    return res.status(500).send("Signing failed");
  }

  // Read signed certificate and CA
  const deviceCert = fs.readFileSync(certPath, "utf8");
  const caCert = fs.readFileSync(path.join(CA_DIR, "ca.crt"), "utf8");

  // Disable pairing window after successful enrolment
  pairing.enabled = false;
  console.log("[PAIRING] Pairing disabled after enrolment of", deviceId);

  res.json({
    deviceCert,
    caCert
  });
});

module.exports = router;