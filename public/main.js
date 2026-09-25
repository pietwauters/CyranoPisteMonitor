// OPP2 Fencing Display - main.js

let currentPiste = "";
let lastMatch = null;   // kept so the bout/period sub-line can be re-rendered on a language change
let displayedPiste = "";
// MQTT to the local broker by default, or whatever the host page declares
// (see js/source.js).
const source = OPP2Source.fromPage();

// OPP2 dispatcher and system state
const dispatcher = new OPP2.Dispatcher();
const systemState = new OPP2.SystemState();
dispatcher.setSystemState(systemState);

function getPisteFromURL() {
  const path = window.location.pathname;
  const match = path.match(/\/piste\/(.+)/);
  if (match) {
    // Remove any trailing slashes and return piste ID as-is
    return match[1].replace(/\/$/, '');
  }
  return null;
}

// OPP2 message handlers
dispatcher.on(OPP2.MessageType.LIGHTS, (topic, message) => {
  updateLights(message);
});

dispatcher.on(OPP2.MessageType.CLOCK, (topic, message) => {
  updateClock(message);
});

dispatcher.on(OPP2.MessageType.SCORE, (topic, message) => {
  updateScore(message);
});

dispatcher.on(OPP2.MessageType.FENCERS, (topic, message) => {
  updateFencers(message);
});

dispatcher.on(OPP2.MessageType.MATCH, (topic, message) => {
  updateMatch(message);
});

dispatcher.on(OPP2.MessageType.UW2F, (topic, message) => {
  updateUW2F(message);
});

dispatcher.on(OPP2.MessageType.APPARATUS_STATE, (topic, message) => {
  if (elements.apparatusState) {
    elements.apparatusState.textContent = message.state || 'W';
    if (message.state === 'E') {
      elements.apparatusState.classList.add('state-ending');
    } else {
      elements.apparatusState.classList.remove('state-ending');
    }
  }

  // v2 layout: the ported CSS keys entirely off the [data-state] attribute,
  // no class toggling needed.
  if (elements.v2.stateBadge) {
    const state = message.state || 'W';
    elements.v2.stateBadge.textContent = state;
    elements.v2.stateBadge.setAttribute('data-state', state);
  }
});

dispatcher.on(OPP2.MessageType.CONNECTION, (topic, message) => {
  if (elements.v2.connDot) {
    elements.v2.connDot.classList.toggle('online', !!message.online);
  }
});

dispatcher.onError = (error, topic, detail) => {
  console.error('OPP2 dispatch error:', error, topic, detail);
};

source.onMessage = (topic, payload) => {
  dispatcher.dispatch(topic, payload);
};

function padPisteId(id) {
  if (id == null) return '';
  const s = String(id).trim();
  if (!s) return '';
  return /^\d+$/.test(s) ? s.padStart(3, '0') : s;
}

if (new URLSearchParams(window.location.search).get('embed') === '1') {
  document.body.classList.add('embed-mode');
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('fullscreen-btn');
    if (btn) btn.style.display = 'none';
  });
}

if (new URLSearchParams(window.location.search).get('layout') === 'v2') {
  document.body.classList.add('layout-v2');
}

// Broker link status is distinct from the scoring device's own OPP2
// CONNECTION status: this tracks whether *this page* has a live link to its
// message source at all.
function setBrokerOnline(online) {
  if (elements.v2.brokerDot) elements.v2.brokerDot.classList.toggle('online', online);
}
source.onLink = setBrokerOnline;

source.onConnected = () => {
  if (currentPiste) {
    setPisteLabel();
    if (elements.v2.footerPisteVal) elements.v2.footerPisteVal.textContent = currentPiste;
    loadFencerPhotos();
  }
};

