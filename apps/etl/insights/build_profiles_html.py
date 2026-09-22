import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent
DATA_PATH = OUTPUT_DIR / "profiles_data.json"
OUT_PATH = OUTPUT_DIR / "profils_consommation.html"

with open(DATA_PATH, encoding="utf-8") as f:
    data = json.load(f)

data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

html = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Profils de consommation par type de site</title>
<style>
  :root {
    color-scheme: light;
    --page: #f4f1ea;
    --surface: #fffdf8;
    --ink: #17201c;
    --muted: #68736d;
    --line: #d9d8cf;
    --low: #e9f2ee;
    --high: #0c7c59;
    --accent: #e15b36;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font-family: Inter, system-ui, sans-serif; }
  main { width: min(1440px, 100%); margin: auto; padding: 30px clamp(16px, 3vw, 46px) 60px; }
  header { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; margin-bottom: 26px; }
  .eyebrow { color: var(--accent); font: 700 11px/1.2 system-ui; letter-spacing: .14em; text-transform: uppercase; }
  h1 { margin: 7px 0 8px; max-width: 760px; font: 650 clamp(26px, 4vw, 46px)/1.04 Georgia, serif; }
  .lead, .note { color: var(--muted); line-height: 1.55; margin: 0; max-width: 820px; }
  label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
  select { min-width: 190px; padding: 10px 34px 10px 12px; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); color: var(--ink); font: inherit; }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 22px; }
  .stat, .panel, .conclusion { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
  .stat { padding: 16px 18px; }
  .stat span { display: block; color: var(--muted); font-size: 12px; }
  .stat strong { display: block; margin-top: 5px; font: 650 24px/1.1 Georgia, serif; }
  .layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr); gap: 18px; }
  .stack { display: grid; gap: 18px; align-content: start; }
  .panel { padding: 18px; min-width: 0; overflow: hidden; }
  h2 { margin: 0 0 5px; font-size: 16px; }
  .panel .note { font-size: 12px; margin-bottom: 15px; }
  .heatmap-scroll { overflow-x: auto; padding-bottom: 5px; }
  .heatmap { display: grid; gap: 2px; min-width: 760px; }
  .heatmap.week { grid-template-columns: 76px repeat(24, minmax(22px, 1fr)); }
  .heatmap.month { grid-template-columns: 42px repeat(24, minmax(22px, 1fr)); }
  .axis { min-height: 24px; display: grid; place-items: center; color: var(--muted); font-size: 9px; }
  .row-label { justify-items: end; padding-right: 7px; font-size: 10px; }
  .cell { min-height: 25px; border-radius: 2px; background: var(--low); }
  .legend { display: flex; justify-content: flex-end; align-items: center; gap: 8px; color: var(--muted); font-size: 10px; margin-top: 10px; }
  .ramp { width: 130px; height: 8px; border-radius: 8px; background: linear-gradient(90deg, var(--low), var(--high)); }
  .bars { display: grid; gap: 10px; }
  .bar-row { display: grid; grid-template-columns: 58px 1fr 92px; align-items: center; gap: 9px; font-size: 11px; }
  .bar-track { height: 14px; background: var(--low); border-radius: 2px; overflow: hidden; }
  .bar { height: 100%; background: var(--high); min-width: 2px; }
  .bar-value { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
  .peak-panel { margin-top: 18px; }
  .peak-head { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
  .peak-filter label { display: block; margin-bottom: 5px; }
  .table-scroll { overflow-x: auto; margin-top: 14px; }
  table { width: 100%; min-width: 900px; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 9px 8px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
  th { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  th:first-child, td:first-child { text-align: left; font-weight: 650; }
  .conclusion { margin-top: 18px; padding: 20px 22px; border-left: 5px solid var(--accent); }
  .conclusion p { margin: 8px 0 0; line-height: 1.65; }
  footer { margin-top: 18px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  @media (max-width: 900px) {
    header, .layout { grid-template-columns: 1fr; }
    header .filter { justify-self: start; }
  }
  @media (max-width: 560px) {
    main { padding-top: 20px; }
    .stats { grid-template-columns: 1fr; }
  }
  @media print {
    body { background: white; }
    main { width: 100%; padding: 10mm; }
    .filter { display: none; }
    .layout { grid-template-columns: 1fr; }
    .panel, .stat, .conclusion { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="eyebrow">EnerVision · Analyse descriptive</div>
      <h1>Profils de consommation par type de site</h1>
      <p class="lead">Consommation horaire moyenne, rythmes calendaires et associations avec les conditions ambiantes.</p>
    </div>
    <div class="filter">
      <label for="type-select">Type de site</label>
      <select id="type-select"></select>
    </div>
  </header>

  <section class="stats">
    <div class="stat"><span>Sites représentés</span><strong id="site-count">—</strong></div>
    <div class="stat"><span>Mesures exploitables</span><strong id="sample-count">—</strong></div>
    <div class="stat"><span>Consommation moyenne</span><strong id="mean-value">—</strong></div>
  </section>

  <div class="layout">
    <div class="stack">
      <section class="panel">
        <h2>Rythme hebdomadaire</h2>
        <p class="note">Moyenne en kWh selon le jour de la semaine et l'heure UTC.</p>
        <div class="heatmap-scroll"><div id="weekday-heatmap" class="heatmap week"></div></div>
        <div class="legend"><span>Faible</span><span class="ramp"></span><span>Élevée</span></div>
      </section>
      <section class="panel">
        <h2>Consommation moyenne par mois</h2>
        <p class="note">Moyenne en kWh pour chaque mois de l'année, équilibrée entre les sites du type.</p>
        <div id="monthly-bars" class="bars"></div>
      </section>
    </div>

    <div class="stack">
      <section class="panel">
        <h2>Selon la température</h2>
        <p class="note">Température corrigée regroupée par tranches de 5 °C.</p>
        <div id="temperature-bars" class="bars"></div>
      </section>
      <section class="panel">
        <h2>Selon l'humidité</h2>
        <p class="note">Humidité corrigée regroupée par tranches de 10 %.</p>
        <div id="humidity-bars" class="bars"></div>
      </section>
    </div>
  </div>

  <section class="panel peak-panel">
    <div class="peak-head">
      <div>
        <h2>Pics horaires par site</h2>
        <p class="note">Une mesure est un pic lorsqu'elle dépasse la moyenne propre au site du pourcentage sélectionné.</p>
      </div>
      <div class="peak-filter">
        <label for="peak-threshold">Dépassement de la moyenne</label>
        <select id="peak-threshold"></select>
      </div>
    </div>
    <div class="table-scroll"><table id="peak-table"></table></div>
  </section>

  <section class="conclusion">
    <h2>Conclusion tirée des insights</h2>
    <p id="conclusion-text"></p>
  </section>

  <footer id="method"></footer>
</main>
<script>
const DATA = __DATA_JSON__;
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const integerFmt = new Intl.NumberFormat("fr-FR");
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function color(value, min, max) {
  const ratio = max === min ? 0.5 : (value - min) / (max - min);
  const low = [233, 242, 238], high = [12, 124, 89];
  const rgb = low.map((channel, i) => Math.round(channel + (high[i] - channel) * ratio));
  return `rgb(${rgb.join(",")})`;
}

function renderHeatmap(targetId, rows, rowKey, rowValues, rowLabel) {
  const target = document.getElementById(targetId);
  const lookup = new Map(rows.map(row => [`${row[rowKey]}:${row.hour}`, row]));
  const values = rows.map(row => row.mean_kwh).filter(value => value !== null);
  const min = Math.min(...values), max = Math.max(...values);
  let html = '<div></div>' + Array.from({ length: 24 }, (_, hour) => `<div class="axis">${hour}</div>`).join("");
  rowValues.forEach(rowValue => {
    html += `<div class="axis row-label">${rowLabel(rowValue)}</div>`;
    for (let hour = 0; hour < 24; hour++) {
      const cell = lookup.get(`${rowValue}:${hour}`);
      if (!cell) {
        html += '<div class="cell" title="Aucune donnée"></div>';
        continue;
      }
      const title = `${rowLabel(rowValue)}, ${hour} h : ${fmt.format(cell.mean_kwh)} kWh · ${integerFmt.format(cell.samples)} mesures · ${cell.sites} site(s)`;
      html += `<div class="cell" style="background:${color(cell.mean_kwh, min, max)}" title="${title}"></div>`;
    }
  });
  target.innerHTML = html;
}

function renderBars(targetId, rows, suffix) {
  const target = document.getElementById(targetId);
  if (!rows.length) {
    target.innerHTML = '<p class="note">Aucune donnée disponible.</p>';
    return;
  }
  const max = Math.max(...rows.map(row => row.mean_kwh));
  target.innerHTML = rows.map(row => {
    const width = max ? (row.mean_kwh / max * 100) : 0;
    return `<div class="bar-row" title="${integerFmt.format(row.samples)} mesures · ${row.sites} site(s)">
      <span>${row.label}${suffix}</span>
      <span class="bar-track"><span class="bar" style="display:block;width:${width}%"></span></span>
      <span class="bar-value">${fmt.format(row.mean_kwh)} kWh</span>
    </div>`;
  }).join("");
}

function renderPeaks(siteType, percent) {
  const sites = DATA.peaks[siteType] || [];
  const header = `<thead><tr><th>Site</th><th>Moyenne</th><th>Seuil +${percent} %</th><th>Mesures en pic</th><th>Taux</th><th>Maximum</th><th>Dépassement moyen</th><th>Moment le plus fréquent</th></tr></thead>`;
  const rows = sites.map(site => {
    const peak = site.thresholds[String(percent)];
    const moment = peak.count ? `${DATA.weekday_labels[peak.peak_day_of_week]} · ${String(peak.peak_hour).padStart(2, "0")} h` : "—";
    return `<tr><td>${site.site_id}</td><td>${fmt.format(site.mean_kwh)} kWh</td><td>${fmt.format(peak.threshold_kwh)} kWh</td><td>${integerFmt.format(peak.count)} / ${integerFmt.format(site.samples)}</td><td>${fmt.format(peak.rate_percent)} %</td><td>${peak.maximum_kwh === null ? "—" : `${fmt.format(peak.maximum_kwh)} kWh`}</td><td>${peak.average_excess_kwh === null ? "—" : `${fmt.format(peak.average_excess_kwh)} kWh`}</td><td>${moment}</td></tr>`;
  }).join("");
  document.getElementById("peak-table").innerHTML = header + `<tbody>${rows}</tbody>`;
  return sites.reduce((total, site) => total + site.thresholds[String(percent)].count, 0);
}

function render(siteType) {
  const summary = DATA.summaries[siteType];
  document.getElementById("site-count").textContent = integerFmt.format(summary.sites);
  document.getElementById("sample-count").textContent = integerFmt.format(summary.samples);
  document.getElementById("mean-value").textContent = `${fmt.format(summary.mean_kwh)} kWh`;

  renderHeatmap("weekday-heatmap", DATA.weekday_hour[siteType] || [], "day_of_week", [0, 1, 2, 3, 4, 5, 6], value => DATA.weekday_labels[value]);
  renderBars("monthly-bars", (DATA.monthly[siteType] || []).map(row => ({ ...row, label: MONTH_LABELS[row.month - 1] })), "");
  renderBars("temperature-bars", DATA.temperature[siteType] || [], " °C");
  renderBars("humidity-bars", DATA.humidity[siteType] || [], " %");
  const threshold = Number(document.getElementById("peak-threshold").value);
  const peakCount = renderPeaks(siteType, threshold);
  const peakText = peakCount
    ? ` Avec un seuil fixé à ${threshold} % au-dessus de la moyenne propre à chaque site, ${integerFmt.format(peakCount)} mesures horaires sont identifiées comme des pics.`
    : ` Avec un seuil fixé à ${threshold} % au-dessus de la moyenne propre à chaque site, aucun pic horaire n'est identifié.`;
  document.getElementById("conclusion-text").textContent = summary.conclusion + peakText;
}

const select = document.getElementById("type-select");
const peakSelect = document.getElementById("peak-threshold");
select.innerHTML = DATA.types.map(type => `<option value="${type}">${type}</option>`).join("");
peakSelect.innerHTML = DATA.peak_thresholds_percent.map(percent => `<option value="${percent}">+${percent} %</option>`).join("");
select.addEventListener("change", () => render(select.value));
peakSelect.addEventListener("change", () => render(select.value));
document.getElementById("method").textContent = `${DATA.method} Les associations température, humidité et consommation sont descriptives et ne prouvent pas une causalité.`;
if (DATA.types.length) render(DATA.types[0]);
</script>
</body>
</html>
"""

html = html.replace("__DATA_JSON__", data_json)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", OUT_PATH, len(html), "chars")
