const express = require('express');
const mqtt = require('mqtt');
const app = express();
const port = 3000;

// Serve static files (HTML/CSS/JS)
app.use(express.static('public'));

// Admin page route
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Piste Management page route
app.get('/piste-mgt', (req, res) => {
  res.sendFile(__dirname + '/public/piste-mgt.html');
});

// Direct piste display route
app.get('/piste/:number', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// MQTT Client Configuration
const mqttBroker = 'mqtt://localhost:1883';
const client = mqtt.connect(mqttBroker);

client.on('connect', () => {
  console.log('Connected to MQTT broker');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
