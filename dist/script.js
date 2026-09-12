const sections = document.querySelectorAll('.slot');
const links = document.querySelectorAll('.nav a');

const setActive = (section) => {
  sections.forEach((item) => item.classList.toggle('is-visible', item === section));
  links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${section.dataset.nav}`));
};

const observer = new IntersectionObserver((entries) => {
  const current = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (current) setActive(current.target);
}, { threshold: [0.5, 0.7] });

sections.forEach((section) => observer.observe(section));
