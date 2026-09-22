import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent
DATA_PATH = OUTPUT_DIR / "kpi_data.json"
OUT_PATH = OUTPUT_DIR / "tableau_kpi.html"

with open(DATA_PATH, encoding="utf-8") as f:
    data = json.load(f)

data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

html = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tableau de bord KPI énergie</title>
<style>
  :root {
    color-scheme: light;
    --page: #f4f3ef;
    --surface: #fffefa;
    --ink: #17201c;
    --muted: #68716c;
    --line: #dddcd5;
    --accent: #165c46;
    --accent-soft: #e4f0ea;
    --positive: #13734f;
    --negative: #b54a35;
    --warning: #936700;
    --warning-bg: #fff5d8;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font-family: Inter, system-ui, sans-serif; }
  main { width: min(1380px, 100%); margin: auto; padding: 32px clamp(16px, 3vw, 46px) 64px; }
  header { display: flex; align-items: end; justify-content: space-between; gap: 26px; margin-bottom: 23px; }
  .eyebrow { color: var(--accent); font: 700 11px/1.2 system-ui; letter-spacing: .14em; text-transform: uppercase; }
  h1 { margin: 7px 0 7px; font: 650 clamp(28px, 4vw, 48px)/1.04 Georgia, serif; }
  .lead, .note { color: var(--muted); line-height: 1.55; margin: 0; }
  .filters { display: flex; flex-wrap: wrap; gap: 10px; padding: 13px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
  .filter label { display: block; color: var(--muted); font-size: 10px; margin: 0 0 4px 2px; text-transform: uppercase; letter-spacing: .05em; }
  select { min-width: 150px; padding: 8px 30px 8px 9px; border: 1px solid var(--line); border-radius: 5px; background: white; color: var(--ink); }
  .period-line { display: flex; justify-content: space-between; gap: 20px; color: var(--muted); font-size: 12px; margin: 0 0 16px; }
  .warning { display: none; padding: 11px 14px; margin-bottom: 16px; border: 1px solid #e4bf51; border-radius: 6px; background: var(--warning-bg); color: #644900; font-size: 12px; }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .card { position: relative; min-height: 166px; padding: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
  .card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); }
  .card-label { display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 12px; }
  .card-value { margin: 21px 0 8px; font: 650 clamp(25px, 3vw, 38px)/1 Georgia, serif; font-variant-numeric: tabular-nums; }
  .comparison { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
  .delta { padding: 3px 6px; border-radius: 10px; font-weight: 650; }
  .delta.up { color: var(--positive); background: #e4f2eb; }
  .delta.down { color: var(--negative); background: #f7e8e4; }
  .delta.flat { color: var(--muted); background: #efefeb; }
  .card-help { position: absolute; left: 18px; right: 15px; bottom: 14px; color: var(--muted); font-size: 10px; line-height: 1.35; }
  .quality-strip { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; margin-top: 14px; padding: 14px 17px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
  .meter { height: 8px; border-radius: 8px; background: #e6e8e5; overflow: hidden; margin-top: 7px; }
  .meter span { display: block; height: 100%; background: var(--accent); }
  .quality-value { font: 650 20px/1 Georgia, serif; }
  .panel, .conclusion { margin-top: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; }
  .panel { padding: 19px; }
  h2 { margin: 0 0 7px; font-size: 16px; }
  .definitions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 14px; background: var(--line); border: 1px solid var(--line); }
  .definition { padding: 13px; background: var(--surface); }
  .definition strong { display: block; margin-bottom: 4px; font-size: 12px; }
  .definition span { color: var(--muted); font-size: 11px; line-height: 1.45; }
  .conclusion { padding: 21px 23px; border-left: 5px solid var(--accent); }
  .conclusion p { margin: 8px 0 0; line-height: 1.65; }
  footer { margin-top: 16px; color: var(--muted); font-size: 11px; line-height: 1.5; }
  @media (max-width: 940px) {
    header { display: block; }
    .filters { margin-top: 18px; }
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .definitions { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 570px) {
    .cards, .definitions { grid-template-columns: 1fr; }
    .filter, select { width: 100%; }
    .period-line { display: block; }
    .period-line span { display: block; margin-bottom: 4px; }
  }
  @media print {
    body { background: white; }
    main { width: 100%; padding: 10mm; }
    .filters { display: none; }
    .card, .panel, .conclusion { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="eyebrow">EnerVision · Pilotage</div>
      <h1>Tableau de bord KPI énergie</h1>
      <p class="lead">Six indicateurs comparés à la période précédente de même durée.</p>
    </div>
    <div class="filters">
      <div class="filter"><label for="entity-select">Périmètre</label><select id="entity-select"></select></div>
      <div class="filter"><label for="period-select">Période</label><select id="period-select"></select></div>
      <div class="filter"><label for="peak-select">Seuil de pic</label><select id="peak-select"></select></div>
    </div>
  </header>

  <div class="period-line"><span id="current-period"></span><span id="previous-period"></span></div>
  <div id="warning" class="warning"></div>
  <section id="cards" class="cards"></section>

  <section class="quality-strip">
    <div>
      <strong>Couverture des données</strong>
      <div class="meter"><span id="coverage-meter"></span></div>
      <p class="note" id="coverage-detail"></p>
    </div>
    <div class="quality-value" id="coverage-value">—</div>
  </section>

  <section class="panel">
    <h2>Comment lire ces KPI</h2>
    <p class="note">Les données corrigées servent aux KPI énergétiques. La qualité et la couverture restent affichées pour juger leur fiabilité.</p>
    <div class="definitions">
      <div class="definition"><strong>Énergie totale</strong><span>Somme des consommations horaires en kWh sur la période.</span></div>
      <div class="definition"><strong>Moyenne journalière</strong><span>Énergie totale divisée par le nombre de jours de la période.</span></div>
      <div class="definition"><strong>Puissance P95</strong><span>95 % des puissances horaires sont inférieures à cette valeur.</span></div>
      <div class="definition"><strong>Heures en pic</strong><span>Part des heures dépassant la moyenne propre à chaque site du seuil choisi.</span></div>
      <div class="definition"><strong>Données fiables</strong><span>Mesures marquées « good » rapportées au nombre d'heures attendues.</span></div>
      <div class="definition"><strong>Facteur de charge</strong><span>Puissance moyenne divisée par la puissance maximale ; mesure la régularité.</span></div>
    </div>
  </section>

  <section class="conclusion">
    <h2>Conclusion des KPI</h2>
    <p id="conclusion-text"></p>
  </section>
  <footer id="method"></footer>
</main>
<script>
const DATA = __DATA_JSON__;
const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const integerFmt = new Intl.NumberFormat("fr-FR");

function formatDate(date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function metricCard(label, metric, unit, help, changeKind = "percent") {
  const value = metric.value === null ? "—" : `${fmt.format(metric.value)}${unit}`;
  const previous = metric.previous === null ? "—" : `${fmt.format(metric.previous)}${unit}`;
  const change = changeKind === "points" ? metric.change_points : metric.change_percent;
  const changeText = change === null ? "non calculable" : `${change > 0 ? "+" : ""}${fmt.format(change)}${changeKind === "points" ? " pts" : " %"}`;
  const direction = change === null || Math.abs(change) < 0.01 ? "flat" : change > 0 ? "up" : "down";
  return `<article class="card"><div class="card-label"><strong>${label}</strong><span>actuel</span></div><div class="card-value">${value}</div><div class="comparison"><span class="delta ${direction}">${changeText}</span><span>vs ${previous}</span></div><div class="card-help">${help}</div></article>`;
}

function peakCard(peak, percent) {
  const rate = peak.rate_percent === null ? "—" : `${fmt.format(peak.rate_percent)} %`;
  const previous = peak.previous_rate_percent === null ? "—" : `${fmt.format(peak.previous_rate_percent)} %`;
  const change = peak.change_points;
  const direction = change === null || Math.abs(change) < 0.01 ? "flat" : change > 0 ? "up" : "down";
  const changeText = change === null ? "non calculable" : `${change > 0 ? "+" : ""}${fmt.format(change)} pts`;
  return `<article class="card"><div class="card-label"><strong>Heures en pic</strong><span>seuil +${percent} %</span></div><div class="card-value">${rate}</div><div class="comparison"><span class="delta ${direction}">${changeText}</span><span>vs ${previous}</span></div><div class="card-help">${integerFmt.format(peak.count)} heures dépassent le seuil propre à leur site.</div></article>`;
}

function buildEntityOptions() {
  const groups = { global: [], type: [], site: [] };
  DATA.entities.forEach(entity => groups[entity.kind].push(entity));
  const labels = { global: "Global", type: "Types de sites", site: "Sites" };
  return Object.entries(groups).map(([kind, entities]) => `<optgroup label="${labels[kind]}">${entities.map(entity => `<option value="${entity.key}">${entity.label}</option>`).join("")}</optgroup>`).join("");
}

function render() {
  const entity = document.getElementById("entity-select").value;
  const days = Number(document.getElementById("period-select").value);
  const threshold = document.getElementById("peak-select").value;
  const metrics = DATA.results[entity][String(days)];
  const peak = metrics.peaks[threshold];
  document.getElementById("cards").innerHTML = [
    metricCard("Énergie totale", metrics.total_energy_kwh, " kWh", "Volume consommé sur toute la période."),
    metricCard("Moyenne journalière", metrics.average_daily_kwh, " kWh/j", "Permet de comparer des périodes de durées différentes."),
    metricCard("Puissance P95", metrics.p95_kw, " kW", "Niveau de forte charge, plus robuste que le maximum."),
    peakCard(peak, threshold),
    metricCard("Données fiables", metrics.reliable_rate_percent, " %", "Mesures de qualité « good » parmi les heures attendues.", "points"),
    metricCard("Facteur de charge", metrics.load_factor_percent, " %", "Plus il est élevé, plus la puissance est régulière.", "points"),
  ].join("");

  const coverage = metrics.coverage_rate_percent.value;
  document.getElementById("coverage-value").textContent = coverage === null ? "—" : `${fmt.format(coverage)} %`;
  document.getElementById("coverage-meter").style.width = `${Math.min(100, coverage || 0)}%`;
  document.getElementById("coverage-detail").textContent = `${integerFmt.format(metrics.available_hours)} mesures exploitables pour ${integerFmt.format(metrics.expected_hours)} heures attendues.`;

  const end = new Date(DATA.anchor_end_utc);
  const start = new Date(end.getTime() - days * 86400000);
  const previousStart = new Date(start.getTime() - days * 86400000);
  document.getElementById("current-period").textContent = `Période actuelle : ${formatDate(start)} au ${formatDate(new Date(end.getTime() - 86400000))}`;
  document.getElementById("previous-period").textContent = `Comparaison : ${formatDate(previousStart)} au ${formatDate(new Date(start.getTime() - 86400000))}`;

  const warning = document.getElementById("warning");
  if (coverage !== null && coverage < 95) {
    warning.style.display = "block";
    warning.textContent = `Couverture limitée à ${fmt.format(coverage)} % : les KPI énergétiques doivent être interprétés avec prudence.`;
  } else {
    warning.style.display = "none";
  }

  const energyChange = metrics.total_energy_kwh.change_percent;
  const p95Change = metrics.p95_kw.change_percent;
  const quality = metrics.reliable_rate_percent.value;
  const energyText = energyChange === null ? "L'évolution de l'énergie n'est pas calculable" : `L'énergie totale ${energyChange >= 0 ? "augmente" : "diminue"} de ${fmt.format(Math.abs(energyChange))} %`;
  const p95Text = p95Change === null ? "l'évolution du P95 n'est pas calculable" : `la puissance P95 ${p95Change >= 0 ? "augmente" : "diminue"} de ${fmt.format(Math.abs(p95Change))} %`;
  document.getElementById("conclusion-text").textContent = `${energyText} par rapport à la période précédente et ${p95Text}. ${fmt.format(peak.rate_percent || 0)} % des heures exploitables dépassent le seuil de pic de +${threshold} %. Le taux de données fiables est de ${quality === null ? "niveau non calculable" : `${fmt.format(quality)} %`} pour une couverture de ${coverage === null ? "niveau non calculable" : `${fmt.format(coverage)} %`}.`;
}

const entitySelect = document.getElementById("entity-select");
const periodSelect = document.getElementById("period-select");
const peakSelect = document.getElementById("peak-select");
entitySelect.innerHTML = buildEntityOptions();
periodSelect.innerHTML = DATA.periods_days.map(days => `<option value="${days}">${days} jours</option>`).join("");
peakSelect.innerHTML = DATA.peak_thresholds_percent.map(percent => `<option value="${percent}">+${percent} %</option>`).join("");
[entitySelect, periodSelect, peakSelect].forEach(select => select.addEventListener("change", render));
document.getElementById("method").textContent = `${DATA.method} La période la plus récente est volontairement exclue si elle n'est pas complète.`;
render();
</script>
</body>
</html>
"""

html = html.replace("__DATA_JSON__", data_json)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(html)

print("written:", OUT_PATH, len(html), "chars")
