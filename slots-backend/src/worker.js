const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const html = (body, status = 200, headers = {}) => new Response(body, {
  status,
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers }
});
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
});
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function cors(request, env) {
  const requestOrigin = request.headers.get('origin');
  const allowed = requestOrigin === env.PUBLIC_ORIGIN ? requestOrigin : env.PUBLIC_ORIGIN;
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  Object.entries(cors(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function text(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizedWebsite(value) {
  const raw = text(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch { return null; }
}

function validEmail(value) {
  const email = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function createSession(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `spots-admin.${expires}`;
  return `${payload}.${await hmac(payload, env.ADMIN_PASSWORD)}`;
}

async function isAdmin(request, env) {
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)spots_admin=([^;]+)/)?.[1];
  if (!token || !env.ADMIN_PASSWORD) return false;
  const [scope, expires, signature] = token.split('.');
  const payload = `${scope}.${expires}`;
  if (scope !== 'spots-admin' || !expires || Number(expires) < Date.now() / 1000) return false;
  return signature === await hmac(payload, env.ADMIN_PASSWORD);
}

async function notify(env, payload) {
  if (!env.MAILER_URL || !env.MAILER_TOKEN) return;
  const response = await fetch(env.MAILER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: env.MAILER_TOKEN, ...payload })
  });
  if (!response.ok) console.error('Mailer failed', response.status);
}

async function activeSpots(env) {
  const result = await env.DB.prepare(`SELECT id, spot_number, website, logo_key, published_at, expires_at, total_clicks, status
    FROM applications WHERE status = 'pending' OR (status = 'published' AND expires_at > ?) ORDER BY spot_number`).bind(now()).all();
  return result.results.map(row => ({
    id: row.id,
    spot: row.spot_number,
    status: row.status,
    ...(row.status === 'published' ? {
      website: row.website,
      logoUrl: `/logos/${row.logo_key}`,
      goUrl: `/go/${row.id}`,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
      clicks: row.total_clicks
    } : {})
  }));
}

async function submitApplication(request, env) {
  const form = await request.formData();
  const spot = Number(form.get('spot'));
  const website = normalizedWebsite(form.get('website'));
  const email = validEmail(form.get('email'));
  const message = text(form.get('message')) || null;
  const logo = form.get('logo');
  if (!Number.isInteger(spot) || spot < 1 || spot > 12 || !website || !email || !(logo instanceof File)) {
    return json({ error: 'Please provide a valid spot, website, email and logo.' }, 400);
  }
  if (!ALLOWED_TYPES.has(logo.type) || logo.size > MAX_LOGO_BYTES) {
    return json({ error: 'Logo must be PNG, JPG, WEBP, GIF or SVG and at most 5 MB.' }, 400);
  }
  const occupied = await env.DB.prepare(`SELECT id FROM applications WHERE spot_number = ? AND (status = 'pending' OR (status = 'published' AND expires_at > ?))`).bind(spot, now()).first();
  if (occupied) return json({ error: 'This spot has just been taken. Please choose another one.' }, 409);
  const applicationId = id();
  const extension = logo.type === 'image/svg+xml' ? 'svg' : logo.type.split('/')[1].replace('jpeg', 'jpg');
  const logoKey = `${applicationId}.${extension}`;
  await env.LOGOS.put(logoKey, logo.stream(), { httpMetadata: { contentType: logo.type } });
  try {
    await env.DB.prepare(`INSERT INTO applications (id, spot_number, website, email, message, logo_key, logo_content_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(applicationId, spot, website, email, message, logoKey, logo.type, now()).run();
  } catch (error) {
    await env.LOGOS.delete(logoKey);
    throw error;
  }
  const adminUrl = `${new URL(request.url).origin}/admin`;
  await notify(env, {
    to: env.OWNER_EMAIL,
    subject: `Spots: Spot #${spot} is awaiting review`,
    html: `<p>A new application is awaiting manual payment and content review.</p><p><strong>Spot:</strong> #${spot}<br><strong>Website:</strong> <a href="${website}">${website}</a><br><strong>Email:</strong> ${email}</p><p><a href="${adminUrl}">Open Spots admin</a></p>`
  });
  await notify(env, {
    to: email,
    subject: 'Spots — we received your submission',
    html: `<p>Thank you for your submission.</p><p>We’ll verify your payment and review the content. Your logo and link will be published within 12 hours when approved. If it isn’t safe or appropriate to publish, we’ll let you know.</p><p>We’ll email you again when it is live.</p>`
  });
  return json({ id: applicationId, status: 'pending' }, 201);
}

async function reviewApplication(request, env, applicationId, status) {
  const record = await env.DB.prepare('SELECT * FROM applications WHERE id = ?').bind(applicationId).first();
  if (!record || record.status !== 'pending') return json({ error: 'Application is no longer pending.' }, 404);
  const reviewedAt = now();
  if (status === 'publish') {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`UPDATE applications SET status = 'published', reviewed_at = ?, published_at = ?, expires_at = ? WHERE id = ?`)
      .bind(reviewedAt, reviewedAt, expiresAt, applicationId).run();
    await notify(env, { to: record.email, subject: 'Spots — your logo is live', html: `<p>Your logo is now live on Spots for 7 days.</p><p>Thank you for taking part.</p>` });
    return json({ status: 'published', expiresAt });
  }
  const body = await request.json().catch(() => ({}));
  const reason = text(body.reason, 1000) || 'We could not approve this submission for publication.';
  await env.DB.prepare(`UPDATE applications SET status = 'rejected', reviewed_at = ?, rejected_reason = ? WHERE id = ?`)
    .bind(reviewedAt, reason, applicationId).run();
  await notify(env, { to: record.email, subject: 'Spots — submission update', html: `<p>Thanks for your submission. Unfortunately, we can’t publish it.</p><p>${reason}</p>` });
  return json({ status: 'rejected' });
}

