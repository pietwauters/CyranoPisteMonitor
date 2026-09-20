/* Translations. Needs js/prefs.js (for the language choice).

   Dictionaries live in /i18n/<lang>.json (flat key -> string, "{name}"
   placeholders). English is always loaded as the fallback, so a missing key
   in fr/es shows English rather than a raw key.

   Static markup:  data-i18n="key"            -> textContent
                   data-i18n-title="key"      -> title attribute
                   data-i18n-alt="key"        -> alt attribute
   Script text:    I18n.t('key', { n: 3 })
   Text built by script must be re-rendered on a language change:
                   I18n.subscribe(fn)  (fn runs once dictionaries are ready,
                                        and again on every language change) */
(function () {
  'use strict';

  var cache = {};
  var en = null;
  var dict = null;
  var loadedLang = null;
  var listeners = [];

  function load(lang) {
    if (!cache[lang]) {
      cache[lang] = fetch('/i18n/' + lang + '.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return cache[lang];
  }

  function t(key, vars) {
    var s = dict && dict[key] !== undefined ? dict[key] : (en && en[key] !== undefined ? en[key] : key);
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  }

  function applyDom() {
    var map = [['data-i18n', null], ['data-i18n-title', 'title'], ['data-i18n-alt', 'alt']];
    map.forEach(function (m) {
      var nodes = document.querySelectorAll('[' + m[0] + ']');
      for (var i = 0; i < nodes.length; i++) {
        var text = t(nodes[i].getAttribute(m[0]));
        if (m[1]) nodes[i].setAttribute(m[1], text);
        else nodes[i].textContent = text;
      }
    });
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function update(lang) {
    if (lang === loadedLang) return;
    Promise.all([load('en'), load(lang)]).then(function (res) {
      if (Prefs.get().lang !== lang) return;   // superseded by a newer choice
      en = res[0];
      dict = res[1];
      loadedLang = lang;
      whenDomReady(function () {
        applyDom();
        listeners.forEach(function (fn) { fn(lang); });
      });
    });
  }

  window.I18n = {
    t: t,
    subscribe: function (fn) {
      listeners.push(fn);
      if (loadedLang) fn(loadedLang);
    }
  };

  Prefs.subscribe(function (p) { update(p.lang); });
})();
