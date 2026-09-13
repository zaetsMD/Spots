const main = document.querySelector('.slots');
const sections = [...document.querySelectorAll('.slot')];
const links = [...document.querySelectorAll('.nav a')];
const contentLinks = [...document.querySelectorAll('.content-nav a')];
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
  contentLinks.forEach(link => {
    const selected = link.hash === `#${sections[current].dataset.nav}`;
    link.classList.toggle('active', selected);
    link.setAttribute('aria-current', selected ? 'location' : 'false');
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
  if (event.defaultPrevented) return;
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
  card.href = '#apply';
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

const application = document.querySelector('.application');
const applicationForm = document.querySelector('.application-form');
const closeApplication = document.querySelector('.application-close');
const slotNumber = document.querySelector('.slot-number');
const paymentNote = document.querySelector('.payment-note');
const revolutLink = document.querySelector('.revolut-link');
const submitApplication = document.querySelector('.submit-application');
const logoUpload = document.querySelector('#logo-upload');
const logoPreview = document.querySelector('.logo-preview');
const uploadPrompt = document.querySelector('.upload-prompt');
const uploadError = document.querySelector('.upload-error');
const thankYou = document.querySelector('.thank-you');
let selectedSlot = 1;
let paymentStarted = false;
let paymentWindowWasHidden = false;
let previewUrl = '';
let activeFlight;
const revolutUrl = slot => `https://revolut.me/ashadetare?amount=2500&currency=eur&note=slot${slot}`;
function closeForm() { application.classList.remove('is-open'); application.classList.remove('is-animating'); activeFlight?.remove(); activeFlight = undefined; application.setAttribute('aria-hidden', 'true'); document.body.classList.remove('application-active'); }
function showSubmitAfterReturn() { if (paymentStarted && (paymentWindowWasHidden || document.hasFocus())) submitApplication.hidden = false; }
function animateSpotToUpload(origin, sourceCard) { if (!origin || motion.matches) return; const target = document.querySelector('.upload-dropzone').getBoundingClientRect(); const flight = sourceCard.cloneNode(true); flight.className = 'spot-flight'; Object.assign(flight.style, { left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px`, transform: 'none' }); document.body.append(flight); activeFlight = flight; flight.animate([{ left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px`, opacity: 1, transform: 'rotate(0deg)' }, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: 1, transform: 'rotate(-1.5deg)', offset: .82 }, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: 1, transform: 'rotate(0deg)' }], { duration: 420, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }).finished.finally(() => { Object.assign(flight.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: '1', transform: 'none', zIndex: '31' }); application.classList.remove('is-animating'); flight.classList.add('is-arrived'); flight.innerHTML = '<span class="spot-upload-prompt">Click<br>to upload<br>logo</span>'; flight.addEventListener('click', () => logoUpload.click(), { once: true }); }); }
function openForm(slot, origin) { selectedSlot = slot; paymentStarted = false; paymentWindowWasHidden = false; submitApplication.hidden = true; slotNumber.textContent = slot; paymentNote.textContent = `slot${slot}`; revolutLink.href = revolutUrl(slot); application.classList.add('is-open'); if (origin && !motion.matches) application.classList.add('is-animating'); application.setAttribute('aria-hidden', 'false'); document.body.classList.add('application-active'); animateSpotToUpload(origin, cards[slot - 1]); }
cards.forEach((card, index) => card.addEventListener('click', event => { event.preventDefault(); openForm(index + 1, card.getBoundingClientRect()); }));
function cancelSpotApplication() { if (!application.classList.contains('is-open')) return; const card = cards[selectedSlot - 1]; const departingCard = activeFlight; const from = (departingCard || document.querySelector('.upload-dropzone')).getBoundingClientRect(); const to = card.getBoundingClientRect(); const flight = document.createElement('div'); flight.className = 'spot-flight spot-return'; flight.innerHTML = departingCard?.innerHTML || '<svg viewBox="0 0 144 184" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="144" y2="184" /></svg><span class="spot-claim">Claim this<br>spot<br>for €25</span>'; Object.assign(flight.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: '1', transform: 'none', zIndex: '31' }); card.classList.add('is-returning'); closeForm(); document.body.append(flight); flight.animate([{ left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: 1, transform: 'rotate(0deg)' }, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: 1, transform: 'rotate(-1.5deg)' }], { duration: 900, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }).finished.finally(() => { flight.remove(); card.classList.remove('is-returning'); }); }
closeApplication.addEventListener('click', cancelSpotApplication);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && application.classList.contains('is-open')) cancelSpotApplication(); });
revolutLink.addEventListener('click', () => { paymentStarted = true; paymentWindowWasHidden = false; });
window.addEventListener('blur', () => { if (paymentStarted) paymentWindowWasHidden = true; });
window.addEventListener('focus', showSubmitAfterReturn);
document.addEventListener('visibilitychange', () => { if (document.hidden && paymentStarted) paymentWindowWasHidden = true; if (!document.hidden) showSubmitAfterReturn(); });
logoUpload.addEventListener('change', () => { const [file] = logoUpload.files; if (!file) return; if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(file); logoPreview.src = previewUrl; logoPreview.hidden = false; uploadPrompt.hidden = true; activeFlight?.remove(); activeFlight = undefined; });
logoUpload.addEventListener('change', () => { if (!logoUpload.files[0]) return; logoPreview.hidden = true; uploadPrompt.hidden = false; uploadError.hidden = true; });
logoPreview.addEventListener('load', () => { logoPreview.hidden = false; uploadPrompt.hidden = true; });
logoPreview.addEventListener('error', () => { logoPreview.removeAttribute('src'); uploadPrompt.hidden = true; uploadError.textContent = 'This browser cannot preview HEIC images. Please convert it to JPG, PNG or WEBP and upload again.'; uploadError.hidden = false; });
function markSpotPending(card) { card.classList.add('is-pending'); card.setAttribute('aria-label', `Spot ${selectedSlot} is pending review`); card.innerHTML = '<span class="spot-pending">Pending<br><strong>Under review</strong></span>'; }
function openThankYou() { location.assign(`thank-you.html?spot=${selectedSlot}`); }
function returnSpotToRing() { const card = cards[selectedSlot - 1]; const from = document.querySelector('.upload-dropzone').getBoundingClientRect(); const to = card.getBoundingClientRect(); const flight = document.createElement('div'); flight.className = 'spot-flight spot-return'; if (logoPreview.src && !logoPreview.hidden) { const image = logoPreview.cloneNode(); image.hidden = false; flight.append(image); } else flight.innerHTML = '<span>Pending<br><strong>Under review</strong></span>'; Object.assign(flight.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: '1', transform: 'none', zIndex: '31' }); card.classList.add('is-returning'); closeForm(); document.body.append(flight); flight.animate([{ left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: 1, transform: 'rotate(0deg)' }, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: 1, transform: 'rotate(1.5deg)' }], { duration: 900, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }).finished.finally(() => { flight.remove(); card.classList.remove('is-returning'); markSpotPending(card); openThankYou(); }); }
applicationForm.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); if (!paymentStarted || submitApplication.hidden || !applicationForm.reportValidity()) return; returnSpotToRing(); }, true);
