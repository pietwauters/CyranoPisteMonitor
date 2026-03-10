const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const router = express.Router();
const { isPairingEnabled } = require('./helpers');
const { ENROLMENT_CA, ENROLMENT_DEVICES } = require('./paths');

// Enable pairing endpoint
router.post('/pairing/enable', (req, res) => {
  execFile('/usr/local/bin/enable-pairing.sh', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to enable pairing');
    }
    res.send('Pairing enabled for 2 minutes');
  });
});

// Device enrolment endpoint
router.post('/enrol', (req, res) => {
  if (!isPairingEnabled()) return res.status(403).send('Pairing disabled');

  const { deviceId, csrPem } = req.body;
  if (!deviceId || !csrPem) return res.status(400).send('Missing parameters');

  const csrFile = path.join('/tmp', `${deviceId}.csr`);
  const certFile = path.join(ENROLMENT_DEVICES, `${deviceId}.crt`);

  try {
    fs.writeFileSync(csrFile, csrPem);
  } catch (err) {
    console.error('Failed to write CSR:', err);
    return res.status(500).send('Failed to write CSR');
  }

  execFile(
    'sudo',
    ['/usr/local/bin/sign-device-cert.sh', csrFile, certFile],
    (error, stdout, stderr) => {
      if (error) {
        console.error('Signing failed:', stderr || error);
        return res.status(500).send('Failed to sign certificate');
      }

      try {
        fs.unlinkSync(csrFile); // cleanup CSR
        const certPem = fs.readFileSync(certFile, 'utf8');
        res.json({
          deviceCert: certPem,
          caCert: fs.readFileSync(`${ENROLMENT_CA}/ca.crt`, 'utf8')
        });

        console.log(`Device ${deviceId} enrolled successfully`);
      } catch (err) {
        console.error('Post-signing error:', err);
        res.status(500).send('Failed after signing');
      }
    }
  );
});

module.exports = router;