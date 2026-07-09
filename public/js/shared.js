// Shared helpers used by both the teacher console and the student app.
// Requires avatars.js to be loaded first (it sets window.Avatars).
(function (global) {
  const { AVATARS, AVATAR_PAGES } = global.Avatars;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function confettiHTML(n) {
    const cols = ['var(--quizzes)', 'var(--names)', 'var(--grades)', 'var(--observations)', 'var(--warn)'];
    let html = '';
    for (let i = 0; i < n; i++) {
      const left = Math.round(Math.random() * 100);
      const size = 5 + Math.round(Math.random() * 6);
      const color = cols[i % cols.length];
      const cr = Math.round(Math.random() * 720 - 360);
      const dur = (2.2 + Math.random() * 1.8).toFixed(2);
      const delay = (Math.random() * 2.2).toFixed(2);
      html += `<span style="position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:2px;--cr:${cr}deg;animation:confettiFall ${dur}s linear ${delay}s infinite"></span>`;
    }
    return html;
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  global.QZ = { AVATARS, AVATAR_PAGES, esc, confettiHTML, qs };
})(window);
