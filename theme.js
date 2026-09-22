const themeRoot = document.documentElement;
const systemDarkTheme = matchMedia('(prefers-color-scheme: dark)');
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
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.target.closest(themeInteractiveSelector)) return;
  setTheme(themeRoot.dataset.theme === 'dark' ? 'light' : 'dark');
});

systemDarkTheme.addEventListener('change', event => {
  setTheme(event.matches ? 'dark' : 'light');
});
