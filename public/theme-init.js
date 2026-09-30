// Applies a saved light/dark preference before first paint to avoid a theme
// flash. Loaded as an external file because the CSP forbids inline scripts.
// Keep the key in sync with src/hooks/useTheme.ts.
(function () {
  try {
    var t = localStorage.getItem('kc-theme');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) { /* storage unavailable — fall back to system theme */ }
})();
