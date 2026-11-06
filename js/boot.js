// Runs before first paint: set the saved (or system) theme so the page does not flash the wrong colours.

(function () {
  let t = null;
  try { t = localStorage.getItem('hsh_theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
})();
