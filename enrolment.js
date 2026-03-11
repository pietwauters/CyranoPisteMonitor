const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const router = express.Router();

const CA_DIR = "/home/atlas/scoring-broker/ca";
const DEVICES_DIR = "/home/atlas/scoring-broker/devices";

let pairing = {
  enabled: false,
  code: null,
  expires: 0
};

function isPairingValid() {
  return pairing.enabled && Date.now() < pairing.expires;
}

function hmacSha256(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

router.post("/pairing/enable", (req, res) => {
  pairing.enabled = true;
  pairing.expires = Date.now() + 2 * 60 * 1000;
  pairing.code = null; // will be set by device

  console.log("Pairing enabled for 2 minutes");
  res.send("Pairing enabled for 2 minutes");
});

const pairingChallenges = {};

router.post("/pair/start", express.json({ limit: "2kb" }), (req, res) => {
  if (!pairing.enabled || Date.now() > pairing.expires) {
    return res.status(403).send("Pairing not enabled or expired");
  }

  const { deviceId, pairingCode } = req.body;
  if (!deviceId || !pairingCode) {
    return res.status(400).send("Missing deviceId or pairingCode");
  }

  // Store the ESP pairing code for HMAC
  pairing.code = pairingCode;

  // Generate a challenge for the ESP
  const challenge = crypto.randomBytes(6).toString("hex"); // 12 hex chars
  pairingChallenges[deviceId] = challenge;

  console.log(`Device ${deviceId} requested pairing with code ${pairingCode}, challenge=${challenge}`);

  res.json({ challenge });
});


router.post("/enrol", express.json({ limit: "10kb" }), (req, res) => {

  if (!isPairingValid()) {
    return res.status(403).send("Pairing not enabled or expired");
  }

  const { deviceId, csrPem, auth } = req.body;

  if (!deviceId || !csrPem || !auth) {
    return res.status(400).send("Missing parameters");
  }

  const msg = deviceId + csrPem;

  const expected = hmacSha256(pairing.code, msg);

  if (expected !== auth) {
    console.log("HMAC mismatch");
    return res.status(403).send("Authentication failed");
  }

  console.log("HMAC verified for device:", deviceId);

  const csrPath = `/tmp/${deviceId}.csr`;
  const certPath = path.join(DEVICES_DIR, `${deviceId}.crt`);

  fs.writeFileSync(csrPath, csrPem);

  try {

    execFileSync("/usr/local/bin/sign-device-cert.sh", [
      csrPath,
      certPath
    ]);

  } catch (err) {

    console.error("Signing failed:", err);
    return res.status(500).send("Signing failed");
  }

  const deviceCert = fs.readFileSync(certPath, "utf8");
  const caCert = fs.readFileSync(path.join(CA_DIR, "ca.crt"), "utf8");

  pairing.enabled = false;

  res.json({
    deviceCert,
    caCert
  });

});

module.exports = router;