window.onload = function () {
  const pisteSelect = document.getElementById('piste-select');
  const urlPiste = getPisteFromURL();

  // Populate piste selector with numbers and allow text entry
  for (let i = 1; i <= 999; i++) {
    const option = document.createElement('option');
    option.value = i.toString();
    option.text = I18n.t('piste.option', { n: i });
    pisteSelect.appendChild(option);
  }

  if (urlPiste) {
    pisteSelect.style.display = 'none';
    document.getElementById('fullscreen-btn').style.top = '2vmin';
    document.getElementById('fullscreen-btn').style.left = '2vmin';
    // style.css also pins the button with right: 2vmin; without releasing it the
    // left+right pair stretches the button across the whole viewport.
    document.getElementById('fullscreen-btn').style.right = 'auto';
    currentPiste = urlPiste;
    displayedPiste = urlPiste;
    pisteSelect.value = urlPiste;
  }
  source.start(currentPiste);
  handleResize();
};

document.getElementById('piste-select').addEventListener('change', (e) => {
  const newPiste = e.target.value;
  if (newPiste && newPiste !== currentPiste) {
    source.setPiste(newPiste);
    currentPiste = newPiste;
    displayedPiste = newPiste;
    resetDisplay();
    setPisteLabel();
    if (elements.v2.footerPisteVal) elements.v2.footerPisteVal.textContent = currentPiste;
    loadFencerPhotos();
  }
});

const elements = {
  leftName: document.querySelector('.lName'),
  rightName: document.querySelector('.rName'),
  leftScore: document.querySelector('.lScore'),
  rightScore: document.querySelector('.rScore'),
  clock: document.querySelector('.smClock'),
  period: document.querySelector('.smPeriod'),
  leftPriority: document.querySelector('.left-priority'),
  rightPriority: document.querySelector('.right-priority'),
  poolNum: document.querySelector('.poolNum'),
  cards: {
    lRed: document.querySelector('.lRed'),
    lYellow: document.querySelector('.lYellow'),
    rRed: document.querySelector('.rRed'),
    rYellow: document.querySelector('.rYellow'),
    lPCard: document.querySelector('.lPCard'),
    rPCard: document.querySelector('.rPCard')
  },
  lights: {
    lColor: document.querySelector('.lColor'),
    rColor: document.querySelector('.rColor'),
    lWhite: document.querySelector('.lWhite'),
    rWhite: document.querySelector('.rWhite')
  },
  leftFlag: document.querySelector('.left-flag'),
  rightFlag: document.querySelector('.right-flag'),
  leftPhoto: document.querySelector('.left-photo'),
  rightPhoto: document.querySelector('.right-photo'),
  leftPhotoImg: document.querySelector('.left-photo img'),
  rightPhotoImg: document.querySelector('.right-photo img'),
  uw2fTimer: document.getElementById('uw2f-timer'),
  buzzer: document.getElementById('buzzer-sound'),
  apparatusState: document.querySelector('.apparatus-state'),
  v2: {
    leftBand: document.getElementById('v2-leftBand'),
    rightBand: document.getElementById('v2-rightBand'),
    leftSurname: document.querySelector('#v2-leftBand .surname'),
    leftFirstname: document.querySelector('#v2-leftBand .firstname'),
    rightSurname: document.querySelector('#v2-rightBand .surname'),
    rightFirstname: document.querySelector('#v2-rightBand .firstname'),
    leftNation: document.querySelector('#v2-leftBand .nation-code'),
    rightNation: document.querySelector('#v2-rightBand .nation-code'),
    leftFlag: document.querySelector('#v2-leftBand .flag'),
    rightFlag: document.querySelector('#v2-rightBand .flag'),
    leftScore: document.querySelector('#v2-leftBand .score'),
    rightScore: document.querySelector('#v2-rightBand .score'),
    cards: {
      leftYellow: document.getElementById('v2-leftYellow'),
      leftRed: document.getElementById('v2-leftRed'),
      leftP: document.getElementById('v2-leftP'),
      rightYellow: document.getElementById('v2-rightYellow'),
      rightRed: document.getElementById('v2-rightRed'),
      rightP: document.getElementById('v2-rightP')
    },
    leftPriorityMark: document.getElementById('v2-leftPriority'),
    rightPriorityMark: document.getElementById('v2-rightPriority'),
    clock: document.getElementById('v2-clock'),
    uw2f: document.getElementById('v2-uw2f'),
    stateBadge: document.getElementById('v2-stateBadge'),
    connDot: document.getElementById('v2-connDot'),
    brokerDot: document.getElementById('v2-brokerDot'),
    footerPisteVal: document.getElementById('v2-piste-val'),
    footerPouleVal: document.getElementById('v2-poule-val'),
    footerSubline: document.getElementById('v2-subline')
  }
};

