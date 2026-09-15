const photo = document.querySelector('.about-photo');
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (photo && canHover.matches && !reducedMotion.matches) {
  let frame;
  let offsetX = 0;
  let offsetY = 0;

  const render = () => {
    frame = undefined;
    photo.style.setProperty('--photo-x', `${offsetX}px`);
    photo.style.setProperty('--photo-y', `${offsetY}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  photo.addEventListener('pointermove', event => {
    const bounds = photo.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    offsetX = (x - .5) * 30;
    offsetY = (y - .5) * 20;
    photo.style.setProperty('--glare-x', `${x * 100}%`);
    photo.style.setProperty('--glare-y', `${y * 100}%`);
    photo.style.setProperty('--glare-opacity', '.8');
    schedule();
  });
  photo.addEventListener('pointerleave', () => {
    offsetX = 0;
    offsetY = 0;
    photo.style.setProperty('--glare-opacity', '0');
    schedule();
  });
}
