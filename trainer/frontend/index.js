(() => {
  const modCache = {};
  async function Define(fn) {
    const a = document.createElement('a');
    a.href = document.currentScript.src;
    const cache = modCache[a.pathname];
    cache && cache.resolve(await fn());
  }
  function require(name) {
    const a = document.createElement('a');
    if (!/\.js$/i.test(name)) {
      name += '.js';
    }
    a.href = name;
    const pathname = a.pathname;
    if (!modCache[pathname]) {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = pathname;
      document.head.appendChild(script);
      const cache = {};
      cache.promise = new Promise(resolve => {
        cache.resolve = resolve;
      });
      modCache[pathname] = cache;
    }
    return modCache[pathname].promise;
  }
  window.Define = Define;
  window.require = require;
  require('main');
})();