(function generateBuzzerSound() {
  try {
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100 * 2, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1320;
    osc.connect(ctx.destination);
    osc.start(0);
    osc.stop(2);
    ctx.startRendering().then(buffer => {
      const wav = audioBufferToWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      elements.buzzer.src = URL.createObjectURL(blob);
    });
  } catch (e) {}
  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [],
      sampleRate = buffer.sampleRate;
    let offset = 0, pos = 0;
    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);
    for (let i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));
    let sample = 0;
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample * 0.5) * 65535 - 32768;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    return bufferArray;
  }
})();

let lastLightsOn = false;

// Track if buzzer has played for the current light-on event
let buzzerPlayed = false;

function checkAndPlayBuzzer() {
  // Only play in fullscreen and when only one piste is shown
  if (!isFullscreen) return;
  // Only if exactly one piste is shown (not overview/embed)
  if (currentPiste === "" || currentPiste == null) return;
  // Check if any of the four lights is on
  const lights = [elements.lights.lColor, elements.lights.rColor, elements.lights.lWhite, elements.lights.rWhite];
  const anyOn = lights.some(light => light.style.opacity === "1");
  if (anyOn && !buzzerPlayed) {
    // Play the buzzer sound
    if (elements.buzzer && elements.buzzer.src) {
      elements.buzzer.currentTime = 0;
      elements.buzzer.play();
    }
    buzzerPlayed = true;
  } else if (!anyOn) {
    // Reset so it can play again next time
    buzzerPlayed = false;
  }
}

function resetDisplay() {
  lastMatch = null;
  elements.leftName.textContent = "";
  elements.rightName.textContent = "";
  elements.leftScore.textContent = "0";
  elements.rightScore.textContent = "0";
  elements.clock.textContent = "0:00";
  elements.period.textContent = "1";
  elements.leftFlag.style.display = 'none';
  elements.rightFlag.style.display = 'none';
  elements.leftFlag.src = '';
  elements.rightFlag.src = '';
  if (elements.uw2fTimer) {
    elements.uw2fTimer.textContent = '';
    elements.uw2fTimer.style.display = 'none';
    elements.uw2fTimer.classList.remove('uw2f-red', 'uw2f-green', 'uw2f-orange');
  }
  Object.values(elements.cards).forEach(card => {
    card.textContent = "";
    card.style.visibility = "hidden";
  });
  Object.values(elements.lights).forEach(light => {
    light.style.opacity = "0.1";
    light.style.boxShadow = "none";
  });
  // Reset buzzer state
  buzzerPlayed = false;

  // v2 layout
  setFencerNameV2(elements.v2.leftSurname, elements.v2.leftFirstname, '');
  setFencerNameV2(elements.v2.rightSurname, elements.v2.rightFirstname, '');
  elements.v2.leftScore.textContent = '0';
  elements.v2.rightScore.textContent = '0';
  elements.v2.leftNation.textContent = '';
  elements.v2.rightNation.textContent = '';
  updateFlag(elements.v2.leftFlag, null);
  updateFlag(elements.v2.rightFlag, null);
  if (elements.v2.clock) elements.v2.clock.textContent = '0:00';
  if (elements.v2.connDot) elements.v2.connDot.classList.remove('online');
  elements.v2.leftBand.classList.remove('lit', 'invalid');
  elements.v2.rightBand.classList.remove('lit', 'invalid');
  elements.v2.leftPriorityMark.classList.remove('active');
  elements.v2.rightPriorityMark.classList.remove('active');
  Object.values(elements.v2.cards).forEach(card => {
    card.classList.remove('active', 'level-1', 'level-2');
    card.removeAttribute('data-level');
  });
  if (elements.v2.uw2f) {
    elements.v2.uw2f.textContent = '';
    elements.v2.uw2f.classList.remove('visible', 'level-warn', 'level-danger');
  }
}

