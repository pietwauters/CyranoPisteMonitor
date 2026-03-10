const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const router = require('express').Router();

const PAIRING_FILE = '/var/lib/scoring-broker/pairing.json';
const ENROLMENT_CA = '/home/atlas/scoring-broker/ca';
const ENROLMENT_DEVICES = '/home/atlas/scoring-broker/devices';

function isPairingEnabled() {
  try {
    const data = JSON.parse(fs.readFileSync(PAIRING_FILE, 'utf8'));
    if (!data.enabled) return false;
    return data.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// -----------------
// Enable pairing endpoint
// -----------------
router.post('/pairing/enable', (req, res) => {
  execFile('/usr/local/bin/enable-pairing.sh', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to enable pairing');
    }
    res.send('Pairing enabled for 2 minutes');
  });
});

// -----------------
// Device enrolment
// -----------------
router.post('/enrol', (req, res) => {
  if (!isPairingEnabled()) return res.status(403).send('Pairing disabled');

  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) return res.status(400).send('Missing parameters');

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(ENROLMENT_DEVICES, `${deviceId}.crt`);

  try { fs.writeFileSync(csrFile, csrPem); }
  catch (err) { return res.status(500).send('Failed to write CSR'); }

  execFile('sudo', ['/usr/local/bin/sign-device-cert.sh', csrFile, certFile],
    (error, stdout, stderr) => {
      if (error) return res.status(500).send('Failed to sign certificate');

      try {
        fs.unlinkSync(csrFile);
        const certPem = fs.readFileSync(certFile, 'utf8');
        res.json({
          deviceCert: certPem,
          caCert: fs.readFileSync(path.join(ENROLMENT_CA, 'ca.crt'), 'utf8')
        });
        console.log(`Device ${deviceId} enrolled successfully`);
      } catch (err) {
        console.error(err);
        res.status(500).send('Post-signing error');
      }
    }
  );
});

module.exports = router;