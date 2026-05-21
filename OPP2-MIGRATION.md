# OPP2 Migration Guide

## Summary of Changes

This project has been migrated from the EFP1.1 ("MQTT_Cyrano") protocol to the **OpenPiste Protocol Level 2 (OPP2)**.

## What Changed

### Protocol Structure

**Old (EFP1.1):**
- Topic: `MQTT_Cyrano/Piste_{number}/FromDevice` or `/FromSoftware`
- Single monolithic JSON message with all data
- Flat key-value structure

**New (OPP2):**
- Topic: `openpiste/{piste_id}/{publisher}/{message_type}`
- Separate topics for different message types
- Structured JSON with typed fields
- Publishers: `apparatus`, `software`, `remote`
- Message types: `lights`, `clock`, `score`, `fencers`, `match`, `uw2f`, `connection`, etc.

### Piste ID Format

- **Old:** Always padded to 3 digits with "Piste_" prefix (e.g., `Piste_017`)
- **New:** Used as-is, no padding (e.g., `17`, `podium`, `blue`)

### Topic Subscriptions

| Component | Old Topic | New Topic |
|-----------|-----------|-----------|
| Display | `MQTT_Cyrano/Piste_{id}/#` | `openpiste/{id}/apparatus/#` |
| Overview | `MQTT_Cyrano/+/Connection` | `openpiste/+/apparatus/connection` |
| Management | `MQTT_Cyrano/Piste_{id}/FromSoftware` | `openpiste/{id}/software/fencers` |

### Message Mapping

| Old Field | New Message | New Field |
|-----------|-------------|-----------|
| `LeftName` | `fencers` | `left.fencer.name` |
| `RightName` | `fencers` | `right.fencer.name` |
| `LeftNat` | `fencers` | `left.fencer.nation` |
| `RightNat` | `fencers` | `right.fencer.nation` |
| `Lscore` | `score` | `left.score` |
| `Rscore` | `score` | `right.score` |
| `LRcard` | `score` | `left.red_cards` |
| `LYcard` | `score` | `left.yellow_card` (boolean) |
| `RRcard` | `score` | `right.red_cards` |
| `RYcard` | `score` | `right.yellow_card` (boolean) |
| `LP-card` | `score` or `uw2f` | `left.black_card` or `left.p_card` |
| `RP-card` | `score` or `uw2f` | `right.black_card` or `right.p_card` |
| `LLight` | `lights` | `left.on_target` (boolean) |
| `RLight` | `lights` | `right.on_target` (boolean) |
| `LWlight` | `lights` | `left.white` (boolean) |
| `RWlight` | `lights` | `right.white` (boolean) |
| `Stopwatch` | `clock` | `time` |
| `Round` | `match` | `round` |
| `Priority` | `score` | `priority` ("N", "L", "R") |
| `UW2F_Timer.time` | `uw2f` | `time` |

## Files Changed

### New Files
- `/public/js/opp2.js` - OPP2 JavaScript library (topic parser, deserializer, dispatcher)
- `/test-publisher.js` - Test message publisher for development

### Modified Files
- `/public/index.html` - Added opp2.js script
- `/public/main.js` - Complete rewrite to use OPP2 dispatcher
- `/public/overview.html` - Updated to monitor `openpiste/+/apparatus/connection`
- `/public/piste-mgt.html` - Updated to publish OPP2 fencers messages

### Unchanged Files
- `/server.js` - No changes (just brokers MQTT connections)
- `/public/style.css` - No changes
- Photo management, flags, fullscreen features - All work the same

## Testing

### 1. Start the Server

```bash
node server.js
```

### 2. Publish Test Messages

In a new terminal:

```bash
node test-publisher.js 17
```

This will publish sample OPP2 messages for piste "17" and simulate a bout with various events.

### 3. View the Display

Open in your browser:
- Single piste: `http://localhost:3000/piste/17`
- Overview: `http://localhost:3000/overview`
- Management: `http://localhost:3000/piste-mgt`

### 4. Manual Testing