// OPP2 Message Update Functions

function updateLights(message) {
  // Left side (red for on-target, white for off-target)
  updateLight(elements.lights.lColor, message.left.on_target);
  updateLight(elements.lights.lWhite, message.left.white);

  // Right side (green for on-target, white for off-target)
  updateLight(elements.lights.rColor, message.right.on_target);
  updateLight(elements.lights.rWhite, message.right.white);

  checkAndPlayBuzzer();

  // v2 layout: on_target -> coloured chevron, white -> invalid (white) chevron
  elements.v2.leftBand.classList.toggle('lit', !!message.left.on_target);
  elements.v2.leftBand.classList.toggle('invalid', !!message.left.white);
  elements.v2.rightBand.classList.toggle('lit', !!message.right.on_target);
  elements.v2.rightBand.classList.toggle('invalid', !!message.right.white);
}

function updateClock(message) {
  elements.clock.textContent = message.time || "0:00";
  // Optional: could add visual indicator if clock is running

  if (elements.v2.clock) elements.v2.clock.textContent = message.time || "0:00";
}

function updateScore(message) {
  // Scores
  elements.leftScore.textContent = String(message.left.score);
  elements.rightScore.textContent = String(message.right.score);
  
  // Cards
  updateCard(elements.cards.lYellow, message.left.yellow_card ? 1 : 0);
  updateCard(elements.cards.lRed, message.left.red_cards);
  updateCard(elements.cards.rYellow, message.right.yellow_card ? 1 : 0);
  updateCard(elements.cards.rRed, message.right.red_cards);
  
  // P-cards (black cards)
  updatePCard(elements.cards.lPCard, message.left.black_card ? 2 : 0);
  updatePCard(elements.cards.rPCard, message.right.black_card ? 2 : 0);
  
  // Priority
  elements.leftPriority.style.display = 'none';
  elements.rightPriority.style.display = 'none';
  elements.leftPriority.textContent = '';
  elements.rightPriority.textContent = '';
  
  if (message.priority === OPP2.Priority.LEFT) {
    elements.leftPriority.textContent = 'P';
    elements.leftPriority.style.display = 'block';
  } else if (message.priority === OPP2.Priority.RIGHT) {
    elements.rightPriority.textContent = 'P';
    elements.rightPriority.style.display = 'block';
  }

  // v2 layout
  elements.v2.leftScore.textContent = String(message.left.score);
  elements.v2.rightScore.textContent = String(message.right.score);
  updateCardV2(elements.v2.cards.leftYellow, message.left.yellow_card ? 1 : 0);
  updateCardV2(elements.v2.cards.leftRed, message.left.red_cards);
  updateCardV2(elements.v2.cards.rightYellow, message.right.yellow_card ? 1 : 0);
  updateCardV2(elements.v2.cards.rightRed, message.right.red_cards);
  // Note: v2's P-card is intentionally driven only from UW2F's p_card (see
  // updateUW2F), not from black_card here -- unlike v1, which writes it from
  // both messages (whichever fires last wins, an existing v1 quirk).
  elements.v2.leftPriorityMark.classList.toggle('active', message.priority === OPP2.Priority.LEFT);
  elements.v2.rightPriorityMark.classList.toggle('active', message.priority === OPP2.Priority.RIGHT);

  // A priority mark changes the width of the v2 name line.
  fitNames();
}

