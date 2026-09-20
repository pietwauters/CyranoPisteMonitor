/* The selector control: language dropdown, day/night/auto button and, once
   more than one look exists, a look dropdown. Needs js/prefs.js (and
   js/i18n.js for translated labels). On the overview it slots into .header;
   elsewhere it floats in the bottom-right corner (see css/prefs-ui.css).
   Hidden in fullscreen and for embedded boards. */
(function () {
  'use strict';
  if (!window.Prefs) return;
  if (new URLSearchParams(location.search).get('embed') === '1') return;

  var MODE_ICON = { dark: '☾', light: '☀', auto: '◐' };
  // Language names are shown in their own language, never translated.
  var LANG_NAME = { en: 'English', fr: 'Français', es: 'Español' };
  var t = window.I18n ? I18n.t : function (key) { return key; };

  var box = document.createElement('div');
  box.className = 'prefs-ui';

  var themeSelect = null;
  if (Prefs.THEMES.length > 1) {
    themeSelect = document.createElement('select');
    Prefs.THEMES.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', function () { Prefs.set('theme', themeSelect.value); });
    box.appendChild(themeSelect);
  }

  var langSelect = document.createElement('select');
  Prefs.LANGS.forEach(function (code) {
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = LANG_NAME[code] || code;
    langSelect.appendChild(opt);
  });
  langSelect.addEventListener('change', function () { Prefs.set('lang', langSelect.value); });
  box.appendChild(langSelect);

  var modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.addEventListener('click', function () {
    var modes = Prefs.MODES;
    Prefs.set('mode', modes[(modes.indexOf(Prefs.get().mode) + 1) % modes.length]);
  });
  box.appendChild(modeBtn);

  function render(p) {
    var mode = t('prefs.mode.' + p.mode);
    modeBtn.textContent = MODE_ICON[p.mode] + ' ' + mode;
    modeBtn.title = t('prefs.mode.title', { mode: mode });
    langSelect.setAttribute('aria-label', t('prefs.lang'));
    langSelect.value = p.lang;
    if (themeSelect) {
      themeSelect.setAttribute('aria-label', t('prefs.theme'));
      themeSelect.value = p.theme;
    }
  }
  Prefs.subscribe(render);
  // Dictionaries arrive after prefs are applied; relabel once they're ready.
  if (window.I18n) I18n.subscribe(function () { render(Prefs.get()); });

  var fullscreenBtn = document.querySelector('.header #fullscreen-btn');
  if (fullscreenBtn) fullscreenBtn.parentNode.insertBefore(box, fullscreenBtn);
  else document.body.appendChild(box);
})();