Use the piste management page to send fencer data:
1. Go to `http://localhost:3000/piste-mgt`
2. Enter piste number (e.g., "17")
3. Enter fencer names and nationality codes
4. Click "Send Data"
5. View on `http://localhost:3000/piste/17`

## MQTT Broker Configuration

The system uses the same broker configuration as before:
- Config file: `config.json`
- Default: `mqtts://localhost:8883` with fallback to `mqtt://localhost:1883`
- WebSocket ports: 9002 (wss), 9001 (ws)

No changes needed to broker setup.

## OPP2 Library Usage

The JavaScript library (`/public/js/opp2.js`) provides:

```javascript
// Parse topic
const topic = OPP2.TopicParser.parse("openpiste/17/apparatus/lights");
// => { piste_id: "17", publisher: "apparatus", message_type: "lights" }

// Build topic
const topic = OPP2.TopicParser.build("17", "apparatus", "lights");
// => "openpiste/17/apparatus/lights"

// Dispatcher with callbacks
const dispatcher = new OPP2.Dispatcher();

dispatcher.on(OPP2.MessageType.LIGHTS, (topic, message) => {
  console.log('Lights:', message.left.on_target, message.right.on_target);
});

dispatcher.on(OPP2.MessageType.SCORE, (topic, message) => {
  console.log('Score:', message.left.score, '-', message.right.score);
});

// Dispatch incoming MQTT message
dispatcher.dispatch(mqttTopic, payload);

// System state (optional)
const state = new OPP2.SystemState();
dispatcher.setSystemState(state);
// state is automatically updated on each message
```

## Debugging

### Enable Console Logging

The dispatcher logs errors to the console. Open browser DevTools (F12) and check:
- Topic parsing errors
- Deserialization errors
- Unknown message types

### Monitor MQTT Traffic

Use an MQTT client to monitor all topics:

```bash
mosquitto_sub -h localhost -p 1883 -t 'openpiste/#' -v
```

Or with TLS:

```bash
mosquitto_sub -h localhost -p 8883 -t 'openpiste/#' -v --insecure
```

### Check Message Format

Published messages should have this structure:

```json
{
  "protocol": "OPP2",
  "version": "1.0",
  "seq": 123,
  "left": { ... },
  "right": { ... }
}
```

## Migration Checklist

- [x] Created OPP2 JavaScript library
- [x] Updated main display (main.js)
- [x] Updated overview page
- [x] Updated piste management page
- [x] Created test publisher
- [x] Verified photo loading still works
- [x] Verified flag display still works
- [x] Verified fullscreen and frames still work
- [ ] Test with real apparatus (when available)
- [ ] Update any external documentation

## Future Enhancements

### Planned
- Add visual indicator for apparatus state (fencing/halt/pause)
- Add connection status indicator on display
- Add medical timeout display
- Add video review display

### Backward Compatibility (Later)
When needed, add support for raw Cyrano messages over MQTT without pre-parsing. This would allow legacy equipment to work alongside OPP2 devices.

## Troubleshooting

### Displays Not Updating
1. Check broker is running: `systemctl status mosquitto`
2. Check websocket ports are open (9001, 9002)
3. Check browser console for errors
4. Verify MQTT topics with `mosquitto_sub`

### Wrong Piste Shown
- URL format is `/piste/{id}` where `{id}` is the piste identifier
- No padding needed: `/piste/17` not `/piste/017`

### Photos Not Loading
- Photos still use the same path: `/fencers/piste-{number}/{position}.{ext}`
- The piste number in the path should match what you're using
- For numeric pistes, photos work automatically
- For named pistes (e.g., "podium"), create folder `/fencers/piste-podium/`

## Support

For issues or questions about OPP2, refer to:
- C++ library: `/home/piet/esp-idfProjects/opp2-library/`
- Example subscriber: `/home/piet/esp-idfProjects/opp2-library/examples/linux/subscriber_basic/`
- OPP2 specification: Check library README and header files

## License

This implementation follows the same MIT license as the original project and the OPP2 library.
