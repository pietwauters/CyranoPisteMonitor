// enrolment.js
import express from 'express';
import fs from 'fs';
import { execFile } from 'child_process';
import path from 'path';

const router = express.Router();
const CA_PATH = '/var/lib/scoring-broker/ca';
const DEVICES_PATH = '/var/lib/scoring-broker/devices';

// Middleware: check pairing mode
let pairingEnabled = false; // only true for short periods
router.use((req, res, next) => {
  if (!pairingEnabled) return res.status(403).send('Pairing disabled');
  next();
});

// Enable pairing endpoint (could be protected by PIN)
router.post('/enable-pairing', (req, res) => {
  pairingEnabled = true;
  setTimeout(() => { pairingEnabled = false }, 2 * 60 * 1000); // 2 min
  res.send('Pairing enabled for 2 minutes');
});

// Device CSR submission
router.post('/enrol', express.json(), (req, res) => {
  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) return res.status(400).send('Missing parameters');

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(DEVICES_PATH, `${deviceId}.crt`);

  fs.writeFileSync(csrFile, csrPem);

  // Sign CSR using CA
  execFile('openssl', [
    'x509', '-req',
    '-in', csrFile,
    '-CA', path.join(CA_PATH, 'ca.crt'),
    '-CAkey', path.join(CA_PATH, 'ca.key'),
    '-CAcreateserial',
    '-out', certFile,
    '-days', '365',
    '-sha256'
  ], (err) => {
    fs.unlinkSync(csrFile); // cleanup CSR

    if (err) {
      console.error(err);
      return res.status(500).send('Failed to sign certificate');
    }

    // Return device certificate
    const certPem = fs.readFileSync(certFile, 'utf8');
    res.send({ cert: certPem });
  });
});

export default router;
