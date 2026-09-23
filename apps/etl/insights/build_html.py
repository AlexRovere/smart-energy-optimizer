# assemble apercu_sites_001_003.html a partir de data.json (genere par prepare_data.py)
import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent
DATA_PATH = OUTPUT_DIR / "data.json"
OUT_PATH = OUTPUT_DIR / "apercu_sites_001_003.html"

with open(DATA_PATH, encoding="utf-8") as f:
    data = json.load(f)

DATA_JSON = json.dumps(data, ensure_ascii=False)

HTML = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Apercu pipeline - SITE001 / SITE003</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page-plane:     #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #898781;
    --gridline:       #e1e0d9;
    --baseline:       #c3c2b7;
    --border:         rgba(11,11,11,0.10);
    --series-1:       #2a78d6;
    --series-2:       #eb6834;
    --div-neg:        #2a78d6;
    --div-pos:        #e34948;
    --div-mid:        #f0efec;
    --status-good:      #0ca30c;
    --status-warning:   #fab219;
    --status-serious:   #ec835a;
    --status-critical:  #d03b3b;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface-1:      #1a1a19;
      --page-plane:     #0d0d0d;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #898781;
      --gridline:       #2c2c2a;
      --baseline:       #383835;
      --border:         rgba(255,255,255,0.10);
      --series-1:       #3987e5;
      --series-2:       #d95926;
      --div-neg:        #3987e5;
      --div-pos:        #e66767;
      --div-mid:        #383835;
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-1:      #1a1a19;
    --page-plane:     #0d0d0d;
    --text-primary:   #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted:     #898781;
    --gridline:       #2c2c2a;
    --baseline:       #383835;
    --border:         rgba(255,255,255,0.10);
    --series-1:       #3987e5;
    --series-2:       #d95926;
    --div-neg:        #3987e5;
    --div-pos:        #e66767;
    --div-mid:        #383835;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--page-plane);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .viz-root { background: var(--page-plane); min-height: 100vh; padding: 24px 28px 64px; }

  header.page { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 8px; }
  header.page h1 { font-size: 20px; margin: 0; }
  header.page .meta { color: var(--text-secondary); font-size: 13px; }
  .theme-toggle { border: 1px solid var(--border); background: var(--surface-1); color: var(--text-secondary);
    border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }

  .filters-row { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; }
  .filters-row label { font-size: 12px; color: var(--text-secondary); }
  .filters-row select { font-size: 13px; color: var(--text-primary); background: var(--surface-1);
    border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font-family: inherit; }

  .col-headers { display: grid; grid-template-columns: 200px 1fr 1fr; gap: 12px; margin: 18px 0 6px; }
  .col-headers .site-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }

  .metric-row { display: grid; grid-template-columns: 200px 1fr 1fr; gap: 12px; align-items: stretch;
    padding: 10px 0; border-top: 1px solid var(--gridline); }
  .metric-row:first-of-type { border-top: none; }
  .metric-name { display: flex; flex-direction: column; justify-content: center; font-size: 13px; color: var(--text-secondary); }
  .metric-name b { color: var(--text-primary); font-size: 13px; font-weight: 600; }

  .chart-card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px 4px; position: relative; }
  svg.chart { display: block; width: 100%; height: 108px; overflow: visible; }
  .chart-line { fill: none; stroke-width: 2px; }
  .gridline { stroke: var(--gridline); stroke-width: 1px; }
  .baseline { stroke: var(--baseline); stroke-width: 1px; }
  .axis-label { fill: var(--text-muted); font-size: 9px; }
  .hover-crosshair { stroke: var(--text-muted); stroke-width: 1px; stroke-dasharray: 2,2; opacity: 0; pointer-events: none; }
  .hover-dot { opacity: 0; pointer-events: none; }
  .tooltip { position: fixed; pointer-events: none; background: var(--text-primary); color: var(--surface-1);
    font-size: 11px; padding: 4px 7px; border-radius: 5px; white-space: nowrap; opacity: 0; transform: translate(-50%, -100%);
    top: 0; left: 0; z-index: 5; }
  .hover-capture { fill: transparent; }

  section.below { margin-top: 32px; }
  section.below h2 { font-size: 16px; margin: 0 0 12px; }
  .below-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .site-block { background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
  .site-block h3 { margin: 0 0 10px; font-size: 14px; display: flex; align-items: center; gap: 8px; }

  .quality-bar { display: flex; height: 14px; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
  .quality-seg { height: 100%; }
  .quality-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
  .quality-legend .item { display: flex; align-items: center; gap: 6px; }
  .quality-legend .swatch { width: 9px; height: 9px; border-radius: 2px; flex: none; }

  table.bounds { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  table.bounds th, table.bounds td { text-align: right; padding: 5px 6px; border-bottom: 1px solid var(--gridline); font-variant-numeric: tabular-nums; }
  table.bounds th:first-child, table.bounds td:first-child { text-align: left; }
  table.bounds th { color: var(--text-muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; }

  table.bounds-wide { table-layout: fixed; }
  table.bounds-wide th:first-child, table.bounds-wide td:first-child { width: 15%; }
  table.bounds-wide th:nth-child(2), table.bounds-wide td:nth-child(2) { width: 6%; }
  table.bounds-wide td:nth-child(2), table.bounds-wide th:nth-child(2) { text-align: left; }
  table.bounds-wide td.stat-label { color: var(--text-muted); font-size: 11px; }
  table.bounds-wide td:first-child { vertical-align: middle; font-weight: 600; border-bottom: none; }
  /* separe visuellement une metrique de la suivante */
  table.bounds-wide tr.metric-sep td { border-top: 2px solid var(--baseline); }

  /* les jetons de couleur vivent sur .viz-root : sans ça, titres et tableaux héritent du noir de body en mode sombre */
  .viz-root { color: var(--text-primary); }
  .section-help { font-size: 12px; color: var(--text-secondary); margin: -6px 0 12px; max-width: 900px; line-height: 1.5; }
  .type { color: var(--text-muted); font-weight: 400; font-size: 12px; }

  table.periodicity { table-layout: fixed; }
  table.periodicity th.c-lag { width: 12%; }
  table.periodicity th.c-subset { width: 16%; text-align: left; }
  table.periodicity th .type { display: block; text-transform: none; letter-spacing: 0; font-size: 11px; }
  table.periodicity td.lag-cell { vertical-align: middle; font-weight: 600; border-bottom: none; }
  table.periodicity td.subset-cell { text-align: left; color: var(--text-muted); font-size: 11px; }
  table.periodicity tr.lag-sep td { border-top: 2px solid var(--baseline); }
  table.periodicity td.value b { font-weight: 600; }
  table.periodicity td.value .rho { display: block; color: var(--text-muted); font-size: 10px; }
  .periodicity-rows { margin-top: 4px; }

  .corr-grid { display: grid; grid-template-columns: 78px repeat(6, 1fr); gap: 2px; }
  .corr-head { display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 10px; color: var(--text-muted); padding: 2px 0; }
  .corr-head.row-head { justify-content: flex-end; text-align: right; padding-right: 6px; }
  .corr-cell { display: flex; align-items: center; justify-content: center; aspect-ratio: 1.6 / 1;
    border-radius: 3px; font-size: 12px; font-variant-numeric: tabular-nums; cursor: default; }
  .corr-cell.diag { background: var(--gridline); color: var(--text-muted); }
  .corr-cell.empty { background: var(--gridline); color: var(--text-muted); font-size: 10px; }
  .corr-legend { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 11px; color: var(--text-secondary); }
  .corr-legend .ramp { width: 160px; height: 10px; border-radius: 3px;
    background: linear-gradient(to right, var(--div-neg), var(--div-mid), var(--div-pos)); }

  footer.note { margin-top: 28px; font-size: 11px; color: var(--text-muted); }

  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    /* impression toujours en clair, quel que soit le theme choisi a l'ecran : lisible, economise l'encre */
    .viz-root {
      color-scheme: light !important;
      --surface-1: #fcfcfb !important; --page-plane: #ffffff !important;
      --text-primary: #0b0b0b !important; --text-secondary: #52514e !important; --text-muted: #6b6a65 !important;
      --gridline: #d8d7cf !important; --baseline: #a9a89f !important; --border: rgba(11,11,11,0.18) !important;
      --div-neg: #2a78d6 !important; --div-pos: #e34948 !important; --div-mid: #f0efec !important;
    }
    .theme-toggle, .filters-row, .tooltip { display: none !important; }
    body, .viz-root { background: #ffffff !important; padding: 0; }
    /* sans ca, l'aperçu avant impression redimensionne toute la page (donc les graphes en 108px et le
       texte en 13px) pour tenir sur une seule largeur de feuille : le texte devient illisible */
    .metric-row, .below-grid, .site-block { break-inside: avoid; }
    svg.chart { height: 150px !important; }
    header.page h1 { font-size: 16pt; }
    .metric-name b, .site-label, section.below h2 { font-size: 11pt; }
    .axis-label { font-size: 7pt; }
  }
</style>
</head>
<body>
<div class="viz-root">

  <header class="page">
    <div>
      <h1>Apercu pipeline &mdash; historique des mesures</h1>
      <div class="meta" id="meta-line"></div>
    </div>
    <button class="theme-toggle" id="theme-toggle" type="button">Mode sombre</button>
  </header>

  <div class="filters-row">
    <label for="period-select">Periode</label>
    <select id="period-select">
      <option value="all" selected>Tout</option>
      <option value="1y">1 an</option>
      <option value="1m">1 mois</option>
      <option value="1w">1 semaine</option>
      <option value="1d">1 jour</option>
    </select>
  </div>

  <div class="col-headers">
    <div></div>
    <div class="site-label"><span class="dot" style="background: var(--series-1)"></span>SITE001</div>
    <div class="site-label"><span class="dot" style="background: var(--series-2)"></span>SITE003</div>
  </div>

  <div id="metric-rows"></div>

  <section class="below">
    <h2>Qualite des mesures</h2>
    <div class="below-grid" id="quality-grid"></div>
  </section>

  <section class="below">
    <h2>Bornes min / max par metrique, tous sites</h2>
    <div id="bounds-card" class="site-block"></div>
  </section>

  <section class="below">
    <h2>Périodicité de la consommation</h2>
    <p class="section-help">
      On compare la consommation à l'instant t à celle de t moins le décalage. Le rapport est l'écart type de
      la différence divisé par l'écart type de la consommation : proche de 0, la série se répète à cette
      période ; autour de 1,41 (racine de 2), le décalage n'apprend rien. ρ est l'autocorrélation au même
      décalage. « Hors week-end » ne garde que les couples où t et t moins le décalage tombent un jour
      ouvré, « Week-end seul » ceux où les deux tombent un samedi ou un dimanche (jours en UTC). Le survol
      d'une cellule donne l'écart type en kW et le nombre de couples. 30 jours n'est pas un multiple de 7 :
      la comparaison décale de 2 jours de semaine. Sous le tableau, les trois graphes d'un même site
      partagent la même échelle.
    </p>
    <div id="periodicity-card" class="site-block"></div>
    <div class="col-headers" id="periodicity-headers"></div>
    <div class="periodicity-rows" id="periodicity-rows"></div>
  </section>

  <section class="below">
    <h2>Corrélations entre métriques</h2>
    <p class="section-help">
      Corrélation de Pearson entre les mesures horaires corrigées, sur toute la période. Bleu : les deux
      métriques évoluent en sens opposé ; rouge : dans le même sens ; gris : pas de lien linéaire.
    </p>
    <div class="below-grid" id="corr-grid"></div>
    <div class="corr-legend"><span>−1</span><span class="ramp"></span><span>+1</span></div>
  </section>

  <footer class="note">Genere localement a partir de <code>PARQUET_DIR</code>, moyennes journalieres (site_id, jour). Analyse ephemere, non publiee. Periodicite et correlations : mesures horaires corrigees.</footer>
</div>

<div class="tooltip" id="tooltip"></div>

<script>
const DATA = __DATA_JSON__;

const QUALITY_STATUS = {
  good: { color: "var(--status-good)", label: "Bonne" },
  partial: { color: "var(--status-warning)", label: "Partielle" },
  degraded: { color: "var(--status-serious)", label: "Degradee" },
  critical: { color: "var(--status-critical)", label: "Critique" },
};
const QUALITY_ORDER = ["good", "partial", "degraded", "critical"];

const SITE_COLOR = { SITE001: "var(--series-1)", SITE003: "var(--series-2)" };

function fmtDate(iso) {
  const hasTime = iso.includes("T");
  const d = hasTime ? new Date(iso) : new Date(iso + "T00:00:00Z");
  if (hasTime) {
    return (
      d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }) +
      " " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    );
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtMonth(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" });
}

// fmtX : formateur de l'axe X et de l'infobulle (dates par défaut, mois pour les séries mensuelles)
// domain : [min, max] imposé à l'axe Y, pour comparer plusieurs graphes entre eux (sinon auto-échelle)
function buildLineChart(svg, points, colorVar, fmtX = fmtDate, domain = null) {
  const W = 600, H = 108, padL = 4, padR = 4, padT = 10, padB = 20;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const values = points.map(p => p.y).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return;
  let minV = Math.min(...values), maxV = Math.max(...values);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  if (domain) { minV = domain[0]; maxV = domain[1]; }
  const span = maxV - minV;
  const n = points.length;
  const x = i => padL + (n <= 1 ? 0 : (innerW * i) / (n - 1));
  const y = v => padT + innerH - ((v - minV) / span) * innerH;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");

  // gridlines (2: mid + baseline)
  const mid = document.createElementNS("http://www.w3.org/2000/svg", "line");
  mid.setAttribute("class", "gridline");
  mid.setAttribute("x1", padL); mid.setAttribute("x2", W - padR);
  mid.setAttribute("y1", padT + innerH / 2); mid.setAttribute("y2", padT + innerH / 2);
  svg.appendChild(mid);

  const base = document.createElementNS("http://www.w3.org/2000/svg", "line");
  base.setAttribute("class", "baseline");
  base.setAttribute("x1", padL); base.setAttribute("x2", W - padR);
  base.setAttribute("y1", padT + innerH); base.setAttribute("y2", padT + innerH);
  svg.appendChild(base);

  // line path, skipping nulls as gaps
  let d = "";
  let drawing = false;
  points.forEach((p, i) => {
    if (p.y === null || p.y === undefined) { drawing = false; return; }
    const cmd = drawing ? "L" : "M";
    d += `${cmd}${x(i).toFixed(2)},${y(p.y).toFixed(2)} `;
    drawing = true;
  });
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "chart-line");
  path.setAttribute("d", d.trim());
  path.setAttribute("style", `stroke: ${colorVar}`);
  svg.appendChild(path);

  // un seul point (ex: filtre "1 jour") : pas de trait a tracer, un marqueur visible a la place
  if (n === 1) {
    const single = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    single.setAttribute("cx", x(0)); single.setAttribute("cy", y(points[0].y));
    single.setAttribute("r", 4);
    single.setAttribute("style", `fill: ${colorVar}`);
    svg.appendChild(single);
  }

  // axis labels: min/max value, first/last date
  const labelMax = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelMax.setAttribute("class", "axis-label");
  labelMax.setAttribute("x", padL); labelMax.setAttribute("y", padT + 6);
  labelMax.textContent = maxV.toFixed(1);
  svg.appendChild(labelMax);

  const labelMin = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelMin.setAttribute("class", "axis-label");
  labelMin.setAttribute("x", padL); labelMin.setAttribute("y", padT + innerH - 5);
  labelMin.textContent = minV.toFixed(1);
  svg.appendChild(labelMin);

  const labelFirst = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelFirst.setAttribute("class", "axis-label");
  labelFirst.setAttribute("x", padL); labelFirst.setAttribute("y", H - 2);
  labelFirst.textContent = fmtX(points[0].x);
  svg.appendChild(labelFirst);

  const labelLast = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelLast.setAttribute("class", "axis-label");
  labelLast.setAttribute("x", W - padR); labelLast.setAttribute("y", H - 2);
  labelLast.setAttribute("text-anchor", "end");
  labelLast.textContent = fmtX(points[n - 1].x);
  svg.appendChild(labelLast);

  // hover layer: crosshair + dot + capture rect
  const crosshair = document.createElementNS("http://www.w3.org/2000/svg", "line");
  crosshair.setAttribute("class", "hover-crosshair");
  crosshair.setAttribute("y1", padT); crosshair.setAttribute("y2", padT + innerH);
  svg.appendChild(crosshair);

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("class", "hover-dot");
  dot.setAttribute("r", 3);
  dot.setAttribute("style", `fill: ${colorVar}`);
  svg.appendChild(dot);

  const capture = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  capture.setAttribute("class", "hover-capture");
  capture.setAttribute("x", 0); capture.setAttribute("y", 0);
  capture.setAttribute("width", W); capture.setAttribute("height", H);
  svg.appendChild(capture);

  const tooltip = document.getElementById("tooltip");

  function onMove(evt) {
    const rect = svg.getBoundingClientRect();
    const relX = (evt.clientX - rect.left) / rect.width * W;
    let i = Math.round(((relX - padL) / innerW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const p = points[i];
    if (p.y === null || p.y === undefined) { crosshair.style.opacity = 0; dot.style.opacity = 0; tooltip.style.opacity = 0; return; }
    const px = x(i), py = y(p.y);
    crosshair.setAttribute("x1", px); crosshair.setAttribute("x2", px);
    crosshair.style.opacity = 1;
    dot.setAttribute("cx", px); dot.setAttribute("cy", py);
    dot.style.opacity = 1;

    const screenX = rect.left + (px / W) * rect.width;
    const screenY = rect.top + (py / H) * rect.height;
    tooltip.style.left = screenX + "px";
    tooltip.style.top = (screenY - 8) + "px";
    tooltip.style.opacity = 1;
    tooltip.textContent = `${fmtX(p.x)} : ${p.y.toFixed(2)}`;
  }
  function onLeave() {
    crosshair.style.opacity = 0; dot.style.opacity = 0; tooltip.style.opacity = 0;
  }
  capture.addEventListener("mousemove", onMove);
  capture.addEventListener("mouseleave", onLeave);
}

// Ancre sur la derniere date presente dans les donnees (pas l'horloge du poste qui ouvre la page) :
// "hier" est le jour precedent cette derniere date, les periodes remontent depuis ce point.
const ALL_DATES = DATA.sites.flatMap(s => DATA.daily[s].dates);
const LAST_DATE = ALL_DATES.reduce((a, b) => (a > b ? a : b));
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(iso) { return new Date(iso + "T00:00:00Z"); }
function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }
function toIso(date) { return date.toISOString().slice(0, 10); }

const PERIOD_DAYS = { "1y": 365, "1m": 30, "1w": 7, "1d": 1 };

function periodBounds(periodKey) {
  if (periodKey === "all") return null;
  const yesterday = addDays(toUtcDate(LAST_DATE), -1);
  const days = PERIOD_DAYS[periodKey];
  const start = addDays(yesterday, -(days - 1));
  return { start: toIso(start), end: toIso(yesterday) };
}

function filterPoints(points, bounds) {
  if (!bounds) return points;
  return points.filter(p => p.x >= bounds.start && p.x <= bounds.end);
}

// "1 jour" et "1 semaine" : grain horaire reel (DATA.hourly), pas la moyenne journaliere.
// Meme ancrage sur "hier" que periodBounds, mais en instants exacts pour comparer des timestamps.
const HOURLY_PERIODS = new Set(["1d", "1w"]);

function periodBoundsHourly(periodKey) {
  const yesterday = addDays(toUtcDate(LAST_DATE), -1);
  const days = PERIOD_DAYS[periodKey];
  const start = addDays(yesterday, -(days - 1));
  const endExclusive = addDays(yesterday, 1); // debut de "aujourd'hui", exclu
  return { start: start.toISOString(), endExclusive: endExclusive.toISOString() };
}

function filterPointsHourly(points, bounds) {
  return points.filter(p => p.x >= bounds.start && p.x < bounds.endExclusive);
}

function renderMetricRows(periodKey) {
  const useHourly = HOURLY_PERIODS.has(periodKey);
  const bounds = useHourly ? periodBoundsHourly(periodKey) : periodBounds(periodKey);
  const rowsEl = document.getElementById("metric-rows");
  rowsEl.innerHTML = "";

  DATA.metrics.forEach(([key, label]) => {
    const row = document.createElement("div");
    row.className = "metric-row";

    const nameCell = document.createElement("div");
    nameCell.className = "metric-name";
    nameCell.innerHTML = `<b>${label}</b>`;
    row.appendChild(nameCell);

    DATA.sites.forEach(site => {
      const card = document.createElement("div");
      card.className = "chart-card";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "chart");
      card.appendChild(svg);
      row.appendChild(card);

      const source = useHourly ? DATA.hourly[site] : DATA.daily[site];
      const timeKey = useHourly ? "timestamps" : "dates";
      const times = source[timeKey];
      const values = source[key];
      const allPoints = times.map((d, i) => ({ x: d, y: values[i] }));
      const points = useHourly ? filterPointsHourly(allPoints, bounds) : filterPoints(allPoints, bounds);
      const hasValue = points.some(p => p.y !== null && p.y !== undefined);
      if (!hasValue) {
        card.innerHTML = '<p style="font-size:12px; color: var(--text-muted); margin: 30px 8px;">Aucune donnee sur cette periode</p>';
        return;
      }
      buildLineChart(svg, points, SITE_COLOR[site]);
    });

    rowsEl.appendChild(row);
  });
}

const SHORT_LABEL = {
  consumption_kw_corrected: "Conso.",
  voltage_v_corrected: "Tension",
  current_a_corrected: "Courant",
  power_factor_corrected: "Fact. puiss.",
  temperature_celsius_corrected: "Temp.",
  humidity_percent_corrected: "Humidité",
};

function siteTypeHtml(site) {
  const type = DATA.site_types[site];
  return type ? `<span class="type">${type}</span>` : "";
}

function renderPeriodicity() {
  const P = DATA.periodicity;
  const tableSites = DATA.bounds_sites || DATA.sites;

  // synthèse : rapport (et autocorrélation) par décalage, type de jour et site
  const head = `<tr><th class="c-lag">Décalage</th><th class="c-subset">Jours comparés</th>` +
    tableSites.map(s => `<th>${s}${siteTypeHtml(s)}</th>`).join("") + `</tr>`;
  let rows = "";
  P.lags.forEach((lag, li) => {
    P.subsets.forEach((subset, si) => {
      const sep = si === 0 && li > 0 ? "lag-sep" : "";
      const first = si === 0 ? `<td class="lag-cell" rowspan="${P.subsets.length}">${lag.label}</td>` : "";
      const cells = tableSites.map(s => {
        const st = P.stats[s][String(lag.hours)][subset.key];
        if (!st || st.ratio === null) return `<td class="value">—</td>`;
        const tip = `écart type de la différence : ${st.std_kw.toFixed(2)} kW, ${st.n.toLocaleString("fr-FR")} couples`;
        const rho = st.rho === null ? "—" : st.rho.toFixed(2);
        return `<td class="value" title="${tip}"><b>${st.ratio.toFixed(2)}</b><span class="rho">ρ ${rho}</span></td>`;
      }).join("");
      rows += `<tr class="${sep}">${first}<td class="subset-cell">${subset.label}</td>${cells}</tr>`;
    });
  });
  document.getElementById("periodicity-card").innerHTML =
    `<table class="bounds periodicity"><thead>${head}</thead><tbody>${rows}</tbody></table>`;

  // évolution sur l'année : écart type mensuel de la différence, même modèle que les graphes de métriques
  document.getElementById("periodicity-headers").innerHTML = `<div></div>` +
    DATA.sites.map(s => `<div class="site-label"><span class="dot" style="background:${SITE_COLOR[s]}"></span>${s} ${siteTypeHtml(s)}</div>`).join("");

  // une échelle par site, commune aux trois décalages : sinon un écart de 5 kW et un de 30 kW se ressemblent
  const domainBySite = {};
  DATA.sites.forEach(site => {
    const maxValue = Math.max(...P.lags.flatMap(lag => P.monthly[site][String(lag.hours)].std_kw));
    domainBySite[site] = [0, maxValue];
  });

  const rowsEl = document.getElementById("periodicity-rows");
  P.lags.forEach(lag => {
    const row = document.createElement("div");
    row.className = "metric-row";
    row.innerHTML = `<div class="metric-name"><b>${lag.label}</b>écart type mensuel de la différence (kW)</div>`;
    DATA.sites.forEach(site => {
      const card = document.createElement("div");
      card.className = "chart-card";
      const m = P.monthly[site][String(lag.hours)];
      if (m.months.length === 0) {
        card.innerHTML = '<p style="font-size:12px; color: var(--text-muted); margin: 30px 8px;">Pas assez de données</p>';
      } else {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "chart");
        card.appendChild(svg);
        buildLineChart(svg, m.months.map((d, i) => ({ x: d, y: m.std_kw[i] })), SITE_COLOR[site], fmtMonth, domainBySite[site]);
      }
      row.appendChild(card);
    });
    rowsEl.appendChild(row);
  });
}

function renderCorrelation() {
  const grid = document.getElementById("corr-grid");
  const tooltip = document.getElementById("tooltip");
  const fullLabel = Object.fromEntries(DATA.metrics);

  DATA.sites.forEach(site => {
    const c = DATA.correlation[site];
    const short = c.keys.map(k => SHORT_LABEL[k] || fullLabel[k]);
    let cells = `<div></div>` + short.map(l => `<div class="corr-head">${l}</div>`).join("");
    c.keys.forEach((rowKey, i) => {
      cells += `<div class="corr-head row-head">${short[i]}</div>`;
      c.keys.forEach((colKey, j) => {
        const r = c.matrix[i][j];
        const tip = `${fullLabel[rowKey]} × ${fullLabel[colKey]}`;
        if (i === j) {
          cells += `<div class="corr-cell diag" data-tip="${fullLabel[rowKey]}">1</div>`;
        } else if (r === null) {
          cells += `<div class="corr-cell empty" data-tip="${tip} : non calculable">n/a</div>`;
        } else {
          // teinte = signe, intensité = |r| ; le chiffre reste toujours affiché
          const pole = r >= 0 ? "var(--div-pos)" : "var(--div-neg)";
          const pct = Math.min(100, Math.abs(r) * 100).toFixed(0);
          const ink = Math.abs(r) >= 0.7 ? "#ffffff" : "var(--text-primary)";
          cells += `<div class="corr-cell" style="background: color-mix(in srgb, ${pole} ${pct}%, var(--div-mid)); color: ${ink}" data-tip="${tip} : ${r.toFixed(2)}">${r.toFixed(2)}</div>`;
        }
      });
    });

    const block = document.createElement("div");
    block.className = "site-block";
    block.innerHTML = `
      <h3><span class="dot" style="background:${SITE_COLOR[site]}"></span>${site} ${siteTypeHtml(site)}</h3>
      <div class="corr-grid">${cells}</div>
    `;
    block.querySelectorAll(".corr-cell").forEach(cell => {
      cell.addEventListener("mouseenter", () => {
        const rect = cell.getBoundingClientRect();
        tooltip.textContent = cell.dataset.tip;
        tooltip.style.left = (rect.left + rect.width / 2) + "px";
        tooltip.style.top = (rect.top - 4) + "px";
        tooltip.style.opacity = 1;
      });
      cell.addEventListener("mouseleave", () => { tooltip.style.opacity = 0; });
    });
    grid.appendChild(block);
  });
}

function render() {
  document.getElementById("meta-line").textContent =
    `${DATA.sites.join(" vs ")} — ${DATA.date_range.SITE001[0]} au ${DATA.date_range.SITE001[1]} ` +
    `(${DATA.row_counts.SITE001.toLocaleString("fr-FR")} mesures SITE001, ${DATA.row_counts.SITE003.toLocaleString("fr-FR")} mesures SITE003)`;

  renderMetricRows("all");
  renderPeriodicity();
  renderCorrelation();

  const qualityGrid = document.getElementById("quality-grid");
  DATA.sites.forEach(site => {
    const total = QUALITY_ORDER.reduce((s, k) => s + (DATA.quality[site][k] || 0), 0);
    const block = document.createElement("div");
    block.className = "site-block";
    const dotColor = SITE_COLOR[site];
    let bar = "";
    let legend = "";
    QUALITY_ORDER.forEach(k => {
      const count = DATA.quality[site][k] || 0;
      const pct = total ? (count / total * 100) : 0;
      const st = QUALITY_STATUS[k];
      bar += `<div class="quality-seg" style="width:${pct}%; background:${st.color}"></div>`;
      legend += `<div class="item"><span class="swatch" style="background:${st.color}"></span>${st.label} : ${count.toLocaleString("fr-FR")} (${pct.toFixed(1)}%)</div>`;
    });
    block.innerHTML = `
      <h3><span class="dot" style="background:${dotColor}"></span>${site}</h3>
      <div class="quality-bar">${bar}</div>
      <div class="quality-legend">${legend}</div>
    `;
    qualityGrid.appendChild(block);
  });

  const boundsSites = DATA.bounds_sites || DATA.sites;
  const boundsCard = document.getElementById("bounds-card");
  const head = `<tr><th>Metrique</th><th></th>${boundsSites.map(s => `<th>${s}</th>`).join("")}</tr>`;
  let rows = "";
  DATA.metrics.forEach(([key, label], idx) => {
    const sepClass = idx > 0 ? " metric-sep" : "";
    const minCells = boundsSites.map(s => `<td>${DATA.bounds[s][key].min ?? "—"}</td>`).join("");
    const maxCells = boundsSites.map(s => `<td>${DATA.bounds[s][key].max ?? "—"}</td>`).join("");
    rows += `<tr class="${sepClass.trim()}"><td rowspan="2">${label}</td><td class="stat-label">Min</td>${minCells}</tr>`;
    rows += `<tr><td class="stat-label">Max</td>${maxCells}</tr>`;
  });
  boundsCard.innerHTML = `
    <table class="bounds bounds-wide">
      <thead>${head}</thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

render();

const periodSelect = document.getElementById("period-select");
periodSelect.addEventListener("change", () => renderMetricRows(periodSelect.value));

// ?periode=1y|1m|1w|1d|all pour ouvrir directement sur une periode donnee (capture headless notamment)
const urlPeriod = new URLSearchParams(location.search).get("periode");
if (urlPeriod && ["all", "1y", "1m", "1w", "1d"].includes(urlPeriod)) {
  periodSelect.value = urlPeriod;
  renderMetricRows(urlPeriod);
}

const toggle = document.getElementById("theme-toggle");
toggle.addEventListener("click", () => {
  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  root.setAttribute("data-theme", isDark ? "light" : "dark");
  toggle.textContent = isDark ? "Mode sombre" : "Mode clair";
});
</script>
</body>
</html>
"""

HTML = HTML.replace("__DATA_JSON__", DATA_JSON)

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(HTML)

print("written:", OUT_PATH, len(HTML), "chars")
