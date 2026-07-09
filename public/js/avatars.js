// Shared avatar catalogue — used by the browser (student.js, for the paged
// picker) AND by the server (to validate a chosen avatar), so both sides
// agree on exactly which emoji are valid. Grouped into pages of 8 so the
// picker grid (4 columns x 2 rows) never has to change shape, just content.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Avatars = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const AVATAR_PAGES = [
    { key: 'animals', emojis: ['🦊', '🦉', '🐙', '🦋', '🐬', '🦄', '🐝', '🐧'] },
    { key: 'smileys', emojis: ['😀', '😎', '🤓', '🥳', '😴', '🤠', '👻', '🤖'] },
    { key: 'wildAnimals', emojis: ['🐶', '🐱', '🐢', '🦁', '🐸', '🐨', '🐼', '🦖'] },
    { key: 'sports', emojis: ['⚽', '🏀', '🏈', '🎾', '🏓', '🏐', '🎳', '🏸'] },
    { key: 'food', emojis: ['🍕', '🍔', '🍟', '🌮', '🍩', '🍦', '🍎', '🍉'] },
  ];
  const AVATARS = AVATAR_PAGES.reduce((all, page) => all.concat(page.emojis), []);

  return { AVATAR_PAGES, AVATARS };
}));
