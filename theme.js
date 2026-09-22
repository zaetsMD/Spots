const themeRoot = document.documentElement;
const themeStorageKey = 'spots-theme';
const themeInteractiveSelector = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

function setTheme(theme) {
  themeRoot.dataset.theme = theme;
  try { localStorage.setItem(themeStorageKey, theme); } catch {}
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.target.closest(themeInteractiveSelector)) return;
  setTheme(themeRoot.dataset.theme === 'dark' ? 'light' : 'dark');
});