function updateFencers(message) {
  // Names
  elements.leftName.textContent = message.left.fencer.name || "";
  elements.rightName.textContent = message.right.fencer.name || "";

  // Flags (nationalities)
  updateFlag(elements.leftFlag, message.left.fencer.nation);
  updateFlag(elements.rightFlag, message.right.fencer.nation);

  // v2 layout
  setFencerNameV2(elements.v2.leftSurname, elements.v2.leftFirstname, message.left.fencer.name);
  setFencerNameV2(elements.v2.rightSurname, elements.v2.rightFirstname, message.right.fencer.name);
  elements.v2.leftNation.textContent = (message.left.fencer.nation || '').toUpperCase();
  elements.v2.rightNation.textContent = (message.right.fencer.nation || '').toUpperCase();
  updateFlag(elements.v2.leftFlag, message.left.fencer.nation);
  updateFlag(elements.v2.rightFlag, message.right.fencer.nation);

  fitNames();
}

// Long names shrink to fit their bar instead of being cut off. Each name's
// font-size in CSS is multiplied by --fit (default 1); this sets --fit so the
// text fits the space available, never below MIN_FIT. Runs after every name
// change and whenever the board resizes (window, fullscreen, rotation, iframe).
const MIN_FIT = 0.3;

function horizontalPadding(el) {
  const cs = getComputedStyle(el);
  return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
}

// The rendered width of an element's text, however it's aligned. (scrollWidth
// misses overflow on the start side of right-aligned text.)
function textWidth(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
}

// available: width the text may use.
function fitText(el, available) {
  if (!el) return;
  let fit = 1;
  el.style.setProperty('--fit', '1');
  // Text width isn't exactly proportional to font size (hinting, rounding),
  // so re-measure after each step.
  for (let i = 0; i < 3; i++) {
    const needed = textWidth(el);
    if (needed <= 0 || available <= 0 || needed <= available || fit <= MIN_FIT) return;
    fit = Math.max(MIN_FIT, fit * (available / needed) * 0.97);
    el.style.setProperty('--fit', String(fit));
  }
}

function fitNames() {
  // v1: each name bar has its own fixed width.
  for (const el of [elements.leftName, elements.rightName]) {
    if (el) fitText(el, el.clientWidth - horizontalPadding(el));
  }
  // v2: the name line sits in the band's content column.
  document.querySelectorAll('.v2-board .fencer-name').forEach((el) => {
    fitText(el, el.parentElement.clientWidth - horizontalPadding(el.parentElement));
  });
}

if (window.ResizeObserver) {
  const board = document.querySelector('.scoring-container');
  if (board) new ResizeObserver(() => fitNames()).observe(board);
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNames);
// A theme switch changes the font, and with it every name's width.
if (window.Prefs && Prefs.subscribe) Prefs.subscribe(() => requestAnimationFrame(fitNames));

function updateMatch(message) {
  // Round/Period
  elements.period.textContent = String(message.round || 1);

  // v2 layout: poule number + a best-effort bout/period/relay sub-line.
  // phase_type's full value set isn't documented anywhere in this codebase
  // (test-publisher.js's only sample uses 'DE') -- revisit this mapping once
  // real phase_type values from the field are confirmed.
  lastMatch = message;
  renderMatchContext();
}

function renderMatchContext() {
  if (!lastMatch) return;
  const ctx = deriveV2Context(lastMatch);
  if (elements.v2.footerPouleVal) elements.v2.footerPouleVal.textContent = ctx.poule;
  if (elements.v2.footerSubline) elements.v2.footerSubline.textContent = ctx.subline;
}

function setPisteLabel() {
  if (!currentPiste) return;
  document.querySelector('.poolNum').textContent = I18n.t('strip.label', { n: currentPiste });
}

// Text built here (not in the markup) has to be re-rendered when the
// language changes; runs once the dictionaries are loaded, then on every change.
I18n.subscribe(() => {
  const select = document.getElementById('piste-select');
  for (const option of select.options) {
    if (option.value) option.text = I18n.t('piste.option', { n: option.value });
  }
  setPisteLabel();
  renderMatchContext();
});

