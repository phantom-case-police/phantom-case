(function(){
  'use strict';
  const body = document.body;
  const source = document.currentScript && document.currentScript.src;

  function recordVisit() {
    const api = window.PhantomSecrets;
    if (!api) return;
    const root = source ? new URL('../../', source).pathname : '';
    const relativePath = root && location.pathname.indexOf(root) === 0
      ? location.pathname.slice(root.length) : '';
    // Prefer the real page path. The old HTML number is never used as a new ID.
    const item = api.lookup(relativePath) || api.lookup(body.dataset.secretPath);
    if (!item) return;
    body.dataset.secretLegacyId = item.legacyId;
    body.dataset.secretId = item.id;
    body.dataset.secretPath = item.path;
    api.markFound(item.path);
  }

  if (body.dataset.secretId || body.dataset.secretPath) {
    if (window.PhantomSecrets) {
      recordVisit();
    } else if (source) {
      const catalog = document.createElement('script');
      catalog.src = new URL('secrets.js?v=20261001-route-order-v2-1', source).href;
      catalog.onload = recordVisit;
      document.head.appendChild(catalog);
    }
  }

  // Keep the existing image enlargement independent of secret registration.
  document.querySelectorAll('.evidence img').forEach(img => img.addEventListener('click', () => {
    let lightbox = document.querySelector('.lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.innerHTML = '<img>';
      document.body.appendChild(lightbox);
      lightbox.addEventListener('click', () => lightbox.classList.remove('open'));
    }
    lightbox.querySelector('img').src = img.src;
    lightbox.classList.add('open');
  }));
})();
