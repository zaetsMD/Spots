const archive = document.querySelector('#history-archive');
const empty = document.querySelector('.history-empty');
const periodFormatter = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric'
});

function historyCard(spot, index) {
  const item = document.createElement('div');
  item.className = 'history-item';

  if (index < 3) {
    const rank = document.createElement('span');
    rank.className = `history-rank history-rank--${index + 1}`;
    const medal = ['🥇', '🥈', '🥉'][index];
    rank.textContent = `${medal} ${index + 1}${['st', 'nd', 'rd'][index]}`;
    item.append(rank);
  }

  const card = document.createElement('a');
  card.className = 'history-card';
  card.href = spot.website;
  card.target = '_blank';
  card.rel = 'sponsored noopener';
  card.setAttribute('aria-label', `Visit website from past spot ${spot.spot}`);

  const number = document.createElement('span');
  number.className = 'history-spot-number';
  number.textContent = `Spot #${spot.spot}`;

  const logo = document.createElement('img');
  logo.src = spot.logoUrl;
  logo.alt = '';
  logo.loading = 'lazy';

  const period = document.createElement('span');
  period.className = 'history-period';
  period.textContent = `${periodFormatter.format(new Date(spot.publishedAt))} – ${periodFormatter.format(new Date(spot.expiresAt))}`;

  card.append(number, logo);
  item.append(card, period);
  return item;
}

fetch('/api/history')
  .then(response => {
    if (!response.ok) throw new Error(`History request failed: ${response.status}`);
    return response.json();
  })
  .then(spots => {
    if (!Array.isArray(spots)) throw new Error('Invalid history response');
    archive.replaceChildren(...spots.map(historyCard));
    archive.hidden = spots.length === 0;
    empty.hidden = spots.length !== 0;
  })
  .catch(error => {
    console.error(error);
    empty.setAttribute('aria-label', 'History is temporarily unavailable.');
    empty.replaceChildren('History is temporarily unavailable.');
    empty.hidden = false;
  });