function updateUW2F(message) {
  if (elements.uw2fTimer) {
    // Format time from milliseconds - UW2F only needs second resolution
    const totalSeconds = Math.floor(message.time_ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    elements.uw2fTimer.textContent = timeStr;
    
    elements.uw2fTimer.classList.remove('uw2f-red', 'uw2f-green', 'uw2f-orange');
    if (totalSeconds < 50) {
      elements.uw2fTimer.classList.add('uw2f-green');
    } else if (totalSeconds < 60) {
      elements.uw2fTimer.classList.add('uw2f-orange');
    } else {
      elements.uw2fTimer.classList.add('uw2f-red');
    }
    elements.uw2fTimer.style.display = 'block';

    // Update P-cards from UW2F message
    updatePCard(elements.cards.lPCard, message.left.p_card);
    updatePCard(elements.cards.rPCard, message.right.p_card);

    // v2 layout
    if (elements.v2.uw2f) {
      elements.v2.uw2f.textContent = timeStr;
      elements.v2.uw2f.classList.add('visible');
      elements.v2.uw2f.classList.remove('level-warn', 'level-danger');
      if (totalSeconds >= 60) {
        elements.v2.uw2f.classList.add('level-danger');
      } else if (totalSeconds >= 50) {
        elements.v2.uw2f.classList.add('level-warn');
      }
    }
    updatePCardV2(elements.v2.cards.leftP, message.left.p_card);
    updatePCardV2(elements.v2.cards.rightP, message.right.p_card);
  }
}

// Helper functions

// Helper functions

function updateCard(element, value) {
  element.textContent = value > 0 ? value : "";
  element.style.visibility = value > 0 ? "visible" : "hidden";
}

function updatePCard(element, value) {
  element.style.visibility = "hidden";
  element.classList.remove('smYellow', 'smRed');
  element.textContent = "P";
  const numValue = parseInt(value);
  if (numValue === 1) {
    element.classList.add('smYellow');
    element.style.visibility = "visible";
  } else if (numValue === 2 || numValue >= 2) {
    element.classList.add('smRed');
    element.style.visibility = "visible";
  }
}

function updateLight(element, isOn) {
  // isOn is now a boolean from OPP2
  element.style.opacity = isOn ? "1" : "0.1";
  element.style.boxShadow = isOn ? "0 0 15px currentColor" : "none";
}

// v2 layout helpers

function updateCardV2(element, value) {
  if (!element) return;
  element.classList.toggle('active', value > 0);
}

function updatePCardV2(element, value) {
  if (!element) return;
  const n = parseInt(value, 10) || 0;
  element.classList.remove('active', 'level-1', 'level-2');
  element.setAttribute('data-level', n);
  if (n === 1) {
    element.classList.add('active', 'level-1');
  } else if (n >= 2) {
    element.classList.add('active', 'level-2');
  }
}

// Best-effort name split: deserializeFencers only ever exposes one combined
// "name" string (no separate given/family fields), and the field order isn't
// guaranteed (test-publisher.js's fixture uses "Firstname SURNAME", e.g.
// 'Jean DUPONT', but real feeds could plausibly send the opposite order) --
// so this buckets by case rather than by position. Tokens with no lowercase
// letters are treated as the surname (rendered first, matching the v2
// layout's fixed visual convention), everything else as the first name.
function setFencerNameV2(surnameEl, firstnameEl, fullName) {
  if (!surnameEl || !firstnameEl) return;
  const tokens = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const surnameTokens = tokens.filter(t => t === t.toUpperCase() && t !== t.toLowerCase());
  const firstnameTokens = tokens.filter(t => !(t === t.toUpperCase() && t !== t.toLowerCase()));
  if (surnameTokens.length === 0) {
    surnameEl.textContent = tokens.join(' ');
    firstnameEl.textContent = '';
  } else {
    surnameEl.textContent = surnameTokens.join(' ');
    firstnameEl.textContent = firstnameTokens.join(' ');
  }
}

// Best-effort footer mapping: v1 never displays "poule" and has no bout/
// period/relay sub-line concept at all today. phase_type's full value set
// isn't documented anywhere in this repo -- the only concrete sample
// (test-publisher.js's publishMatch()) uses phase_type: 'DE'. Revisit this
// once real phase_type values from the field are confirmed.
function deriveV2Context(message) {
  const poule = message.poule || message.phase || '';
  const type = (message.phase_type || '').toLowerCase();
  let subline;
  if (type.includes('poule') || type.includes('pool')) {
    subline = I18n.t('subline.bout', { n: message.match });
  } else if (type.includes('team') || type.includes('relay')) {
    subline = I18n.t('subline.relay', { n: message.round });
  } else {
    subline = I18n.t('subline.period', { n: message.round }); // default, matches v1's existing round-as-period display
  }
  return { poule: String(poule), subline };
}

const fullscreenButton = document.getElementById('fullscreen-btn');
let isFullscreen = false;

fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFullscreen) {
    exitFullscreen();
  }
});

