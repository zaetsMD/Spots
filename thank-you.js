const spot = Math.min(12, Math.max(1, Number(new URLSearchParams(location.search).get('spot')) || 1));
const logo = sessionStorage.getItem('spots-pending-logo');
const ring = document.querySelector('.ring');
const positions = [[5,45,-7],[13,42,8],[21,34,-4],[31,52,2],[40,42,-3],[50,57,0],[59,38,5],[68,51,-2],[77,35,4],[86,44,-6],[93,51,3],[64,65,-2]];
positions.forEach(([x, y, r], index) => {
  const card = document.createElement('div');
  card.className = index + 1 === spot ? 'card pending' : 'card';
  card.style.cssText += index + 1 === spot ? 'left:50%;top:45%' : `left:${x}%;top:${y}%;--r:${r}deg`;
  if (index + 1 === spot) card.innerHTML = `<span><span class="spot-word">Spot </span>#${spot}</span>${logo ? `<img src="${logo}" alt="Uploaded logo" />` : ''}<strong>Under review</strong>`;
  ring.append(card);
});
