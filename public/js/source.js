// Where the display's OPP2 messages come from.
//
// Default (venue mode): Paho MQTT over WebSockets to the broker on this page's
// own host, subscribed to openpiste/{piste}/apparatus/#.
//
// A host page can declare another source instead, with a meta tag in <head>:
//   <meta name="opp2-source" content="sse" data-url="/api/…/stream" data-photos="off">
// The page then reads server-sent events from data-url (with ?piste= appended).
// Each `opp2` event carries {topic, payload}: a local-shaped topic
// (openpiste/{piste}/apparatus/{type}) and a spec-shaped OPP2 payload, so the
// dispatcher and every handler in main.js work unchanged. This is how
// openpiste-results shows this display without any MQTT in the browser.
//
// A page that embeds several displays (one iframe per piste) can instead feed
// them itself over a single connection, declaring content="parent": the
// display then posts {type:'opp2-hello', piste} to its parent window and
// takes {type:'opp2', topic, payload} messages back (same origin only). The
// parent replays the piste's current state on every hello. Opened on its own
// (no parent window), such a page falls back to its data-url stream.
//
// Every source exposes the same shape:
//   kind         'mqtt' | 'sse' | 'parent'
//   photos       whether fencer photos are served next to this page
//   onMessage    (topic, payloadString) => void    set by main.js
//   onLink       (online) => void                  page's own link to its source
//   onConnected  () => void                        after every (re)connect
//   start(piste) / setPiste(piste)

(function () {
  'use strict';

  const apparatusTopic = (piste) => `openpiste/${piste}/apparatus/#`;

  function base(kind, photos) {
    return {
      kind, photos, piste: '',
      onMessage: null, onLink: null, onConnected: null,
      link(online) { if (this.onLink) this.onLink(online); },
    };
  }

  function mqttSource() {
    const src = base('mqtt', true);
    // Loopback is always secure — skip WSS to avoid cert issues on localhost
    const useSSL = location.protocol === 'https:' &&
                   location.hostname !== 'localhost' &&
                   location.hostname !== '127.0.0.1';
    const port = useSSL ? 9002 : 9001;
    const client = new Paho.MQTT.Client(location.hostname, port, 'fencingDisplay_' + Date.now());

    client.onMessageArrived = (message) => {
      if (src.onMessage) src.onMessage(message.destinationName, message.payloadString);
    };

    // Paho mutates the options object passed to connect() and throws if
    // called while already connected: build fresh options per attempt, and
    // guard against a stale scheduled retry.
    function connect() {
      if (client.isConnected()) return;
      client.connect({
        useSSL,
        onSuccess: () => {
          src.link(true);
          if (src.piste) client.subscribe(apparatusTopic(src.piste));
          if (src.onConnected) src.onConnected();
        },
        onFailure: (err) => {
          console.error('Connection failed:', err);
          src.link(false);
          setTimeout(connect, 5000);
        },
      });
    }

    client.onConnectionLost = (response) => {
      src.link(false);
      if (response.errorCode !== 0) {
        console.warn('MQTT connection lost, reconnecting…', response.errorMessage);
        setTimeout(connect, 5000);
      }
    };

    src.start = (piste) => { src.piste = piste; connect(); };
    src.setPiste = (piste) => {
      if (client.isConnected()) {
        if (src.piste) client.unsubscribe(apparatusTopic(src.piste));
        client.subscribe(apparatusTopic(piste));
      }
      src.piste = piste;
    };
    return src;
  }

  function sseSource(url, photos) {
    const src = base('sse', photos);
    let es = null;

    function open() {
      if (es) es.close();
      if (!src.piste) return;
      es = new EventSource(url + (url.includes('?') ? '&' : '?') + 'piste=' + encodeURIComponent(src.piste));
      // The server replays the piste's current state on every (re)connect,
      // the way a broker delivers retained messages on subscribe.
      es.onopen = () => {
        src.link(true);
        if (src.onConnected) src.onConnected();
      };
      es.onerror = () => src.link(false);   // EventSource reconnects by itself
      es.addEventListener('opp2', (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (_) { return; }
        if (src.onMessage && m && m.topic) src.onMessage(m.topic, JSON.stringify(m.payload));
      });
    }

    src.start = (piste) => { src.piste = piste; open(); };
    src.setPiste = (piste) => { src.piste = piste; open(); };
    return src;
  }

  function parentSource(photos) {
    const src = base('parent', photos);
    const hello = () => window.parent.postMessage({ type: 'opp2-hello', piste: src.piste }, location.origin);

    window.addEventListener('message', (e) => {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      const m = e.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'opp2' && typeof m.topic === 'string' && src.onMessage) {
        src.onMessage(m.topic, JSON.stringify(m.payload));
      } else if (m.type === 'opp2-link') {
        src.link(!!m.online);
      }
    });

    src.start = (piste) => {
      src.piste = piste;
      src.link(true);
      if (src.onConnected) src.onConnected();
      hello();
    };
    src.setPiste = (piste) => { src.piste = piste; hello(); };
    return src;
  }

  window.OPP2Source = {
    fromPage() {
      const meta = document.querySelector('meta[name="opp2-source"]');
      const photos = !meta || meta.dataset.photos !== 'off';
      if (meta && meta.content === 'parent' && window.parent !== window) return parentSource(photos);
      if (meta && (meta.content === 'sse' || meta.content === 'parent') && meta.dataset.url) {
        return sseSource(meta.dataset.url, photos);
      }
      return mqttSource();
    },
  };
})();
