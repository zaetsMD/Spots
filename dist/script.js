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


// Twelve unique spots, projected around a gently rotating ring.
const gallery = document.querySelector('.spot-gallery');
const ring = gallery.querySelector('.spot-ring');
const cards = Array.from({ length: 12 }, (_, index) => {
  const card = document.createElement('a');
  card.className = 'spot-card';
  card.href = '#about';
  card.setAttribute('aria-label', `Spot ${index + 1} of 12: Claim this spot for €25`);
  card.innerHTML = '<svg viewBox="0 0 144 184" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="144" y2="184" /></svg><span class="spot-claim">Claim this<br>spot<br>for €25</span>';
  ring.append(card);
  return card;
});
const heights = [20, -64, 40, -30, 58, -48, 24, -40, 56, -26, -58, 66];
let angle = 0.18;
let pointer = 0;
let pointerY = 0;
let parallaxX = 0;
let parallaxY = 0;
let lastGalleryScroll = scrollY;
let hovered = false;
let focused = false;
let galleryVisible = true;
let previousTime = 0;
let galleryFrame = 0;
function drawGallery() {
  const width = gallery.clientWidth;
  const height = gallery.clientHeight;
  // Move the whole scene first, then let its nearer cards travel farther.
  ring.style.transform = `translate3d(${parallaxX * 48}px, ${parallaxY * 34}px, 0) perspective(1200px) rotateX(${-parallaxY * 2.5}deg) rotateY(${parallaxX * 3.5}deg)`;
  cards.forEach((card, index) => {
    const theta = angle + index / cards.length * Math.PI * 2;
    const depth = (Math.cos(theta) + 1) / 2;
    const scale = 0.55 + depth * 0.45;
    // The front cards lead and the distant cards lag, like the reference's camera drift.
    const parallax = 16 + depth * 48;
    const x = Math.sin(theta) * width * 0.43 + parallaxX * parallax;
    const y = (depth - 0.5) * height * 0.34 + heights[index] + parallaxY * parallax * 0.62;
    const turn = Math.sin(theta) * -48 + parallaxX * (7 + depth * 12);
    const pitch = -parallaxY * (3 + depth * 7);
    card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) perspective(800px) rotateX(${pitch}deg) rotateY(${turn}deg) rotateZ(${Math.sin(theta * 2) * 2}deg) scale(${scale})`;
    card.style.opacity = 0.12 + depth * 0.76;
    card.style.zIndex = Math.round(depth * 10);
  });
}
function animateGallery(time) {
  galleryFrame = 0;
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
  previousTime = time;
  parallaxX += (pointer - parallaxX) * Math.min(1, delta * 7);
  parallaxY += (pointerY - parallaxY) * Math.min(1, delta * 7);
  drawGallery();
  if (galleryVisible && !document.hidden && !motion.matches && innerWidth > 800) galleryFrame = requestAnimationFrame(animateGallery);
}
function restartGallery() {
  cancelAnimationFrame(galleryFrame);
  previousTime = 0;
  drawGallery();
  if (galleryVisible && !document.hidden && !motion.matches && innerWidth > 800) galleryFrame = requestAnimationFrame(animateGallery);
}
window.addEventListener('pointermove', event => {
  const nextPointer = (event.clientX / innerWidth - 0.5) * 2;
  // Mouse travel turns the ring itself; simply scrolling does not affect it.
  if (!hovered && !focused) angle += (nextPointer - pointer) * 1.35;
  pointer = nextPointer;
  pointerY = (event.clientY / innerHeight - 0.5) * 2;
  hovered = Boolean(event.target.closest('.spot-card'));
}, { passive: true });
window.addEventListener('scroll', () => {
  const distance = scrollY - lastGalleryScroll;
  lastGalleryScroll = scrollY;
  // The gallery is viewport-pinned, while the cards circulate as the story moves.
  if (!hovered && !focused) angle += distance * 0.0026;
}, { passive: true });
window.addEventListener('blur', () => { pointer = 0; pointerY = 0; hovered = false; });
ring.addEventListener('focusin', () => { focused = true; });
ring.addEventListener('focusout', event => { focused = ring.contains(event.relatedTarget); });
new IntersectionObserver(entries => {
  galleryVisible = entries[0].isIntersecting;
  restartGallery();
}).observe(gallery);
window.addEventListener('resize', restartGallery);
document.addEventListener('visibilitychange', restartGallery);
motion.addEventListener('change', restartGallery);
restartGallery();