async function trackAndRedirect(request, env, applicationId) {
  const record = await env.DB.prepare(`SELECT id, website FROM applications WHERE id = ? AND status = 'published' AND expires_at > ?`).bind(applicationId, now()).first();
  if (!record) return html('<h1>That spot is no longer live.</h1>', 404);
  const fingerprint = `${request.headers.get('cf-connecting-ip') || ''}|${request.headers.get('user-agent') || ''}|${new Date().toISOString().slice(0, 10)}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const visitorHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const clickId = id();
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO clicks (id, application_id, visitor_hash, clicked_at) VALUES (?, ?, ?, ?)')
    .bind(clickId, applicationId, visitorHash, now()).run();
  await env.DB.prepare('UPDATE applications SET total_clicks = total_clicks + 1, unique_clicks = unique_clicks + ? WHERE id = ?')
    .bind(inserted.meta.changes ? 1 : 0, applicationId).run();
  return Response.redirect(record.website, 302);
}

async function expireSpots(env) {
  const expiring = await env.DB.prepare(`SELECT * FROM applications WHERE status = 'published' AND expires_at <= ? AND expiry_email_sent_at IS NULL`).bind(now()).all();
  for (const record of expiring.results) {
    await env.DB.prepare(`UPDATE applications SET status = 'expired', expiry_email_sent_at = ? WHERE id = ?`).bind(now(), record.id).run();
    await notify(env, {
      to: record.email,
      subject: 'Spots — thank you for being part of the experiment',
      html: `<p>You were a part of the experiment, and that means a lot. Thank you, thank you, and once again thank you.</p><p>Your link was clicked <strong>${record.total_clicks}</strong> times: <strong>${record.unique_clicks}</strong> unique visitors and <strong>${record.total_clicks - record.unique_clicks}</strong> repeat clicks.</p><p>Want the same spot for one more week? Pay again using the Revolut link for spot ${record.spot_number}.</p>`
    });
  }
}

function adminPage() {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spots admin</title><style>body{font-family:Arial,sans-serif;margin:2rem;max-width:1000px}input,button,textarea{font:inherit;padding:.6rem}button{cursor:pointer}table{border-collapse:collapse;width:100%;margin-top:2rem}th,td{text-align:left;border-bottom:1px solid #ddd;padding:.7rem;vertical-align:top}img{width:64px;height:64px;object-fit:contain}#login{max-width:360px}.hidden{display:none}.actions{display:flex;gap:.5rem;flex-wrap:wrap}</style><main><h1>Spots admin</h1><form id="login"><p>Enter the admin password.</p><input required type="password" name="password" autocomplete="current-password"><button>Open applications</button><p id="error"></p></form><section id="panel" class="hidden"><button id="logout">Log out</button><p id="status"></p><table><thead><tr><th>Spot</th><th>Logo</th><th>Applicant</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody></table></section></main><script>const login=document.querySelector('#login'),panel=document.querySelector('#panel'),error=document.querySelector('#error'),body=document.querySelector('tbody'),status=document.querySelector('#status');async function load(){const r=await fetch('/api/admin/applications');if(r.status===401)return;const a=await r.json();login.classList.add('hidden');panel.classList.remove('hidden');body.innerHTML=a.map(x=>'<tr><td>#'+x.spot_number+'</td><td><a href="/logos/'+x.logo_key+'" target="_blank"><img src="/logos/'+x.logo_key+'"></a></td><td><a href="'+x.website+'" target="_blank">'+x.website+'</a><br>'+x.email+(x.message?'<br><em>'+x.message+'</em>':'')+'</td><td>'+x.status+'</td><td class="actions">'+(x.status==='pending'?'<button data-id="'+x.id+'" data-action="publish">Publish</button><button data-id="'+x.id+'" data-action="reject">Reject</button>':'—')+'</td></tr>').join('')}login.onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:new FormData(login).get('password')})});if(!r.ok){error.textContent='Incorrect password.';return}await load()};body.onclick=async e=>{const b=e.target.closest('button[data-action]');if(!b)return;let reason='';if(b.dataset.action==='reject'){reason=prompt('Reason for rejection (optional):')??'';if(reason===null)return}const r=await fetch('/api/admin/applications/'+b.dataset.id+'/'+b.dataset.action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reason})});if(!r.ok){status.textContent='Could not update this application.';return}status.textContent='Updated.';await load()};document.querySelector('#logout').onclick=async()=>{await fetch('/api/admin/logout',{method:'POST'});location.reload()};load();</script>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request, env) });
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/admin') return html(adminPage());
    if (url.pathname.startsWith('/logos/')) {
      const object = await env.LOGOS.get(url.pathname.slice('/logos/'.length));
      return object ? new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } }) : new Response('Not found', { status: 404 });
    }
    if (url.pathname.startsWith('/go/')) return trackAndRedirect(request, env, url.pathname.slice(4));
    if (url.pathname === '/api/spots' && request.method === 'GET') return withCors(json(await activeSpots(env)), request, env);
    if (url.pathname === '/api/applications' && request.method === 'POST') return withCors(await submitApplication(request, env), request, env);
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      const { password } = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) return json({ error: 'Unauthorized' }, 401);
      return json({ ok: true }, 200, { 'set-cookie': `spots_admin=${await createSession(env)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}` });
    }
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': 'spots_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
    if (url.pathname === '/api/admin/applications' && request.method === 'GET') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      const applications = await env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();
      return json(applications.results);
    }
    const review = url.pathname.match(/^\/api\/admin\/applications\/([^/]+)\/(publish|reject)$/);
    if (review && request.method === 'POST') {
      if (!await isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
      return reviewApplication(request, env, review[1], review[2]);
    }
    return json({ error: 'Not found' }, 404);
  },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(expireSpots(env)); }
};
