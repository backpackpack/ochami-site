// Ochami — static site build. No dependencies: `node build.mjs` → dist/
// Content: content/concerts.json. Page text: templates/*.html. Styles: src/styles.css.
// Upcoming vs archive is decided by today's date at build time, so a daily rebuild
// keeps the site current (see README → "Keep dates current").
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE = (process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://ochami.com')).replace(/\/$/, '');
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const OUT = process.env.OUT_DIR || 'dist';

const D = JSON.parse(readFileSync('content/concerts.json', 'utf8'));
const CSS = readFileSync('src/styles.css', 'utf8');
const JS = readFileSync('src/reveal.js', 'utf8');
const tpl = (n) => readFileSync(`templates/${n}`, 'utf8');

const shows = [...D.shows].sort((a, b) => (a.date + a.artist).localeCompare(b.date + b.artist));
const past = shows.filter((s) => s.date < TODAY);
const upc = shows.filter((s) => s.date >= TODAY);
const MEDIA = D.artists || {};

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (a) => a.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dt = (s) => new Date(s.date + 'T12:00:00Z');
const p2 = (n) => String(n).padStart(2, '0');
const dm = (s) => { const d = dt(s); return `${p2(d.getUTCDate())}.${p2(d.getUTCMonth() + 1)}`; };
const dmy = (s) => `${dm(s)}.${s.date.slice(0, 4)}`;
const WD = [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']];
const MON = [['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']];
const A = (s, L) => (L ? s.artist_es : s.artist);
const C = (s, L) => (L ? s.city_es : s.city);
const K = (s, L) => (L ? s.country_name_es : s.country_name);
const uniq = (xs) => [...new Set(xs)];
const countBy = (xs) => { const m = new Map(); xs.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const groupBy = (xs, f) => { const m = new Map(); xs.forEach((x) => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };

// tours = upcoming shows grouped by artist, ordered by first date
const tours = groupBy(upc, (s) => slug(s.artist));
const tourDates = (ss) => {
  const ys = new Set(ss.map((s) => s.date.slice(0, 4)));
  if (ys.size === 1) return ss.length <= 4 ? ss.map(dm).join(' · ') + ' ' + ss[0].date.slice(0, 4) : `${dm(ss[0])} — ${dm(ss.at(-1))} ${ss[0].date.slice(0, 4)}`;
  return `${dmy(ss[0])} — ${dmy(ss.at(-1))}`;
};
const tourCities = (ss, L) => uniq(ss.map((s) => C(s, L))).join(' · ');

const T = [
  { pre: '', home: '/', tba: 'Venue TBA', soon: 'Tickets soon', cal: 'Add to calendar', dates: 'Dates', back: '← All events', also: 'Also coming up',
    next: 'Next show', allTitle: 'All <em>events</em>', count: (n) => `${n} shows coming up`, past: 'Past concerts', booking: 'Booking request',
    arch: 'Archive', concerts: 'concerts', cities: 'cities', countries: 'countries', cols: ['Date', 'Artist', 'City', 'Country'],
    showAll: (n) => `Show all ${n} concerts`, where: 'Where we work', coming: 'Coming up', played: 'Played before',
    mapLabel: 'Map of Europe and the Caucasus as a grid of country tiles', shows: (n) => (n === 1 ? '1 show' : `${n} shows`), more: (n) => `+ ${n} more`,
    nights: (n, y) => `<em>${n}</em> nights since ${y}`, nightsRail: 'Nights', live: 'live', noShows: 'No shows announced right now. New dates usually go up a few weeks ahead.' },
  { pre: '/es', home: '/es/', tba: 'Sala por anunciar', soon: 'Entradas pronto', cal: 'Añadir al calendario', dates: 'Fechas', back: '← Todos los conciertos', also: 'También próximamente',
    next: 'Próximo concierto', allTitle: 'Todos los <em>conciertos</em>', count: (n) => `${n} conciertos próximos`, past: 'Conciertos pasados', booking: 'Propuesta de booking',
    arch: 'Archivo', concerts: 'conciertos', cities: 'ciudades', countries: 'países', cols: ['Fecha', 'Artista', 'Ciudad', 'País'],
    showAll: (n) => `Ver los ${n} conciertos`, where: 'Dónde trabajamos', coming: 'Próximamente', played: 'Ya hemos tocado',
    mapLabel: 'Mapa de Europa y el Cáucaso en forma de cuadrícula de países', shows: (n) => (n === 1 ? '1 concierto' : `${n} conciertos`), more: (n) => `+ ${n} más`,
    nights: (n, y) => `<em>${n}</em> noches desde ${y}`, nightsRail: 'Noches', live: 'en vivo', noShows: 'No hay conciertos anunciados ahora mismo. Las nuevas fechas suelen salir unas semanas antes.' },
];
const eventUrl = (sl, L) => `${T[L].pre}/events/${sl}/`;

// ---------- pieces ----------
function poster(sl, ss, L, big = false) {
  const m = MEDIA[sl];
  if (m) {
    const alt = esc(L ? m.alt_es || m.alt : m.alt);
    if (big) return `<img src="/${m.image}" alt="${alt}" fetchpriority="high" decoding="async">`;
    return `<img class="ph" src="/${m.image}" alt="${alt}" loading="lazy" decoding="async" style="object-position:${m.focus || '50% 50%'}">`;
  }
  const last = big ? tourDates(ss) : `${ss.length} × ${T[L].live}`;
  return `<div class="type-poster" aria-hidden="true">
       <span class="mono">${dm(ss[0])}</span>
       <span class="tp-artist">${esc(A(ss[0], L))}</span>
       <span class="tp-title">${esc(tourCities(ss, L))}</span>
       <span class="mono">${last}</span>
     </div>`;
}
function thumb(s, L) {
  const m = MEDIA[slug(s.artist)];
  if (m) return `<img src="/${m.image}" alt="" loading="lazy" decoding="async" style="object-position:${m.focus || '50% 50%'}">`;
  return `<span>${esc(A(s, L))}</span>`;
}
const card = (sl, ss, L) => `        <li>
          <a class="pcard" href="${eventUrl(sl, L)}">
            <div class="pframe">${poster(sl, ss, L)}</div>
            <div class="pmeta">
              <span class="mono pdate">${tourDates(ss)}</span>
              <span class="partist">${esc(A(ss[0], L))}</span>
              <span class="mono pwhere">${esc(tourCities(ss, L))}</span>
            </div>
          </a>
        </li>`;

function archive(L) {
  const t = T[L];
  const rows = (ss) => ss.map((s) => `
          <li class="row">
            <span class="d mono">${dmy(s)}</span>
            <span class="a">${esc(A(s, L))}</span>
            <span class="c mono">${esc(C(s, L))}</span>
            <span class="v mono">${esc(K(s, L))}</span>
          </li>`).join('');
  const years = (ss) => [...groupBy(ss, (s) => s.date.slice(0, 4))].map(([y, v]) => `
      <div class="year">
        <h3>${y}</h3>
        <ol>${rows(v)}
        </ol>
      </div>`).join('');
  const p = [...past].reverse();
  const cut = D.archiveVisibleFrom || '2025-11-07'; // everything from this date on is open; older rows fold
  const vis = p.filter((s) => s.date >= cut), fold = p.filter((s) => s.date < cut);
  return `<section id="archive" class="section wrap" aria-labelledby="h-arch">
    <div class="rail"><span class="mono">${t.arch}</span></div>
    <div>
      <div class="archive-head">
        <h2 id="h-arch" class="h2">${t.arch}</h2>
        <p class="stats mono">
          <span><b>${past.length}</b> ${t.concerts}</span>
          <span><b>${new Set(past.map((s) => s.city)).size}</b> ${t.cities}</span>
          <span><b>${new Set(past.map((s) => s.country)).size}</b> ${t.countries}</span>
        </p>
      </div>
      <div class="archive">
        <div class="cols mono" aria-hidden="true">${t.cols.map((c) => `<span>${c}</span>`).join('')}</div>${years(vis)}
        ${fold.length ? `<details class="more">
          <summary class="mono">${t.showAll(past.length)}</summary>${years(fold)}
        </details>` : ''}
      </div>
    </div>
  </section>`;
}

function nights(L) {
  const t = T[L];
  if (!past.length) return '';
  const y0 = past[0].date.slice(0, 4);
  const cities = countBy(past.map((s) => C(s, L))).slice(0, 10).map(([c]) => c);
  const figs = (D.gallery || []).map((g, i) => {
    const no = `${p2(i + 1)}A`;
    const pic = g.image
      ? `<img src="/${g.image}" alt="${esc(L ? g.alt_es || g.alt : g.alt)}" loading="lazy" decoding="async" style="object-position:${g.focus || '50% 50%'}">`
      : '<span class="ph-empty mono" aria-hidden="true">[photo]</span>';
    const mark = g.mark ? '<svg class="grease" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M14 52 C 12 22, 48 8, 74 16 C 96 24, 94 70, 66 86 C 40 98, 10 84, 9 58 C 8 42, 22 30, 34 26" pathLength="1"/></svg>' : '';
    const where = [L ? g.city_es || g.city : g.city, g.year].filter(Boolean).join(', ');
    const cap = `<span class="no">${no}</span><span>${esc(g.artist)}</span>` + (where ? `<span class="mute">${esc(where)}</span>` : '');
    return `<figure class="fr f${i + 1}"><div class="pw"><div class="pic"><span class="fno mono" aria-hidden="true">${no}</span>${pic}</div>${mark}</div><figcaption class="mono">${cap}</figcaption></figure>`;
  });
  return `<section id="nights" class="section wrap" aria-labelledby="h-nights">
    <div class="rail"><span class="mono">${t.nightsRail}</span></div>
    <div>
      <div class="nights-head">
        <h2 id="h-nights" class="h2">${t.nights(past.length, y0)}</h2>
        <p class="mono mute">${esc(cities.join(' · '))}</p>
      </div>
      <div class="sheet">
        ${figs.join('')}
      </div>
    </div>
  </section>`;
}

// tile map: [column, row] — rough geography, readable at any size
const GRID = { IS: [0, 0], NO: [4, 0], SE: [5, 0], FI: [6, 0], IE: [0, 1], GB: [1, 1], DK: [4, 1], LV: [6, 1], EE: [7, 1],
  BE: [2, 2], NL: [3, 2], DE: [4, 2], PL: [5, 2], LT: [6, 2], BY: [7, 2], FR: [2, 3], CH: [3, 3], CZ: [4, 3], SK: [5, 3], UA: [6, 3],
  PT: [0, 4], ES: [1, 4], AT: [4, 4], HU: [5, 4], RO: [6, 4], MD: [7, 4], KG: [11, 4], IT: [3, 5], SI: [4, 5], HR: [5, 5], RS: [6, 5],
  BG: [7, 5], GE: [9, 5], AZ: [10, 5], BA: [5, 6], MK: [6, 6], TR: [8, 6], AM: [9, 6], AL: [5, 7], GR: [6, 7], CY: [8, 7] };
function where(L) {
  const t = T[L];
  const nxt = new Set(upc.map((s) => s.country)), pl = new Set(past.map((s) => s.country));
  const names = Object.fromEntries(shows.map((s) => [s.country, K(s, L)]));
  const tiles = Object.entries(GRID).map(([code, [c, r]]) => {
    const cls = nxt.has(code) ? 'tile next' : pl.has(code) ? 'tile played' : 'tile';
    return `<span class="${cls}" style="grid-column:${c + 1};grid-row:${r + 1}" title="${esc(names[code] || code)}">${code}</span>`;
  });
  const by = groupBy(shows, (s) => s.country);
  const order = [...by.keys()].sort((a, b) => by.get(b).length - by.get(a).length);
  const top = order.slice(0, 7), rest = order.slice(7);
  const items = top.map((k) => {
    const ss = by.get(k);
    const cities = countBy(ss.map((s) => C(s, L))).map(([c]) => c);
    const dot = nxt.has(k) ? '<span class="dot" aria-hidden="true"></span>' : '';
    return `<li><span class="pc">${dot}${esc(names[k])}</span><span class="pn mono">${t.shows(ss.length)}</span><span class="pcity mono">${esc(cities.join(' · '))}</span></li>`;
  });
  if (rest.length) items.push(`<li><span class="pc" style="font-size:20px">${t.more(rest.length)}</span><span class="pn mono"></span><span class="pcity mono">${esc(rest.map((k) => names[k]).join(' · '))}</span></li>`);
  return `<section id="where" class="section wrap" aria-labelledby="h-where">
    <div class="rail"><span class="mono">${t.where}</span></div>
    <div>
      <h2 id="h-where" class="h2">${t.where}</h2>
      <div class="where">
        <figure style="margin:0">
          <div class="tiles" role="img" aria-label="${t.mapLabel}">
            ${tiles.join('')}
          </div>
          <figcaption class="key mono"><span><i class="k-next"></i>${t.coming}</span><span><i class="k-played"></i>${t.played}</span></figcaption>
        </figure>
        <ul class="places">
          ${items.join('')}
        </ul>
      </div>
    </div>
  </section>`;
}
function territories(L) {
  const c = countBy(shows.map((s) => s.country));
  const names = Object.fromEntries(shows.map((s) => [s.country, K(s, L)]));
  return '<ul>' + c.slice(0, 5).map(([k]) => `<li>${esc(names[k])}</li>`).join('') + '</ul>' + (c.length > 5 ? `<small>${T[L].more(c.length - 5)}</small>` : '');
}

// ---------- output ----------
const finish = (html) => html.replace('<!--@styles-->', `<style>${CSS}</style>`).replace('<!--@script-->', JS).replaceAll('{{SITE}}', SITE);
function write(path, html) {
  const file = join(OUT, path.replace(/^\//, ''), path.endsWith('/') ? 'index.html' : '');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
rmSync(OUT, { recursive: true, force: true });
// plain file-by-file copy: works on any file system
(function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    if (e.name === ".DS_Store") continue;
    e.isDirectory() ? copyDir(join(from, e.name), join(to, e.name)) : copyFileSync(join(from, e.name), join(to, e.name));
  }
})('public', OUT);

// home pages
for (const L of [0, 1]) {
  const t = T[L];
  let h = tpl(L ? 'home.es.html' : 'home.en.html');
  const first = upc[0];
  const next = first
    ? `<a class="next mono" href="${eventUrl(slug(first.artist), L)}"><span class="mute">${t.next}</span><span>${dm(first)} — ${esc(A(first, L))}, ${esc(C(first, L))}</span><span aria-hidden="true">→</span></a>`
    : `<a class="next mono" href="${t.home}#archive"><span class="mute">${t.next}</span><span>${esc(t.noShows)}</span><span aria-hidden="true">→</span></a>`;
  h = h.replace('<!--@next-->', next)
    .replace('<!--@cards-->', [...tours].slice(0, 3).map(([sl, ss]) => card(sl, ss, L)).join('\n'))
    .replace('<!--@where-->', where(L))
    .replace('<!--@archive-->', archive(L))
    .replace('<!--@nights-->', nights(L))
    .replace('<!--@territories-->', territories(L));
  write(L ? '/es/' : '/', finish(h));
}

// shell for generated pages: head + header from the legal template, footer after </main>
function shell(L, path, title, desc, langHref, extraHead = '', ogImage = null) {
  const base = tpl(L ? 'legal.es.html' : 'legal.en.html');
  let head = base.slice(0, base.indexOf('<main class="wrap">'));
  const foot = base.slice(base.indexOf('</main>'));
  head = head.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`)
    .replaceAll('{{SITE}}/es/legal/', `{{SITE}}/es${path}`).replaceAll('{{SITE}}/legal/', `{{SITE}}${path}`)
    .replace(/(<a class="lang"[^>]*) href="[^"]+"/, `$1 href="${langHref}"`);
  if (ogImage) head = head.replace('{{SITE}}/og.png', `{{SITE}}/${ogImage}`);
  head = head.replace('</head>', extraHead + '</head>');
  return [head, foot];
}

// event pages + calendar files
for (const [sl, ss] of tours) {
  for (const L of [0, 1]) {
    const t = T[L], a = A(ss[0], L);
    const ld = ss.map((s) => ({ '@context': 'https://schema.org', '@type': 'MusicEvent', name: s.artist, startDate: s.date,
      eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: s.venue || 'Venue TBA', address: { '@type': 'PostalAddress', addressLocality: s.city, addressCountry: s.country } },
      performer: { '@type': 'PerformingGroup', name: s.artist }, organizer: { '@type': 'Organization', name: 'Ochami', url: SITE },
      ...(MEDIA[sl] ? { image: `${SITE}/${MEDIA[sl].image}` } : {}) }));
    const [head, foot] = shell(L, `/events/${sl}/`, `${a} — ${tourCities(ss, L)} · Ochami`,
      `${a}. ` + ss.map((s) => `${dmy(s)} ${C(s, L)}`).join(' · ') + '. Ochami.',
      eventUrl(sl, L ? 0 : 1), `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n`, MEDIA[sl]?.image);
    const dates = ss.map((s) => {
      const d = dt(s), ics = `/events/${sl}/${s.date}.ics`;
      return `        <li class="date">
          <div class="dd"><span class="dnum">${dm(s)}</span><span class="mono mute">${WD[L][d.getUTCDay()]} ${d.getUTCFullYear()}</span></div>
          <div class="dw"><span class="dcity">${esc(C(s, L))}, ${esc(K(s, L))}</span><span class="mono mute">${esc(s.venue || t.tba)}</span></div>
          <div class="da mono">
            ${s.tickets ? `<a class="btn" href="${esc(s.tickets)}">${L ? 'Entradas' : 'Tickets'}</a>` : `<span class="mute">${t.soon}</span>`}
            <a href="${ics}" download>${t.cal}</a>
          </div>
        </li>`;
    });
    const others = [...tours].filter(([o]) => o !== sl).slice(0, 3);
    const body = `<main class="wrap">
  <a class="back mono" href="${t.pre}/events/">${t.back}</a>
  <article class="event">
    <div class="event-poster">${poster(sl, ss, L, true)}</div>
    <div class="event-info">
      <p class="mono mute">${ss.map(dmy).join(' · ')}</p>
      <h1 class="event-artist">${esc(a)}</h1>
      <p class="event-title">${esc(tourCities(ss, L))}</p>
      <h2 class="mono label">${t.dates}</h2>
      <ul class="dates">
${dates.join('\n')}
      </ul>
    </div>
  </article>
  ${others.length ? `<section class="also" aria-labelledby="h-also">
    <h2 id="h-also" class="mono label">${t.also}</h2>
    <ol class="posters small">
${others.map(([o, oss]) => card(o, oss, L)).join('\n')}</ol>
  </section>` : ''}
`;
    write(eventUrl(sl, L), finish(head + body + foot));
  }
  for (const s of ss) {
    write(`/events/${sl}/${s.date}.ics`.replace(/\/$/, ''), ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ochami//concerts//EN', 'BEGIN:VEVENT',
      `UID:${sl}-${s.date}-${slug(s.city)}@ochami.com`, `DTSTAMP:${TODAY.replaceAll('-', '')}T000000Z`, `DTSTART;VALUE=DATE:${s.date.replaceAll('-', '')}`,
      `SUMMARY:${s.artist} — ${s.city}`, `LOCATION:${s.venue ? s.venue + ', ' : ''}${s.city}, ${s.country_name}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'));
  }
}

// all events pages
for (const L of [0, 1]) {
  const t = T[L];
  const [head, foot] = shell(L, '/events/', L ? 'Todos los conciertos — Ochami' : 'All events — Ochami',
    L ? 'Próximos conciertos de Ochami.' : 'Upcoming concerts by Ochami.', L ? '/events/' : '/es/events/');
  const secs = [...groupBy(upc, (s) => s.date.slice(0, 7))].map(([ym, ss]) => {
    const [y, m] = ym.split('-').map(Number);
    const rows = ss.map((s) => `        <li><a class="erow" href="${eventUrl(slug(s.artist), L)}">
          <span class="ethumb" aria-hidden="true">${thumb(s, L)}</span>
          <span class="edate"><b>${dm(s)}</b><span class="mono mute">${WD[L][dt(s).getUTCDay()]} ${y}</span></span>
          <span class="ewho"><span class="ea">${esc(A(s, L))}</span></span>
          <span class="ewhere mono"><span>${esc(C(s, L))}, ${esc(K(s, L))}</span><span class="mute">${esc(s.venue || t.tba)}</span></span>
          <span class="estatus mono">${t.soon}<span class="arr" aria-hidden="true">→</span></span>
        </a></li>
`).join('');
    return `  <section class="month" aria-labelledby="m-${ym}">
    <h2 id="m-${ym}">${MON[L][m - 1]} ${y}</h2>
    <ul class="elist">
${rows}    </ul>
  </section>`;
  });
  const body = `<main class="wrap">
  <div class="events-head">
    <h1>${t.allTitle}</h1>
    <p class="mono mute" style="margin:0">${t.count(upc.length)}</p>
  </div>
${secs.length ? secs.join('\n') : `  <p class="lede-c" style="margin-top:64px">${esc(t.noShows)}</p>`}
  <div class="events-foot">
    <a class="cta ghost" href="${t.home}#archive">${t.past} <span class="arr" aria-hidden="true">→</span></a>
    <a class="cta" href="${t.home}#contact">${t.booking} <span class="arr" aria-hidden="true">→</span></a>
  </div>
`;
  write(`${t.pre}/events/`, finish(head + body + foot));
}

// legal pages
write('/legal/', finish(tpl('legal.en.html')));
write('/es/legal/', finish(tpl('legal.es.html')));

// 404
{
  const [head, foot] = shell(0, '/404/', 'Page not found — Ochami', 'This page does not exist.', '/es/');
  write('/404.html'.replace(/\/$/, ''), finish(head.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"') + `<main class="wrap">
  <article class="legal">
    <h1>That page moved.</h1>
    <p>All current shows are in <a href="/events/">All events</a>. Or go back to the <a href="/">homepage</a>.</p>
  </article>
` + foot));
}

// sitemap + robots
const urls = ['/', '/es/', '/events/', '/es/events/', '/legal/', '/es/legal/', ...[...tours.keys()].flatMap((sl) => [`/events/${sl}/`, `/es/events/${sl}/`])];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Built ${OUT}/ for ${SITE} on ${TODAY}: ${past.length} past, ${upc.length} upcoming, ${tours.size} event pages.`);
