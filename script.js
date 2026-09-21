const main = document.querySelector('.spots');
const sections = [...document.querySelectorAll('.spot-section')];
const links = [...document.querySelectorAll('.nav a')];
const contentLinks = [...document.querySelectorAll('.content-nav a')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 801px) and (min-height: 600px)');
const mobile = matchMedia('(max-width: 800px)');
const presenceCopies = [...document.querySelectorAll('.presence-copy')];
const analyticsShareId = 'YvXVSLKycfkfv74t';
const analyticsGateway = 'https://gateway-eu.umami.is/api';

async function updatePresence() {
  if (!presenceCopies.length) return;
  try {
    const share = await fetch(`${analyticsGateway}/share/${analyticsShareId}`).then(response => {
      if (!response.ok) throw new Error('Analytics share unavailable');
      return response.json();
    });
    const headers = {
      'x-umami-share-token': share.token,
      'x-umami-share-context': share.shareId,
    };
    const [active, totals] = await Promise.all([
      fetch(`${analyticsGateway}/websites/${share.websiteId}/active`, { headers }).then(response => response.json()),
      fetch(`${analyticsGateway}/websites/${share.websiteId}/stats?startAt=${Date.parse('2026-09-13T00:00:00Z')}&endAt=${Date.now()}`, { headers }).then(response => response.json()),
    ]);
    const copy = `${Number(active.visitors || 0)} online now, ${Number(totals.visitors || 0).toLocaleString()} visitors`;
    presenceCopies.forEach(presenceCopy => { presenceCopy.textContent = copy; });
  } catch {
    presenceCopies.forEach(presenceCopy => { presenceCopy.textContent = 'Live statistics unavailable'; });
  }
}

updatePresence();
setInterval(updatePresence, 60_000);
const stage = document.createElement('div');
stage.className = 'scroll-stage';
main.append(stage);
sections.forEach(section => {
  stage.append(section);
  const heading = section.querySelector('h1, h2');
  heading.innerHTML = heading.innerHTML.split(/<br\s*\/?\s*>/i)
    .map(line => `<span class="line"><span>${line}</span></span>`).join('');
});
const mobileStoryCarousel = document.createElement('div');
mobileStoryCarousel.className = 'mobile-story-carousel';
sections.filter(section => !section.classList.contains('final')).forEach(section => mobileStoryCarousel.append(section));
stage.append(mobileStoryCarousel);
const clamp = value => Math.max(0, Math.min(1, value));
let enabled = false;
let pending = false;
let mobileStoryObserver;
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
    // The gallery is viewport-pinned on desktop. Its mobile home is the final
    // section, so that section must not be hidden while another copy is active.
    const containsGallery = Boolean(section.querySelector('.spot-gallery'));
    section.style.visibility = enabled && Math.abs(distance) > 0.8 && !containsGallery ? 'hidden' : 'visible';
    section.inert = enabled && index !== current && !containsGallery;
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
  const useMobileStory = mobile.matches && !motion.matches;
  main.classList.toggle('mobile-story', useMobileStory);

  mobileStoryObserver?.disconnect();
  if (useMobileStory) {
    mobileStoryObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('has-entered');
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    sections.forEach(section => mobileStoryObserver.observe(section));
  } else {
    sections.forEach(section => section.classList.add('has-entered'));
  }
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
mobile.addEventListener('change', configure);
configure();
if (location.hash) requestAnimationFrame(() => goToHash(location.hash, false));

// The final story section stays visually present behind the opening scene.
// Route clicks inside the visible statistics label directly, even if a
// decorative layer is momentarily above it while the scene is transitioning.
document.addEventListener('click', event => {
  const statsLink = [...document.querySelectorAll('.presence')].find(link => {
    const rect = link.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
  });
  if (!statsLink) return;
  event.preventDefault();
  event.stopPropagation();
  window.open(statsLink.href, '_blank', 'noopener,noreferrer');
}, true);
document.addEventListener('pointermove', event => {
  document.querySelectorAll('.presence').forEach(link => {
    const rect = link.getBoundingClientRect();
    const isHovered = rect.width > 0 && rect.height > 0 &&
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    link.classList.toggle('is-hovered', isHovered);
  });
}, { passive: true });


