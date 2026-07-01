const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const router = express.Router();

const CA_DIR = "/home/atlas/scoring-broker/ca";
const DEVICES_DIR = "/home/atlas/scoring-broker/devices";

// Loaded on first enrolment and cached — ca.crt requires elevated permissions
// not guaranteed at startup time.
let caCert = null;
function getCaCert() {
  if (!caCert) caCert = fs.readFileSync(path.join(CA_DIR, "ca.crt"), "utf8");
  return caCert;
}



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
router.post("/enrol", express.json({ limit: "10kb" }), async (req, res) => {
  const { deviceId, csrPem, auth } = req.body;
  if (!isPairingValid()) return res.status(403).send("Pairing window expired");
  if (!deviceId || !csrPem || !auth) return res.status(400).send("Missing parameters");

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(deviceId))
    return res.status(400).send("Invalid deviceId");

  if (deviceId !== pairing.deviceId) return res.status(403).send("Device not authorized");

  // verify HMAC using the stored challenge (constant-time comparison prevents timing attacks)
  const expectedHmac = hmacSha256(pairing.challenge, deviceId + csrPem);
  const expectedBuf  = Buffer.from(expectedHmac, 'hex');
  const actualBuf    = Buffer.from(typeof auth === 'string' ? auth : '', 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    console.log("[ENROL] HMAC mismatch for device:", deviceId);
    return res.status(403).send("Authentication failed");
  }

  console.log("[ENROL] HMAC verified for device:", deviceId);

  const csrPath = `/tmp/${deviceId}.csr`;
  const certPath = path.join(DEVICES_DIR, `${deviceId}.crt`);
  await fs.promises.writeFile(csrPath, csrPem);

  try {
    await execFileAsync("/usr/local/bin/sign-device-cert.sh", [csrPath, certPath]);
    console.log(`[ENROL] Certificate signed at ${certPath}`);
  } catch (err) {
    console.error("[ENROL] Signing failed:", err);
    return res.status(500).send("Signing failed");
  } finally {
    fs.promises.unlink(csrPath).catch(() => {});
  }

  const deviceCert = await fs.promises.readFile(certPath, "utf8");

  // Clear pairing
  pairing.enabled = false;
  pairing.challenge = null;
  pairing.deviceId = null;
  pairing.expires = 0;

  res.json({ deviceCert, caCert: getCaCert() });
});


module.exports = router;