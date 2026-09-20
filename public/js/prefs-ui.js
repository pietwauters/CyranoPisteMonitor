/* The selector control: day/night/auto button and, once more than one look
   exists, a look dropdown. Needs js/prefs.js. On the overview it slots into
   .header; elsewhere it floats in the bottom-right corner (see
   css/prefs-ui.css). Hidden in fullscreen and for embedded boards. */
(function () {
  'use strict';
  if (!window.Prefs) return;
  if (new URLSearchParams(location.search).get('embed') === '1') return;

  var MODE_ICON = { dark: '☾', light: '☀', auto: '◐' };
  var MODE_LABEL = { dark: 'Night', light: 'Day', auto: 'Auto' };

  var box = document.createElement('div');
  box.className = 'prefs-ui';

  var themeSelect = null;
  if (Prefs.THEMES.length > 1) {
    themeSelect = document.createElement('select');
    themeSelect.setAttribute('aria-label', 'Look');
    Prefs.THEMES.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', function () { Prefs.set('theme', themeSelect.value); });
    box.appendChild(themeSelect);
  }

  var modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.addEventListener('click', function () {
    var modes = Prefs.MODES;
    Prefs.set('mode', modes[(modes.indexOf(Prefs.get().mode) + 1) % modes.length]);
  });
  box.appendChild(modeBtn);

  Prefs.subscribe(function (p) {
    modeBtn.textContent = MODE_ICON[p.mode] + ' ' + MODE_LABEL[p.mode];
    modeBtn.title = 'Display mode: ' + MODE_LABEL[p.mode] + ' (click to change)';
    if (themeSelect) themeSelect.value = p.theme;
  });

  var fullscreenBtn = document.querySelector('.header #fullscreen-btn');
  if (fullscreenBtn) fullscreenBtn.parentNode.insertBefore(box, fullscreenBtn);
  else document.body.appendChild(box);
})();