// The spot count can be overridden on a preview page without affecting the live page.
const gallery = document.querySelector('.spot-gallery');
const ring = gallery.querySelector('.spot-ring');
const spotCount = Number(document.body.dataset.spotCount) || 12;
const previewPopulatedSpots = Number(document.body.dataset.previewPopulatedSpots) || 0;
const cards = Array.from({ length: spotCount }, (_, index) => {
  const card = document.createElement('a');
  card.className = 'spot-card';
  card.href = '#apply';
  card.setAttribute('aria-label', `Spot ${index + 1} of ${spotCount}: Claim this spot`);
  card.innerHTML = '<svg viewBox="0 0 144 184" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="144" y2="184" /></svg><span class="spot-claim">Claim this<br>spot</span>';
  ring.append(card);
  return card;
});
const heights = [20, -64, 40, -30, 58, -48, 24, -40, 56, -26, -58, 66];
// Scrolling is the deliberate way to circulate the ring. Pointer movement only
// adds a small, reversible camera drift, so cards do not run away from the cursor.
let angle = 0.18;
let pointer = 0;
let pointerY = 0;
let parallaxX = 0;
let parallaxY = 0;
let pointerAngle = 0;
let lastGalleryScroll = scrollY;
let hovered = false;
let focused = false;
let galleryVisible = true;
let previousTime = 0;
let galleryFrame = 0;
const autoplaySpeed = 0.15; // radians per second: one turn in ~42 seconds
function drawGallery() {
  const width = gallery.clientWidth;
  const height = gallery.clientHeight;
  // Move the whole scene first, then let its nearer cards travel farther.
  ring.style.transform = `translate3d(${parallaxX * 22}px, ${parallaxY * 34}px, 0) perspective(1200px) rotateX(${-parallaxY * 2.5}deg) rotateY(${parallaxX * 1.5}deg)`;
  cards.forEach((card, index) => {
    const theta = angle + pointerAngle + index / cards.length * Math.PI * 2;
    const depth = (Math.cos(theta) + 1) / 2;
    const scale = 0.55 + depth * 0.45;
    // The front cards lead and the distant cards lag, like the reference's camera drift.
    const parallax = 8 + depth * 24;
    const x = Math.sin(theta) * width * 0.43 + parallaxX * parallax;
    const y = (depth - 0.5) * height * 0.34 + heights[index] + parallaxY * parallax * 0.62;
    const turn = Math.sin(theta) * -48 + parallaxX * (3 + depth * 6);
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
  if (!hovered && !focused) angle += delta * autoplaySpeed;
  parallaxX += (pointer - parallaxX) * Math.min(1, delta * 7);
  parallaxY += (pointerY - parallaxY) * Math.min(1, delta * 7);
  pointerAngle += (pointer * 0.12 - pointerAngle) * Math.min(1, delta * 5);
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
  pointer = nextPointer;
  pointerY = (event.clientY / innerHeight - 0.5) * 2;
  hovered = Boolean(event.target.closest('.spot-card'));
}, { passive: true });
window.addEventListener('scroll', () => {
  const distance = scrollY - lastGalleryScroll;
  lastGalleryScroll = scrollY;
  // The gallery is viewport-pinned, while deliberate scrolling circulates cards.
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

// Spot application flow.
const application = document.querySelector('.application');
const applicationForm = document.querySelector('.application-form');
const closeApplication = document.querySelector('.application-close');
const spotNumber = document.querySelector('.spot-number');
const paymentNote = document.querySelector('.payment-note');
const paymentBlock = document.querySelector('.payment');
const revolutButton = document.querySelector('.revolut-button');
const submitApplication = document.querySelector('.submit-application');
const submitError = document.querySelector('.application-submit-error');
const messageLabel = document.querySelector('.reveal-after-payment');
const logoUpload = document.querySelector('#logo-upload');
const logoPreview = document.querySelector('.logo-preview');
const uploadPrompt = document.querySelector('.upload-prompt');
const uploadDropzone = document.querySelector('.upload-dropzone');
const thankYou = document.querySelector('.thank-you');
const spotsApi = '';

function formatTimeRemaining(expiresAt) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining / 3600000) % 24;
  const minutes = Math.floor(remaining / 60000) % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

function formatPublicAmount(amountCents) {
  if (!Number.isInteger(amountCents)) return '';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amountCents / 100);
}

function showLiveSpot(spot) {
  const card = cards[spot.spot - 1];
  if (!card) return;
  const logo = document.createElement('img');
  logo.src = `${spotsApi}${spot.logoUrl}`;
  logo.alt = `Advertiser logo in spot ${spot.spot}`;
  const countdown = document.createElement('span');
  countdown.className = 'spot-countdown';
  const header = document.createElement('span');
  header.className = 'spot-card-header';
  const number = document.createElement('span');
  number.innerHTML = `<span class="spot-word">Spot </span>#${spot.spot}`;
  const amount = document.createElement('span');
  amount.textContent = formatPublicAmount(spot.amountCents);
  header.append(number, amount);
  const updateCountdown = () => { countdown.textContent = formatTimeRemaining(spot.expiresAt); };
  updateCountdown();
  window.setInterval(updateCountdown, 60000);
  card.classList.add('is-live');
  card.href = `${spotsApi}${spot.goUrl}`;
  card.target = '_blank';
  card.rel = 'sponsored noopener';
  card.setAttribute('aria-label', `Visit website in live spot ${spot.spot}`);
  card.replaceChildren(header, logo, countdown);
}

function showPendingSpot(spot) {
  const card = cards[spot.spot - 1];
  if (!card) return;
  const label = document.createElement('span');
  label.className = 'spot-pending';
  label.innerHTML = `<span><span class="spot-word">Spot </span>#${spot.spot}</span><strong>Under review</strong>`;
  card.classList.add('is-pending');
  card.removeAttribute('target');
  card.removeAttribute('rel');
  card.href = '#spots';
  card.setAttribute('aria-label', `Spot ${spot.spot} is pending review`);
  card.replaceChildren(label);
}

function showPreviewSpot(card, index) {
  const previewNames = ['Aster', 'Noma', 'Lumen', 'Mori', 'Onda', 'Field', 'Kite', 'Forma', 'Sway', 'North', 'Melo'];
  const name = previewNames[index];
  card.classList.add('is-live', 'is-preview-live');
  card.href = '#spots';
  card.removeAttribute('target');
  card.removeAttribute('rel');
  card.setAttribute('aria-label', `Preview logo: ${name}`);
  card.innerHTML = `<span class="spot-preview-logo spot-preview-logo--${index + 1}">${name}</span><span class="spot-countdown">Preview</span>`;
}

if (previewPopulatedSpots) {
  cards.slice(0, Math.min(previewPopulatedSpots, cards.length)).forEach(showPreviewSpot);
} else {
  fetch(`${spotsApi}/api/spots`)
    .then(response => response.ok ? response.json() : [])
    .then(spots => spots.forEach(spot => spot.status === 'pending' ? showPendingSpot(spot) : showLiveSpot(spot)))
    .catch(() => {});
}
let selectedSpot = 1;
let paymentStarted = false;
let paymentWindowWasHidden = false;
let previewUrl = '';
let uploadedLogoData = '';
let activeFlight;

function revolutUrl(spot) {
  return `https://revolut.me/ashadetare?amount=2500&currency=eur&note=spot${spot}`;
}
function closeForm() {
  application.classList.remove('is-open');
  application.classList.remove('is-animating');
  activeFlight?.remove();
  activeFlight = undefined;
  application.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('application-active');
}
function showSubmitAfterReturn() {
  if (paymentStarted && (paymentWindowWasHidden || document.hasFocus())) {
    submitApplication.hidden = false;
    messageLabel.hidden = false;
  }
}
function animateSpotToUpload(origin, sourceCard) {
  if (!origin || motion.matches || mobile.matches) return;
  const target = document.querySelector('.upload-dropzone').getBoundingClientRect();
  const flight = sourceCard.cloneNode(true);
  flight.className = 'spot-flight';
  Object.assign(flight.style, {
    left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px`,
    opacity: '1', transform: 'none', zIndex: '31'
  });
  document.body.append(flight);
  activeFlight = flight;
  flight.animate([
    { left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px`, opacity: 1, transform: 'rotate(0deg)' },
    { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: 1, transform: 'rotate(-1.5deg)', offset: .82 },
    { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: 1, transform: 'rotate(0deg)' }
  ], { duration: 900, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }).finished.finally(() => {
    Object.assign(flight.style, {
      left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`,
      opacity: '1', transform: 'none', zIndex: '31'
    });
    application.classList.remove('is-animating');
    flight.classList.add('is-arrived');
    flight.innerHTML = '<span class="spot-upload-prompt">Click<br>to upload<br>logo</span>';
    flight.addEventListener('click', () => logoUpload.click(), { once: true });
    flight.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      flight.classList.add('is-dragging');
    });
    flight.addEventListener('dragleave', () => flight.classList.remove('is-dragging'));
    flight.addEventListener('drop', event => {
      event.preventDefault();
      flight.classList.remove('is-dragging');
      handleLogoFile(event.dataTransfer.files[0]);
    });
  });
}
function openForm(spot, origin) {
  selectedSpot = spot;
  paymentStarted = false;
  paymentWindowWasHidden = false;
  paymentBlock.hidden = false;
  submitApplication.hidden = true;
  submitError.hidden = true;
  messageLabel.hidden = true;
  spotNumber.textContent = spot;
  paymentNote.textContent = `spot${spot}`;
  revolutButton.href = revolutUrl(spot);
  application.classList.add('is-open');
  if (origin && !motion.matches && !mobile.matches) application.classList.add('is-animating');
  application.setAttribute('aria-hidden', 'false');
  document.body.classList.add('application-active');
  animateSpotToUpload(origin, cards[spot - 1]);
}
cards.forEach((card, index) => card.addEventListener('click', event => {
  if (card.classList.contains('is-live')) return;
  if (card.classList.contains('is-pending')) { event.preventDefault(); return; }
  event.preventDefault();
  openForm(index + 1, card.getBoundingClientRect());
}));
function cancelSpotApplication() {
  if (!application.classList.contains('is-open')) return;
  const card = cards[selectedSpot - 1];
  const departingCard = activeFlight;
  const from = (departingCard || document.querySelector('.upload-dropzone')).getBoundingClientRect();
  const to = card.getBoundingClientRect();
  const flight = document.createElement('div');
  flight.className = 'spot-flight spot-return';
  flight.innerHTML = departingCard?.innerHTML || '<svg viewBox="0 0 144 184" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="144" y2="184" /></svg><span class="spot-claim">Claim this<br>spot</span>';
  Object.assign(flight.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: '1', transform: 'none', zIndex: '31' });
  card.classList.add('is-returning');
  closeForm();
  document.body.append(flight);
  flight.animate([{ left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, opacity: 1, transform: 'rotate(0deg)' }, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, opacity: 1, transform: 'rotate(-1.5deg)' }], { duration: 900, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'forwards' }).finished.finally(() => { flight.remove(); card.classList.remove('is-returning'); });
}
closeApplication.addEventListener('click', cancelSpotApplication);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && application.classList.contains('is-open')) cancelSpotApplication();
});
revolutButton.addEventListener('click', () => {
  paymentStarted = true;
  paymentWindowWasHidden = false;
  paymentBlock.hidden = true;
  // The payment opens in another tab/window; keep the next step available
  // even when the browser does not emit a reliable focus event on return.
  submitApplication.hidden = false;
  messageLabel.hidden = false;
});
window.addEventListener('blur', () => {
  if (paymentStarted) paymentWindowWasHidden = true;
});
window.addEventListener('focus', showSubmitAfterReturn);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && paymentStarted) paymentWindowWasHidden = true;
  if (!document.hidden) showSubmitAfterReturn();
});
function handleLogoFile(file) {
  if (!file) return;
  // Keep the native input in sync so FormData submission works for dropped files.
  const transfer = new DataTransfer();
  transfer.items.add(file);
  logoUpload.files = transfer.files;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  logoPreview.hidden = true;
  uploadPrompt.hidden = false;
  submitError.hidden = true;
  logoPreview.src = previewUrl;
  activeFlight?.remove();
  activeFlight = undefined;
  const reader = new FileReader();
  reader.addEventListener('load', () => { uploadedLogoData = reader.result; });
  reader.readAsDataURL(file);
  uploadDropzone.classList.remove('has-error');
  uploadDropzone.removeAttribute('aria-invalid');
}
logoUpload.addEventListener('change', () => handleLogoFile(logoUpload.files[0]));
uploadDropzone.addEventListener('dragenter', event => {
  event.preventDefault();
  uploadDropzone.classList.add('is-dragging');
});
uploadDropzone.addEventListener('dragover', event => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  uploadDropzone.classList.add('is-dragging');
});
uploadDropzone.addEventListener('dragleave', event => {
  if (!uploadDropzone.contains(event.relatedTarget)) uploadDropzone.classList.remove('is-dragging');
});
uploadDropzone.addEventListener('drop', event => {
  event.preventDefault();
  uploadDropzone.classList.remove('is-dragging');
  const [file] = event.dataTransfer.files;
  if (file) handleLogoFile(file);
});
uploadDropzone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    logoUpload.click();
  }
});
logoPreview.addEventListener('load', () => {
  logoPreview.hidden = false;
  uploadPrompt.hidden = true;
});
logoPreview.addEventListener('error', () => {
  logoPreview.removeAttribute('src');
  uploadPrompt.hidden = true;
  submitError.textContent = 'This browser cannot preview HEIC images. Please convert it to JPG, PNG or WEBP and upload again.';
  submitError.hidden = false;
});
function markSpotPending(card) { card.classList.add('is-pending'); card.setAttribute('aria-label', `Spot ${selectedSpot} is pending review`); card.innerHTML = '<span class="spot-pending">Pending<br><strong>Under review</strong></span>'; }
function openThankYou() {
  if (uploadedLogoData) sessionStorage.setItem('spots-pending-logo', uploadedLogoData);
  else sessionStorage.removeItem('spots-pending-logo');
  location.assign(`/thank-you?spot=${selectedSpot}`);
}
function returnSpotToRing() {
  closeForm();
  openThankYou();
}
function showMissingLogoError() {
  const message = 'Please upload your logo before submitting the application.';
  submitError.textContent = message;
  submitError.hidden = false;
  uploadDropzone.classList.add('has-error');
  uploadDropzone.setAttribute('aria-invalid', 'true');
  uploadDropzone.focus({ preventScroll: true });
  uploadDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
submitApplication.addEventListener('click', event => {
  if (!logoUpload.files[0]) {
    event.preventDefault();
    showMissingLogoError();
  }
});
applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!paymentStarted || submitApplication.hidden) return;

  const [logo] = logoUpload.files;
  if (!logo) {
    showMissingLogoError();
    return;
  }
  if (!applicationForm.reportValidity()) return;

  const data = new FormData(applicationForm);
  data.set('spot', String(selectedSpot));
  data.set('logo', logo);
  submitApplication.disabled = true;
  const originalLabel = submitApplication.textContent;
  submitApplication.textContent = 'Submitting…';
  try {
    const response = await fetch(`${spotsApi}/api/applications`, { method: 'POST', body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Your submission could not be sent. Please try again.');
    returnSpotToRing();
  } catch (error) {
    submitError.textContent = error.message;
    submitError.hidden = false;
  } finally {
    submitApplication.disabled = false;
    submitApplication.textContent = originalLabel;
  }
}, true);
