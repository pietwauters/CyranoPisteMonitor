/* Display preferences: look (theme), mode (day/night) and language.

   Load this in <head>, right after <link id="theme-css">, so the attributes
   are on <html> before first paint (no flash of the wrong palette).

   Precedence for each value: choice made on this page > URL parameter
   (?theme=&mode=&lang=) > saved choice (localStorage) > default.
   URL parameters are never saved, so a kiosk/fullscreen display can be
   pinned with a URL without touching what a person chose on their own
   device.

   Embedded boards (overview iframes, ?embed=1) follow their parent page:
   the parent pushes its effective prefs by postMessage, which also keeps
   them in sync when the visitor uses the selector on the overview. */
(function () {
  'use strict';

  var THEMES = { classic: '/themes/classic/theme.css' };
  var MODES = ['dark', 'light', 'auto'];
  var LANGS = ['en', 'fr', 'es'];
  var DEFAULTS = { theme: 'classic', mode: 'dark', lang: 'en' };
  var OPTIONS = { theme: Object.keys(THEMES), mode: MODES, lang: LANGS };
  var STORE_KEY = 'mqttweb.prefs';

  var root = document.documentElement;
  var isEmbedded = window.parent !== window;
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var listeners = [];

  function isValid(key, value) {
    return OPTIONS[key] && OPTIONS[key].indexOf(value) !== -1;
  }

  function pick(source) {
    var out = {};
    Object.keys(OPTIONS).forEach(function (k) {
      if (source && isValid(k, source[k])) out[k] = source[k];
    });
    return out;
  }

  function readStored() {
    try { return pick(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { return {}; }
  }

  function writeStored() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(stored)); } catch (e) { /* private mode etc. */ }
  }

  var params = new URLSearchParams(location.search);
  var fromUrl = pick({ theme: params.get('theme'), mode: params.get('mode'), lang: params.get('lang') });
  var stored = readStored();
  var fromParent = {};
  var chosen = {};   // picked on this page; wins over everything

  function current() {
    return Object.assign({}, DEFAULTS, stored, fromUrl, fromParent, chosen);
  }

  function resolveMode(mode) {
    if (mode === 'auto') return dark && !dark.matches ? 'light' : 'dark';
    return mode;
  }

  function apply() {
    var p = current();
    root.setAttribute('data-theme', p.theme);
    root.setAttribute('data-mode', resolveMode(p.mode));
    root.setAttribute('data-mode-pref', p.mode);
    root.setAttribute('lang', p.lang);

    var link = document.getElementById('theme-css');
    if (link && link.getAttribute('href') !== THEMES[p.theme]) link.setAttribute('href', THEMES[p.theme]);

    broadcast(p);
    listeners.forEach(function (fn) { fn(p); });
  }

  // Parent -> embedded boards.
  function broadcast(p) {
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow) frames[i].contentWindow.postMessage({ type: 'prefs', prefs: p }, location.origin);
    }
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'prefs' && e.source === window.parent) {
      fromParent = pick(e.data.prefs);
      apply();
    } else if (e.data.type === 'prefs-hello' && e.source) {
      e.source.postMessage({ type: 'prefs', prefs: current() }, location.origin);
    }
  });

  // Another tab/page of this origin changed the saved choice.
  window.addEventListener('storage', function (e) {
    if (e.key !== STORE_KEY) return;
    stored = readStored();
    apply();
  });

  // "auto" follows the OS while the page is open.
  if (dark && dark.addEventListener) {
    dark.addEventListener('change', function () { if (current().mode === 'auto') apply(); });
  }

  function set(key, value) {
    if (!isValid(key, value)) return;
    stored[key] = value;
    chosen[key] = value;
    writeStored();
    apply();
  }

  window.Prefs = {
    THEMES: OPTIONS.theme,
    MODES: MODES,
    LANGS: LANGS,
    get: current,
    set: set,
    subscribe: function (fn) { listeners.push(fn); fn(current()); },
    // Query-string tail carrying only URL-supplied values, for links and
    // iframes that should inherit a pinned look ("&theme=fie&mode=light").
    urlQuery: function () {
      return Object.keys(fromUrl).map(function (k) { return '&' + k + '=' + encodeURIComponent(fromUrl[k]); }).join('');
    }
  };

  apply();
  if (isEmbedded) window.parent.postMessage({ type: 'prefs-hello' }, location.origin);
})();
