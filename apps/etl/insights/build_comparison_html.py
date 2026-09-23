import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent
DATA_PATH = OUTPUT_DIR / "profiles_data.json"
OUT_PATH = OUTPUT_DIR / "comparaison_types_sites.html"

with open(DATA_PATH, encoding="utf-8") as f:
    data = json.load(f)

data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

html = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparaison des types de sites</title>
<style>
  :root {
    color-scheme: light;
    --page: #f2f4f1;
    --surface: #ffffff;
    --ink: #15201b;
    --muted: #66736c;
    --line: #d9ded9;
    --grid: #e8ece8;
    --accent: #174f3e;
    --warn-bg: #fff7df;
    --warn-line: #e8bf45;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font-family: Inter, system-ui, sans-serif; }
  main { width: min(1440px, 100%); margin: auto; padding: 32px clamp(16px, 3vw, 46px) 64px; }
  header { margin-bottom: 24px; }
  .eyebrow { color: var(--accent); font: 700 11px/1.2 system-ui; letter-spacing: .14em; text-transform: uppercase; }
  h1 { margin: 7px 0 8px; font: 650 clamp(28px, 4vw, 48px)/1.04 Georgia, serif; }
  .lead, .note { color: var(--muted); line-height: 1.55; margin: 0; }
  .warning { display: none; margin: 18px 0; padding: 12px 15px; border: 1px solid var(--warn-line); border-radius: 7px; background: var(--warn-bg); font-size: 13px; line-height: 1.5; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .panel, .conclusion { background: var(--surface); border: 1px solid var(--line); border-radius: 9px; }
  .panel { padding: 19px; min-width: 0; overflow: hidden; }
  .panel.wide { grid-column: 1 / -1; }
  .panel-head { display: flex; align-items: start; justify-content: space-between; gap: 14px; margin-bottom: 15px; }
  h2 { margin: 0 0 5px; font-size: 16px; }
  .panel .note { font-size: 12px; max-width: 760px; }
  select { padding: 7px 30px 7px 9px; border: 1px solid var(--line); border-radius: 5px; background: white; color: var(--ink); }
  .mean-bars { display: grid; gap: 12px; }
  .mean-row { display: grid; grid-template-columns: 90px 1fr 92px; gap: 10px; align-items: center; font-size: 12px; }
  .track { height: 18px; background: var(--grid); border-radius: 3px; overflow: hidden; }
  .fill { display: block; height: 100%; min-width: 2px; border-radius: 3px; }
  .value { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
  .chart-wrap { overflow-x: auto; }
  svg { display: block; width: 100%; min-width: 720px; height: 310px; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 10px; font-size: 11px; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .swatch { width: 18px; height: 3px; border-radius: 2px; }
  .weekend { display: grid; gap: 12px; }
  .weekend-row { display: grid; grid-template-columns: 90px 1fr 70px; gap: 10px; align-items: center; font-size: 12px; }
  .diverging { position: relative; height: 18px; background: var(--grid); border-radius: 3px; overflow: hidden; }
  .diverging::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: #939d97; }
  .delta { position: absolute; top: 2px; bottom: 2px; }
  .corr-list { display: grid; gap: 13px; }
  .corr-row { display: grid; grid-template-columns: 90px 1fr 48px; gap: 10px; align-items: center; font-size: 12px; }
  .corr-track { position: relative; height: 6px; background: var(--grid); border-radius: 6px; }
  .corr-track::after { content: ""; position: absolute; left: 50%; top: -3px; width: 1px; height: 12px; background: #9aa49e; }
  .corr-dot { position: absolute; top: 50%; width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%); }
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 850px; font-size: 12px; }
  th, td { padding: 10px 9px; border-bottom: 1px solid var(--grid); text-align: right; font-variant-numeric: tabular-nums; }
  th { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  th:first-child, td:first-child { text-align: left; font-weight: 650; }
  .limited { color: #966d00; }
  .conclusion { margin-top: 18px; padding: 21px 24px; border-left: 5px solid var(--accent); }
  .conclusion p { margin: 8px 0 0; line-height: 1.68; }
  footer { margin-top: 18px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  @media (max-width: 880px) {
    .grid { grid-template-columns: 1fr; }
    .panel.wide { grid-column: auto; }
  }
  @media (max-width: 520px) {
    .mean-row, .weekend-row, .corr-row { grid-template-columns: 72px 1fr 68px; }
    .panel-head { display: block; }
    .panel-head select { margin-top: 10px; }
  }
  @media print {
    body { background: white; }
    main { width: 100%; padding: 10mm; }
    .panel, .conclusion { break-inside: avoid; }
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div class="eyebrow">EnerVision · Vue comparative</div>
    <h1>Comparer les types de sites</h1>
    <p class="lead">Niveaux de consommation, rythmes horaires et réactions aux conditions ambiantes sur une même vue.</p>
  </header>

  <aside id="warning" class="warning"></aside>

  <div class="grid">
    <section class="panel">
      <div class="panel-head">
        <div><h2>Consommation moyenne</h2><p class="note">Moyenne équilibrée entre les sites de chaque type.</p></div>
      </div>
      <div id="mean-bars" class="mean-bars"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><h2>Écart du week-end</h2><p class="note">Variation par rapport aux jours du lundi au vendredi.</p></div>
      </div>
      <div id="weekend-bars" class="weekend"></div>
    </section>

    <section class="panel wide">
      <div class="panel-head">
        <div>
          <h2>Profils horaires comparés</h2>
          <p class="note">La vue normalisée révèle les rythmes ; la vue absolue compare les volumes.</p>
        </div>
        <select id="chart-mode" aria-label="Mode du graphique">
          <option value="normalized">Indice base 100</option>
          <option value="absolute">Valeurs absolues</option>
        </select>
      </div>
      <div class="chart-wrap"><svg id="hourly-chart" viewBox="0 0 1000 310" preserveAspectRatio="none"></svg></div>
      <div id="chart-legend" class="legend"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><h2>Association avec la température</h2><p class="note">Corrélation de Pearson, de −1 à +1.</p></div>
      </div>
      <div id="temperature-corr" class="corr-list"></div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div><h2>Association avec l'humidité</h2><p class="note">Une valeur proche de zéro indique peu de lien linéaire.</p></div>
      </div>
      <div id="humidity-corr" class="corr-list"></div>
    </section>

    <section class="panel wide">
      <div class="panel-head">
        <div><h2>Consommation moyenne par mois et par site</h2><p class="note">Les sept sites sont affichés avec leur type sur chacun des douze mois.</p></div>
      </div>
      <div class="table-scroll"><table id="monthly-table"></table></div>
    </section>

    <section class="panel wide">
      <div class="panel-head">
        <div>
          <h2>Pics horaires de tous les sites</h2>
          <p class="note">Le seuil est calculé séparément à partir de la moyenne de chaque site.</p>
        </div>
        <select id="peak-threshold" aria-label="Dépassement définissant un pic"></select>
      </div>
      <div class="table-scroll"><table id="peak-table"></table></div>
    </section>

    <section class="panel wide">
      <div class="panel-head">
        <div><h2>Tableau de synthèse</h2><p class="note">Le créneau moyen maximal est distinct des pics horaires définis ci-dessus.</p></div>
      </div>
      <div class="table-scroll"><table id="summary-table"></table></div>
    </section>
  </div>

  <section class="conclusion">
    <h2>Conclusion comparative</h2>
    <p id="conclusion-text"></p>
  </section>
  <footer id="method"></footer>
</main>
<script>
const DATA = __DATA_JSON__;
const COLORS = ["#174f3e", "#d45d36", "#386cb0", "#8b5ca8", "#b58a14", "#607d70"];
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const integerFmt = new Intl.NumberFormat("fr-FR");
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const types = [...DATA.types].sort((a, b) => DATA.summaries[b].mean_kwh - DATA.summaries[a].mean_kwh);
const colorByType = Object.fromEntries(types.map((type, index) => [type, COLORS[index % COLORS.length]]));

function hourlyProfile(type) {
  const buckets = Array.from({ length: 24 }, () => []);
  (DATA.weekday_hour[type] || []).forEach(cell => buckets[cell.hour].push(cell.mean_kwh));
  return buckets.map(values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
}

function peak(type) {
  const cells = DATA.weekday_hour[type] || [];
  return cells.length ? cells.reduce((best, cell) => cell.mean_kwh > best.mean_kwh ? cell : best) : null;
}

function renderMeans() {
  const max = Math.max(...types.map(type => DATA.summaries[type].mean_kwh));
  document.getElementById("mean-bars").innerHTML = types.map(type => {
    const value = DATA.summaries[type].mean_kwh;
    return `<div class="mean-row"><strong>${type}</strong><span class="track"><span class="fill" style="width:${value / max * 100}%;background:${colorByType[type]}"></span></span><span class="value">${fmt.format(value)} kWh</span></div>`;
  }).join("");
}

function renderWeekend() {
  const maxAbs = Math.max(1, ...types.map(type => Math.abs(DATA.summaries[type].weekend_change_percent || 0)));
  document.getElementById("weekend-bars").innerHTML = types.map(type => {
    const value = DATA.summaries[type].weekend_change_percent;
    if (value === null) return `<div class="weekend-row"><strong>${type}</strong><span>Non calculable</span><span></span></div>`;
    const width = Math.abs(value) / maxAbs * 50;
    const left = value < 0 ? 50 - width : 50;
    const shade = value < 0 ? "#386cb0" : "#d45d36";
    const sign = value > 0 ? "+" : "";
    return `<div class="weekend-row"><strong>${type}</strong><span class="diverging"><span class="delta" style="left:${left}%;width:${width}%;background:${shade}"></span></span><span class="value">${sign}${fmt.format(value)} %</span></div>`;
  }).join("");
}

function renderCorrelations(targetId, key) {
  document.getElementById(targetId).innerHTML = types.map(type => {
    const value = DATA.summaries[type][key];
    if (value === null) return `<div class="corr-row"><strong>${type}</strong><span>Non calculable</span><span>—</span></div>`;
    const position = (value + 1) / 2 * 100;
    return `<div class="corr-row"><strong>${type}</strong><span class="corr-track"><span class="corr-dot" style="left:${position}%;background:${colorByType[type]}"></span></span><span class="value">${value.toFixed(2)}</span></div>`;
  }).join("");
}

function renderHourly(mode) {
  const svg = document.getElementById("hourly-chart");
  const W = 1000, H = 310, left = 55, right = 18, top = 18, bottom = 38;
  const profiles = Object.fromEntries(types.map(type => {
    const values = hourlyProfile(type);
    const baseline = DATA.summaries[type].mean_kwh;
    return [type, mode === "normalized" ? values.map(value => value === null ? null : value / baseline * 100) : values];
  }));
  const allValues = Object.values(profiles).flat().filter(value => value !== null);
  let min = mode === "normalized" ? Math.min(80, ...allValues) : 0;
  let max = Math.max(...allValues);
  if (min === max) max += 1;
  const x = hour => left + hour / 23 * (W - left - right);
  const y = value => top + (max - value) / (max - min) * (H - top - bottom);
  let markup = "";
  for (let step = 0; step <= 4; step++) {
    const value = min + (max - min) * step / 4;
    const py = y(value);
    markup += `<line x1="${left}" x2="${W - right}" y1="${py}" y2="${py}" stroke="#e8ece8"/><text x="${left - 8}" y="${py + 4}" text-anchor="end" fill="#66736c" font-size="11">${fmt.format(value)}</text>`;
  }
  for (let hour = 0; hour < 24; hour += 3) {
    markup += `<text x="${x(hour)}" y="${H - 11}" text-anchor="middle" fill="#66736c" font-size="11">${hour} h</text>`;
  }
  types.forEach(type => {
    let path = "";
    profiles[type].forEach((value, hour) => {
      if (value === null) return;
      path += `${path ? "L" : "M"}${x(hour).toFixed(1)},${y(value).toFixed(1)} `;
    });
    markup += `<path d="${path}" fill="none" stroke="${colorByType[type]}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
  });
  const unit = mode === "normalized" ? "indice" : "kWh";
  markup += `<text x="${left}" y="11" fill="#66736c" font-size="10">${unit}</text>`;
  svg.innerHTML = markup;
  document.getElementById("chart-legend").innerHTML = types.map(type => `<span><i class="swatch" style="background:${colorByType[type]}"></i>${type}</span>`).join("");
}

function renderTable() {
  const header = `<thead><tr><th>Type</th><th>Sites</th><th>Moyenne</th><th>Créneau moyen max.</th><th>Week-end</th><th>Temp. r</th><th>Humidité r</th><th>Représentativité</th></tr></thead>`;
  const rows = types.map(type => {
    const summary = DATA.summaries[type], top = peak(type);
    const peakText = top ? `${DATA.weekday_labels[top.day_of_week]} ${String(top.hour).padStart(2, "0")} h · ${fmt.format(top.mean_kwh)} kWh` : "—";
    const weekend = summary.weekend_change_percent === null ? "—" : `${summary.weekend_change_percent > 0 ? "+" : ""}${fmt.format(summary.weekend_change_percent)} %`;
    const status = summary.sites === 1 ? '<span class="limited">Limitée · 1 site</span>' : `${summary.sites} sites`;
    return `<tr><td>${type}</td><td>${summary.sites}</td><td>${fmt.format(summary.mean_kwh)} kWh</td><td>${peakText}</td><td>${weekend}</td><td>${summary.temperature_correlation?.toFixed(2) ?? "—"}</td><td>${summary.humidity_correlation?.toFixed(2) ?? "—"}</td><td>${status}</td></tr>`;
  }).join("");
  document.getElementById("summary-table").innerHTML = header + `<tbody>${rows}</tbody>`;
}

function renderMonthlyTable() {
  const sites = [...new Map(DATA.site_monthly.map(row => [row.site_id, { id: row.site_id, type: row.site_type }])).values()];
  const lookups = Object.fromEntries(sites.map(site => [site.id, new Map(DATA.site_monthly.filter(row => row.site_id === site.id).map(row => [row.month, row]))]));
  const header = `<thead><tr><th>Mois</th>${sites.map(site => `<th>${site.id}<br><span class="limited">${site.type}</span></th>`).join("")}</tr></thead>`;
  const rows = MONTH_LABELS.map((label, index) => {
    const month = index + 1;
    const cells = sites.map(site => {
      const row = lookups[site.id].get(month);
      return `<td>${row ? `${fmt.format(row.mean_kwh)} kWh` : "—"}</td>`;
    }).join("");
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join("");
  document.getElementById("monthly-table").innerHTML = header + `<tbody>${rows}</tbody>`;
}

function renderPeakTable(percent) {
  const header = `<thead><tr><th>Type</th><th>Site</th><th>Moyenne</th><th>Seuil +${percent} %</th><th>Mesures en pic</th><th>Taux</th><th>Maximum</th><th>Dépassement moyen</th><th>Moment fréquent</th></tr></thead>`;
  const sites = types.flatMap(type => (DATA.peaks[type] || []).map(site => ({ type, ...site })));
  const rows = sites.map(site => {
    const peakData = site.thresholds[String(percent)];
    const moment = peakData.count ? `${DATA.weekday_labels[peakData.peak_day_of_week]} · ${String(peakData.peak_hour).padStart(2, "0")} h` : "—";
    return `<tr><td>${site.type}</td><td>${site.site_id}</td><td>${fmt.format(site.mean_kwh)} kWh</td><td>${fmt.format(peakData.threshold_kwh)} kWh</td><td>${integerFmt.format(peakData.count)} / ${integerFmt.format(site.samples)}</td><td>${fmt.format(peakData.rate_percent)} %</td><td>${peakData.maximum_kwh === null ? "—" : `${fmt.format(peakData.maximum_kwh)} kWh`}</td><td>${peakData.average_excess_kwh === null ? "—" : `${fmt.format(peakData.average_excess_kwh)} kWh`}</td><td>${moment}</td></tr>`;
  }).join("");
  document.getElementById("peak-table").innerHTML = header + `<tbody>${rows}</tbody>`;
  return sites.reduce((total, site) => total + site.thresholds[String(percent)].count, 0);
}

function renderConclusion(percent) {
  const highest = types[0], lowest = types[types.length - 1];
  const highValue = DATA.summaries[highest].mean_kwh, lowValue = DATA.summaries[lowest].mean_kwh;
  const weekendValues = types.filter(type => DATA.summaries[type].weekend_change_percent !== null);
  const weekendHigh = weekendValues.reduce((best, type) => DATA.summaries[type].weekend_change_percent > DATA.summaries[best].weekend_change_percent ? type : best);
  const weekendLow = weekendValues.reduce((best, type) => DATA.summaries[type].weekend_change_percent < DATA.summaries[best].weekend_change_percent ? type : best);
  const temperatureType = types.reduce((best, type) => Math.abs(DATA.summaries[type].temperature_correlation || 0) > Math.abs(DATA.summaries[best].temperature_correlation || 0) ? type : best);
  const temperatureR = DATA.summaries[temperatureType].temperature_correlation;
  const ratio = lowValue ? highValue / lowValue : null;
  const ratioText = ratio ? `, soit environ ${fmt.format(ratio)} fois le niveau du type « ${lowest} »` : "";
  const peakCount = renderPeakTable(percent);
  const peakText = peakCount
    ? ` Avec le seuil sélectionné de ${percent} % au-dessus de la moyenne propre à chaque site, ${integerFmt.format(peakCount)} mesures horaires sont identifiées comme des pics.`
    : ` Avec le seuil sélectionné de ${percent} % au-dessus de la moyenne propre à chaque site, aucun pic horaire n'est identifié.`;
  document.getElementById("conclusion-text").textContent = `Le type « ${highest} » présente la consommation moyenne la plus élevée (${fmt.format(highValue)} kWh)${ratioText}. Le type « ${weekendHigh} » connaît la plus forte hausse le week-end (${fmt.format(DATA.summaries[weekendHigh].weekend_change_percent)} %), tandis que « ${weekendLow} » enregistre la baisse la plus marquée (${fmt.format(Math.abs(DATA.summaries[weekendLow].weekend_change_percent))} %). L'association à la température la plus nette concerne « ${temperatureType} » (r=${temperatureR?.toFixed(2) ?? "non calculable"}).${peakText} Les niveaux absolus reflètent aussi la taille et l'activité des sites ; le graphique en base 100 doit être privilégié pour comparer uniquement la forme des profils horaires. Ces constats sont descriptifs et ne prouvent pas de causalité.`;
}

function renderWarning() {
  const limited = types.filter(type => DATA.summaries[type].sites === 1);
  if (!limited.length) return;
  const warning = document.getElementById("warning");
  warning.style.display = "block";
  warning.textContent = `Représentativité limitée : ${limited.map(type => `« ${type} »`).join(", ")} ${limited.length > 1 ? "reposent" : "repose"} sur un seul site. Les différences observées peuvent donc refléter un site particulier plutôt que tout le type.`;
}

renderMeans();
renderWeekend();
renderCorrelations("temperature-corr", "temperature_correlation");
renderCorrelations("humidity-corr", "humidity_correlation");
renderTable();
renderMonthlyTable();
renderWarning();
renderHourly("normalized");
const peakSelect = document.getElementById("peak-threshold");
peakSelect.innerHTML = DATA.peak_thresholds_percent.map(percent => `<option value="${percent}">Dépassement +${percent} %</option>`).join("");
renderConclusion(Number(peakSelect.value));
document.getElementById("chart-mode").addEventListener("change", event => renderHourly(event.target.value));
peakSelect.addEventListener("change", event => renderConclusion(Number(event.target.value)));
document.getElementById("method").textContent = `${DATA.method} Corrélation ne signifie pas causalité. Les types à un seul site doivent être interprétés avec prudence.`;
</script>
</body>
</html>
"""

html = html.replace("__DATA_JSON__", data_json)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", OUT_PATH, len(html), "chars")
