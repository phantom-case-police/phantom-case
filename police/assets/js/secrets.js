// SECRET display order: route-order-v2 (2026-10-01).
// This is the single source of truth for numbering; page URLs and search rules
// are unchanged. Retired old IDs 23, 28, 39, and 47 are not imported.
(function(window, document) {
  'use strict';
  const version = '20261001-route-order-v2-1';
  if (window.PhantomSecrets && window.PhantomSecrets.version === version) {
    window.PhantomSecrets.renderCollection();
    return;
  }
  const master = [
    { id: "SECRET 01", legacyId: "SECRET 01", path: "secret/" },
    { id: "SECRET 02", legacyId: "SECRET 02", path: "records/sg-142/" },
    { id: "SECRET 03", legacyId: "SECRET 03", path: "records/rb-002/" },
    { id: "SECRET 04", legacyId: "SECRET 12", path: "records/dt-421/" },
    { id: "SECRET 05", legacyId: "SECRET 04", path: "records/gr-404/" },
    { id: "SECRET 06", legacyId: "SECRET 05", path: "records/tc-118/" },
    { id: "SECRET 07", legacyId: "SECRET 06", path: "records/sr-206/" },
    { id: "SECRET 08", legacyId: "SECRET 10", path: "records/glitch-treatment/" },
    { id: "SECRET 09", legacyId: "SECRET 11", path: "records/op-314/" },
    { id: "SECRET 10", legacyId: "SECRET 25", path: "records/kh-119/" },
    { id: "SECRET 11", legacyId: "SECRET 24", path: "db/cases/case-260910pj/" },
    { id: "SECRET 12", legacyId: "SECRET 26", path: "records/jonathan-identity-note/" },
    { id: "SECRET 13", legacyId: "SECRET 07", path: "records/mf-similarity/" },
    { id: "SECRET 14", legacyId: "SECRET 08", path: "records/ri-317/" },
    { id: "SECRET 15", legacyId: "SECRET 13", path: "records/mf-policy-review/" },
    { id: "SECRET 16", legacyId: "SECRET 15", path: "records/mf-case-conference/" },
    { id: "SECRET 17", legacyId: "SECRET 16", path: "records/comp-mf17/" },
    { id: "SECRET 18", legacyId: "SECRET 14", path: "records/lr-205/" },
    { id: "SECRET 19", legacyId: "SECRET 09", path: "records/sc-231/" },
    { id: "SECRET 20", legacyId: "SECRET 29", path: "records/orbit-12-log/" },
    { id: "SECRET 21", legacyId: "SECRET 30", path: "records/reconciliation-0212/" },
    { id: "SECRET 22", legacyId: "SECRET 17", path: "staff/sn/" },
    { id: "SECRET 23", legacyId: "SECRET 18", path: "records/aud-0214/" },
    { id: "SECRET 24", legacyId: "SECRET 19", path: "db/cases/case-250118mn/" },
    { id: "SECRET 25", legacyId: "SECRET 20", path: "db/cases/case-250127cn/" },
    { id: "SECRET 26", legacyId: "SECRET 21", path: "records/naruse-neptune/" },
    { id: "SECRET 27", legacyId: "SECRET 31", path: "db/cases/case-250101ts/" },
    { id: "SECRET 28", legacyId: "SECRET 50", path: "db/cases/case-240713ys/" },
    { id: "SECRET 29", legacyId: "SECRET 51", path: "db/cases/case-241019ks/" },
    { id: "SECRET 30", legacyId: "SECRET 32", path: "records/fujimura-0214/" },
    { id: "SECRET 31", legacyId: "SECRET 34", path: "records/ir-0217/" },
    { id: "SECRET 32", legacyId: "SECRET 33", path: "records/cls-0106/" },
    { id: "SECRET 33", legacyId: "SECRET 35", path: "records/op-0106/" },
    { id: "SECRET 34", legacyId: "SECRET 36", path: "archive/newsclip-20250529/" },
    { id: "SECRET 35", legacyId: "SECRET 37", path: "records/naruse-involvement/" },
    { id: "SECRET 36", legacyId: "SECRET 38", path: "records/kuze-threat-240722/" },
    { id: "SECRET 37", legacyId: "SECRET 40", path: "records/ic-0617/" },
    { id: "SECRET 38", legacyId: "SECRET 41", path: "records/nr-202/" },
    { id: "SECRET 39", legacyId: "SECRET 52", path: "records/kuze-threat-220621/" },
    { id: "SECRET 40", legacyId: "SECRET 22", path: "records/kuze-confession/" },
    { id: "SECRET 41", legacyId: "SECRET 42", path: "records/veil-001/" },
    { id: "SECRET 42", legacyId: "SECRET 43", path: "records/orbit-12-plan/" },
    { id: "SECRET 43", legacyId: "SECRET 44", path: "records/veil-001-evaluation/" },
    { id: "SECRET 44", legacyId: "SECRET 45", path: "records/veil-001-selection/" },
    { id: "SECRET 45", legacyId: "SECRET 46", path: "records/special-school-outcomes/" },
    { id: "SECRET 46", legacyId: "SECRET 27", path: "records/a12-report-card/" },
    { id: "SECRET 47", legacyId: "SECRET 48", path: "records/nagi-identity-record/" },
    { id: "SECRET 48", legacyId: "SECRET 49", path: "records/neptune-disclosure/" },
  ].map(item => Object.freeze(item));
  Object.freeze(master);

  // HTML data-secret-id values are legacy identifiers. The catalog above is
  // authoritative for display numbers. Progress is keyed by stable page paths,
  // so future renumbering cannot unlock a different document by accident.
  const pathKey = 'phantomPoliceSecretPathsV2';
  const legacyKey = 'phantomPoliceSecrets';
  const backupKey = 'phantomPoliceSecretsBackupBeforeRouteOrderV2';
  const byPath = new Map(master.map(item => [item.path, item]));
  const byLegacyId = new Map(master.map(item => [item.legacyId, item]));
  let memory = new Set();

  function normalizePath(value) {
    return String(value || '').split(/[?#]/, 1)[0].replace(/^\/+/, '')
      .replace(/index\.html$/, '').replace(/\/?$/, '/');
  }
  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
    } catch (error) { return []; }
  }
  function saveArray(key, value) {
    try {
      const serialized = JSON.stringify(value);
      if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized);
    } catch (error) { /* Browsing and in-memory progress still work without storage. */ }
  }
  function backupLegacy() {
    try {
      const value = localStorage.getItem(legacyKey);
      if (value !== null && localStorage.getItem(backupKey) === null) {
        localStorage.setItem(backupKey, value);
      }
    } catch (error) { /* Never make page rendering depend on storage permission. */ }
  }
  function readFoundPaths() {
    backupLegacy();
    const found = new Set([...memory, ...readArray(pathKey)]
      .map(normalizePath).filter(path => byPath.has(path)));
    // Keep the old key in the OLD numbering scheme. Cached old pages may still
    // write it, so import it on every read instead of applying a one-off ID swap.
    readArray(legacyKey).forEach(id => {
      const item = byLegacyId.get(id);
      if (item) found.add(item.path);
    });
    const ordered = master.filter(item => found.has(item.path)).map(item => item.path);
    memory = new Set(ordered);
    saveArray(pathKey, ordered);
    return ordered;
  }
  function lookup(path) { return byPath.get(normalizePath(path)) || null; }
  function markFound(path) {
    const item = lookup(path);
    if (!item) return false;
    const found = new Set(readFoundPaths());
    const isNew = !found.has(item.path);
    found.add(item.path);
    memory = found;
    saveArray(pathKey, master.filter(row => found.has(row.path)).map(row => row.path));
    // Backwards compatibility for already-open or cached pages. This value is
    // deliberately the ORIGINAL ID, not item.id from the new display order.
    const legacy = new Set(readArray(legacyKey));
    legacy.add(item.legacyId);
    saveArray(legacyKey, [...legacy]);
    return isNew;
  }
  function foundIds() {
    const paths = new Set(readFoundPaths());
    return master.filter(item => paths.has(item.path)).map(item => item.id);
  }
  function renderCollection() {
    const grid = document.getElementById('secret-grid');
    if (!grid) return;
    const found = new Set(readFoundPaths());
    const fragment = document.createDocumentFragment();
    let count = 0;
    master.forEach(item => {
      const unlocked = found.has(item.path);
      if (unlocked) count += 1;
      const cell = document.createElement(unlocked ? 'a' : 'div');
      cell.className = 'secret-cell ' + (unlocked ? 'found' : 'locked');
      if (unlocked) cell.href = '../' + item.path;
      // Do not reveal route names, document titles, or links on locked cells.
      const number = document.createElement('span');
      number.textContent = item.id;
      const status = document.createElement('span');
      status.textContent = unlocked ? 'FOUND' : 'LOCKED';
      cell.appendChild(number);
      cell.appendChild(status);
      fragment.appendChild(cell);
    });
    grid.replaceChildren(fragment);
    const counter = document.getElementById('secret-counter');
    if (counter) counter.textContent = 'SECRET ' + count + ' / ' + master.length;
    const progress = document.getElementById('secret-progress');
    if (progress) progress.style.width = (master.length ? count / master.length * 100 : 0) + '%';
    const completeCount = document.getElementById('secret-complete-count');
    if (completeCount) completeCount.textContent = '🎉 SECRET ' + master.length + ' / ' + master.length + ' 🎉';
    const complete = document.getElementById('secret-complete');
    if (complete) complete.classList.toggle('show', master.length > 0 && count === master.length);
  }

  window.SECRET_MASTER = master;
  window.PhantomSecrets = Object.freeze({
    version: version, master: master, lookup: lookup,
    readFoundPaths: readFoundPaths, markFound: markFound,
    foundIds: foundIds, renderCollection: renderCollection
  });
  if (document.getElementById('secret-grid')) {
    markFound('secret/');
    renderCollection();
    window.addEventListener('storage', function(event) {
      if (event.key === pathKey || event.key === legacyKey || event.key === null) renderCollection();
    });
    window.addEventListener('pageshow', renderCollection);
  }
})(window, document);
