/**
 * test-publisher.js - OPP2 Test Message Publisher
 * 
 * Publishes sample OPP2 messages to test the web display.
 * 
 * Usage:
 *   node test-publisher.js [piste_id]
 * 
 * Example:
 *   node test-publisher.js 17
 *   node test-publisher.js podium
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// Load broker config
let brokerUrl = 'mqtt://localhost:1883';
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.MQTT_BROKER) {
      // Convert mqtts://host:8883 to mqtt://host:1883
      brokerUrl = config.MQTT_BROKER
        .replace('mqtts://', 'mqtt://')
        .replace(':8883', ':1883');
    }
  }
} catch (e) {
  console.error('Error reading config.json:', e.message);
}

const pisteId = process.argv[2] || '17';

console.log('OPP2 Test Publisher');
console.log('==================');
console.log('Broker:', brokerUrl);
console.log('Piste ID:', pisteId);
console.log();

const client = mqtt.connect(brokerUrl, { rejectUnauthorized: false });

let seq = 1;

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  console.log();
  
  // Publish initial connection message
  publishConnection(true);
  
  // Publish fencers
  publishFencers();
  
  // Publish match
  publishMatch();
  
  // Publish initial score
  publishScore(0, 0);
  
  // Publish initial clock
  publishClock(180000, true);  // 3:00, running
  
  // Publish apparatus state
  publishApparatusState('F');
  
  // Simulate a bout with updates
  simulateBout();
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
  process.exit(1);
});

function publish(messageType, payload, retained = true) {
  const topic = `openpiste/${pisteId}/apparatus/${messageType}`;
  client.publish(topic, JSON.stringify(payload), { 
    qos: 1, 
    retain: retained 
  }, (err) => {
    if (err) {
      console.error(`Error publishing ${messageType}:`, err.message);
    } else {
      console.log(`Published ${messageType}:`, JSON.stringify(payload, null, 2));
    }
  });
}

function publishConnection(online) {
  publish('connection', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    online: online,
    device: 'Test Apparatus',
    fw_version: '1.0.0-test'
  });
}

function publishFencers() {
  publish('fencers', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    left: {
      fencer: {
        id: 'FRA123',
        name: 'Jean DUPONT',
        nation: 'FRA'
      },
      coach: {
        id: '',
        name: 'Coach LEFT',
        nation: 'FRA'
      }
    },
    right: {
      fencer: {
        id: 'ITA456',
        name: 'Marco ROSSI',
        nation: 'ITA'
      },
      coach: {
        id: '',
        name: 'Coach RIGHT',
        nation: 'ITA'
      }
    },
    referee: {
      id: 'REF789',
      name: 'John SMITH',
      nation: 'USA'
    }
  });
}

function publishMatch() {
  publish('match', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    weapon: 'E',  // Epee
    type: 'I',     // Individual
    competition: 'Test Competition 2026',
    phase_type: 'DE',
    phase: 'Table of 64',
    poule: '',
    match: 42,
    round: 1,
    scheduled: '14:30'
  });
}

function publishScore(leftScore, rightScore, priority = 'N') {
  publish('score', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    left: {
      score: leftScore,
      status: 'U',
      yellow_card: false,
      red_cards: 0,
      black_card: false
    },
    right: {
      score: rightScore,
      status: 'U',
      yellow_card: false,
      red_cards: 0,
      black_card: false
    },
    priority: priority
  });
}

function publishClock(timeMs, running) {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const centiseconds = Math.floor((timeMs % 1000) / 10);
  
  let timeStr;
  if (timeMs < 10000) {
    // Show centiseconds when under 10 seconds
    timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  } else {
    timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  publish('clock', {
    protocol: 'OPP2',
    version: '1.0',
    ts: Date.now(),
    running: running,
    time_ms: timeMs,
    time: timeStr
  }, true);  // Clock is retained
}

function publishLights(leftRed, leftWhite, rightGreen, rightWhite) {
  publish('lights', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    ts: Date.now(),
    left: {
      red: leftRed,
      white: leftWhite
    },
    right: {
      green: rightGreen,
      white: rightWhite
    }
  });
}

function publishApparatusState(state) {
  publish('state', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    state: state  // F=fencing, H=halt, P=pause, W=waiting, E=ending
  });
}

function publishUW2F(timeMs, leftPCard, rightPCard) {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  publish('uw2f', {
    protocol: 'OPP2',
    version: '1.0',
    seq: seq++,
    time_ms: timeMs,
    time: timeStr,
    left: {
      p_card: leftPCard
    },
    right: {
      p_card: rightPCard
    }
  });
}

// Simulate a bout with various events
function simulateBout() {
  let leftScore = 0;
  let rightScore = 0;
  let timeMs = 180000;  // 3 minutes
  
  console.log('\nSimulating bout events...\n');
  
  // Touch at 2:45
  setTimeout(() => {
    console.log('Touch: Left scores');
    leftScore++;
    publishLights(true, false, false, false);  // Left red on
    publishScore(leftScore, rightScore);
    
    setTimeout(() => {
      publishLights(false, false, false, false);  // Lights off
    }, 2000);
  }, 3000);
  
  // Clock update at 2:40
  setTimeout(() => {
    timeMs = 160000;
    publishClock(timeMs, true);
  }, 5000);
  
  // Touch at 2:30
  setTimeout(() => {
    console.log('Touch: Right scores');
    rightScore++;
    publishLights(false, false, true, false);  // Right green on
    publishScore(leftScore, rightScore);
    
    setTimeout(() => {
      publishLights(false, false, false, false);  // Lights off
    }, 2000);
  }, 8000);
  
  // UW2F timer starts
  setTimeout(() => {
    console.log('UW2F timer: 0:45');
    publishUW2F(45000, 0, 0);
  }, 12000);
  
  // Clock continues
  setTimeout(() => {
    timeMs = 120000;  // 2:00
    publishClock(timeMs, true);
  }, 15000);
  
  // Priority assigned
  setTimeout(() => {
    console.log('Priority assigned to left');
    publishScore(leftScore, rightScore, 'L');
  }, 18000);
  
  console.log('Events scheduled. Press Ctrl+C to exit.\n');
}

process.on('SIGINT', () => {
  console.log('\nPublishing offline status...');
  publishConnection(false);
  setTimeout(() => {
    client.end();
    process.exit(0);
  }, 500);
});
