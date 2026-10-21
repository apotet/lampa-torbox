/* My TorBox: permanent entry point. Keep this URL installed in Lampa. */
(function () {
  'use strict';
  if (window.__myTorboxLibrary01 || window.__myTorboxLoaderPending) return;
  window.__myTorboxLoaderPending = true;

  var sources = [
    'https://apotet.github.io/lampa-torbox/torbox-library.js',
    'https://raw.githubusercontent.com/apotet/lampa-torbox/main/torbox-library.js'
  ];
  var stamp = Date.now();

  function load(index) {
    var script = document.createElement('script');
    script.async = true;
    // The installed URL never changes; bypass the runtime cache automatically.
    script.src = sources[index] + '?_load=' + stamp;
    script.onload = function () {
      window.__myTorboxLoaderPending = false;
      if (!window.__myTorboxLibraryVersion) failure();
    };
    script.onerror = function () {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (index + 1 < sources.length) load(index + 1);
      else failure();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function failure() {
    window.__myTorboxLoaderPending = false;
    if (window.Lampa && Lampa.Noty) {
      Lampa.Noty.show('Мой TorBox: не удалось загрузить библиотеку. Проверь подключение и открой Lampa заново.');
    }
  }

  load(0);
})();
