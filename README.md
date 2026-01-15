# MQTT Web Dashboard

A real-time web-based dashboard for displaying MQTT data, built with Node.js and Express.

## Features

- **Live Display**: Real-time data visualization from MQTT broker
- **Admin Panel**: Comprehensive administrator interface for managing MQTT connections
- **WebSocket Support**: Live updates using MQTT over WebSockets
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- MQTT Broker (e.g., Mosquitto)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mqtt-web
```

2. Install dependencies:
```bash
npm install
```

3. Start your MQTT broker (if using Mosquitto):
```bash
mosquitto -v
```

4. Start the server:
```bash
node server.js
```

5. Open your browser:
   - Main Display: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

## Configuration

The default MQTT broker is configured to `mqtt://localhost:1883`. You can change this in:
- `server.js` for the backend connection
- Admin panel for testing and managing connections

## Project Structure

```
mqtt-web/
├── server.js           # Express server and MQTT client
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html      # Main display page
│   ├── admin.html      # Administrator panel
│   └── js/
│       └── mqttws31.min.js  # MQTT WebSocket client library
```

## Dependencies

- express - Web server framework
- mqtt - MQTT client for Node.js

## License

MIT