function toggleFullscreen() {
  if (!isFullscreen) {
    enterFullscreen();
  } else {
    exitFullscreen();
  }
}

function enterFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
  isFullscreen = true;
  window.addEventListener('resize', handleResize);
  applyPisteFrame();
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
  isFullscreen = false;
  window.removeEventListener('resize', handleResize);
  const container = document.querySelector('.scoring-container');
  if (container) {
    container.classList.remove('frame-red', 'frame-green', 'frame-yellow', 'frame-blue', 'frame-gold');
  }
}

function applyPisteFrame() {
  const container = document.querySelector('.scoring-container');
  if (!container) return;
  container.classList.remove('frame-red', 'frame-green', 'frame-yellow', 'frame-blue', 'frame-gold');
  if (!document.fullscreenElement) return;
  const s = (displayedPiste || '').toLowerCase();
  if (!s) return;
  if (s.includes('podium')) container.classList.add('frame-gold');
  else if (s.includes('red')) container.classList.add('frame-red');
  else if (s.includes('green')) container.classList.add('frame-green');
  else if (s.includes('yellow')) container.classList.add('frame-yellow');
  else if (s.includes('blue')) container.classList.add('frame-blue');
}

document.addEventListener('fullscreenchange', applyPisteFrame);

// Board sizing is pure CSS (style.css: aspect-ratio + container units, with
// a portrait shape on portrait screens). This only clears inline sizes an
// older version of this function set, so the CSS always wins.
function handleResize() {
  const container = document.querySelector('.scoring-container');
  if (!container) return;
  container.style.width = '';
  container.style.height = '';
}

function updateFlag(flagElement, nocCode) {
  if (nocCode && nocCode.length === 3) {
    const newSrc = `/flags/${nocCode.toUpperCase()}.png`;
    if (flagElement.getAttribute('src') !== newSrc) {
      flagElement.src = newSrc;
    }
    flagElement.style.display = 'block';
    flagElement.onerror = () => {
      flagElement.style.display = 'none';
      flagElement.src = '';
    };
  } else {
    flagElement.style.display = 'none';
    flagElement.src = '';
  }
}

function loadFencerPhotos() {
  if (!currentPiste || !source.photos) return;
  loadPhoto('left', currentPiste);
  loadPhoto('right', currentPiste);
}

function loadPhoto(position, pisteNumber) {
  const photoElement = position === 'left' ? elements.leftPhoto : elements.rightPhoto;
  const imgElement = position === 'left' ? elements.leftPhotoImg : elements.rightPhotoImg;
  const extensions = ['jpg', 'jpeg', 'png', 'gif'];
  let extensionIndex = 0;
  function tryNextExtension() {
    if (extensionIndex >= extensions.length) {
      photoElement.classList.remove('visible');
      return;
    }
    const ext = extensions[extensionIndex];
    const photoUrl = `/fencers/piste-${pisteNumber}/${position}.${ext}?t=${Date.now()}`;
    const testImg = new Image();
    testImg.onload = () => {
      imgElement.src = photoUrl;
      photoElement.classList.add('visible');
    };
    testImg.onerror = () => {
      extensionIndex++;
      tryNextExtension();
    };
    testImg.src = photoUrl;
  }
  tryNextExtension();
}

window.addEventListener('resize', handleResize);
