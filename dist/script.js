const main = document.querySelector('.slots');
const sections = [...document.querySelectorAll('.slot')];
const links = [...document.querySelectorAll('.nav a')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 801px) and (min-height: 600px)');
const stage = document.createElement('div');
stage.className = 'scroll-stage';
main.append(stage);
sections.forEach(section => {
  stage.append(section);
  const heading = section.querySelector('h1, h2');
  heading.innerHTML = heading.innerHTML.split(/<br\s*\/?\s*>/i)
    .map(line => `<span class="line"><span>${line}</span></span>`).join('');
});
const clamp = value => Math.max(0, Math.min(1, value));
let enabled = false;
let pending = false;
function render() {
  pending = false;
  const progress = enabled ? clamp(-main.getBoundingClientRect().top / (main.offsetHeight - innerHeight)) * (sections.length - 1) : 0;
  const current = enabled ? Math.round(progress) : sections.reduce((best, section, index) =>
    Math.abs(section.getBoundingClientRect().top) < Math.abs(sections[best].getBoundingClientRect().top) ? index : best, 0);
  sections.forEach((section, index) => {
    const distance = index - progress;
    // Leave time to read before rolling each line through its mask.
    const shift = Math.sign(distance) * clamp((Math.abs(distance) - 0.24) / 0.52);
    section.style.setProperty('--line-shift', `${shift * 110}%`);
    section.style.setProperty('--copy-shift', `${shift * 28}px`);
    section.style.setProperty('--copy-opacity', enabled ? 1 - clamp((Math.abs(distance) - 0.18) / 0.32) : 1);
    section.style.visibility = enabled && Math.abs(distance) > 0.8 ? 'hidden' : 'visible';
    section.inert = enabled && index !== current;
    section.classList.toggle('is-visible', index === current);
  });
  links.forEach(link => {
    const selected = link.hash === `#${sections[current].dataset.nav}`;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function configure() {
  enabled = desktop.matches && !motion.matches;
  main.classList.toggle('scroll-story', enabled);
  render();
}
function goToHash(hash, smooth = true) {
  const target = document.getElementById(hash.slice(1));
  if (!target) return;
  const index = target === main ? 0 : sections.indexOf(target);
  if (index < 0) return;
  const top = enabled
    ? scrollY + main.getBoundingClientRect().top + index / (sections.length - 1) * (main.offsetHeight - innerHeight)
    : scrollY + target.getBoundingClientRect().top;
  window.scrollTo({ top, behavior: smooth && !motion.matches ? 'smooth' : 'instant' });
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || !enabled || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState(null, '', link.hash);
  goToHash(link.hash);
});
window.addEventListener('scroll', () => {
  if (!pending) { pending = true; requestAnimationFrame(render); }
}, { passive: true });
window.addEventListener('resize', configure);
window.addEventListener('hashchange', () => goToHash(location.hash));
motion.addEventListener('change', configure);
desktop.addEventListener('change', configure);
configure();
if (location.hash) requestAnimationFrame(() => goToHash(location.hash, false));
