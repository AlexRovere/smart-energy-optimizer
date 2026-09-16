<script setup lang="ts">
import type { SiteId } from '~/types/api'

const route = useRoute()
const router = useRouter()

const id = computed(() => route.params.id as SiteId)

const { getSite, getSiteSensors, getSiteAlerts, getSiteHealth, getSiteInfo, getCurrentReading, getReadings } = useSites()

const site = computed(() => getSite(id.value))
const info = computed(() => getSiteInfo(id.value))
const reading = computed(() => getCurrentReading(id.value))
const sensors = computed(() => getSiteSensors(id.value))
const alerts = computed(() => getSiteAlerts(id.value))
const health = computed(() => getSiteHealth(id.value))
const readings = computed(() => getReadings(id.value))

// ── Formatters ──────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtConso(kw: number | null): string {
  if (kw == null) return '—'
  return kw.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function chargeColor(pct: number | null): string {
  if (pct == null) return 'rgba(255,255,255,0.15)'
  if (pct >= 80) return 'var(--ev-red)'
  if (pct >= 50) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function powerFactorColor(pf: number | null): string {
  if (pf == null) return 'rgba(255,255,255,0.15)'
  if (pf < 0.85) return 'var(--ev-red)'
  if (pf < 0.92) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function tempColor(c: number | null): string {
  if (c == null) return 'rgba(255,255,255,0.15)'
  if (c > 35 || c < 15) return 'var(--ev-red)'
  if (c > 30 || c < 18) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function voltageColor(v: number | null): string {
  if (v == null) return 'rgba(255,255,255,0.15)'
  const dev = Math.abs(v - 400) / 400
  if (dev > 0.10) return 'var(--ev-red)'
  if (dev > 0.05) return 'var(--ev-amber)'
  return 'var(--ev-green)'
}

function sensorStatusColor(status: string): string {
  if (status === 'ok') return 'var(--ev-green)'
  if (status === 'degraded') return 'var(--ev-amber)'
  return 'var(--ev-red)'
}

// ── Last seen ───────────────────────────────────────────────────────

const lastSeen = computed(() => {
  const ts = reading.value?.timestamp
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

// ── Chart ───────────────────────────────────────────────────────────

const W = 800
const H = 280
const PAD_T = 20
const PAD_R = 10
const PAD_B = 40
const PAD_L = 48
const chartW = W - PAD_L - PAD_R
const chartH = H - PAD_T - PAD_B

const chartData = computed(() => {
  const pts = readings.value.filter(r => r.consumption_kw != null)
  if (!pts.length) return null

  const cap = site.value?.capacity_kw ?? 0
  const thr = info.value?.threshold_kw ?? null
  const maxVal = Math.max(...pts.map(p => p.consumption_kw!), cap) * 1.1
  const yTicks = [0, 100, 200, 300, 400].filter(v => v <= maxVal + 50)

  function sx(i: number) { return PAD_L + (i / (pts.length - 1)) * chartW }
  function sy(v: number) { return PAD_T + (1 - v / maxVal) * chartH }

  const points = pts.map((p, i) => ({ x: sx(i), y: sy(p.consumption_kw!), val: p.consumption_kw!, ts: p.timestamp }))
  const areaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    + ` L ${points[points.length - 1]!.x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)}`
    + ` L ${points[0]!.x.toFixed(1)} ${(PAD_T + chartH).toFixed(1)} Z`
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  const xLabels = pts
    .map((p, i) => ({ i, time: new Date(p.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }))
    .filter((_, i) => i % 4 === 0)

  const peakPt = pts.reduce((a, b) => (b.consumption_kw! > a.consumption_kw! ? b : a))
  const peakTime = new Date(peakPt.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return { points, areaPath, linePath, maxVal, yTicks, sy, sx, cap, thr, xLabels, peakVal: peakPt.consumption_kw, peakTime }
})

const chartWindow = ref<'24h' | '7j'>('24h')
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-7 flex flex-col gap-6">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1.5 font-ev text-sm text-ev-text-3">
      <button class="hover:text-ev-text transition-colors cursor-pointer" @click="router.push('/')">Parc</button>
      <span>/</span>
      <button class="hover:text-ev-text transition-colors cursor-pointer" @click="router.push('/sites')">Sites</button>
      <span>/</span>
      <span class="text-ev-text font-medium">{{ site?.site_id ?? id }}</span>
    </nav>

    <!-- Site introuvable -->
    <div
      v-if="!site"
      class="flex items-center gap-2.5 px-4 py-3 rounded-ev-md border text-sm font-ev"
      style="border-color: var(--ev-red-bd); background: var(--ev-red-bg); color: var(--ev-red)"
    >
      Site {{ id }} introuvable.
    </div>

    <template v-if="site">

      <!-- Header -->
      <header class="flex items-start justify-between gap-6">
        <div class="flex flex-col gap-2">
          <!-- Titre + badges -->
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="font-ev text-[28px] font-bold tracking-tight">{{ site.site_name }}</h2>
            <EvHealthBadge :status="health" />
            <EvQualityBadge :quality="site.data_quality" />
          </div>
          <!-- Métadonnées -->
          <div class="flex items-center gap-4 flex-wrap font-ev-mono text-[12px] text-ev-text-3">
            <span>
              <span class="text-ev-text-4">site_type</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ site.site_type ?? '—' }}</span>
            </span>
            <span v-if="info?.location">
              <span class="text-ev-text-4">location</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ info.location }}</span>
            </span>
            <span>
              <span class="text-ev-text-4">capacity_kw</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span class="text-ev-text font-semibold">{{ site.capacity_kw }}</span>
            </span>
            <span v-if="info?.threshold_kw">
              <span class="text-ev-text-4">seuil</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span style="color: var(--ev-amber)" class="font-semibold">{{ info.threshold_kw }}</span>
            </span>
            <span v-if="info?.status">
              <span class="text-ev-text-4">status</span>
              <span class="mx-1 text-ev-text-4">·</span>
              <span style="color: var(--ev-green)" class="font-semibold">{{ info.status }}</span>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 shrink-0 mt-1">
          <EvButton variant="secondary">Configurer les seuils</EvButton>
          <EvButton variant="primary" @click="router.push('/predictions')">Voir la prédiction</EvButton>
        </div>
      </header>

      <!-- 4 KPI gauges -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-(--ev-gap-card)">
        <EvGauge
          label="CONSOMMATION"
          :value="fmtConso(site.current_consumption_kw)"
          unit="kW"
          :note="site.load_percent != null ? fmtNum(site.load_percent) + ' % de la capacité' : 'Données indisponibles'"
          :ratio="site.load_percent != null ? site.load_percent / 100 : null"
          :color="chargeColor(site.load_percent)"
        />
        <EvGauge
          label="TENSION"
          :value="fmtNum(reading?.voltage_v ?? null)"
          unit="V"
          note="nominal 400 V ± 10 %"
          :ratio="reading?.voltage_v != null ? Math.min(reading.voltage_v / 440, 1) : null"
          :color="voltageColor(reading?.voltage_v ?? null)"
        />
        <EvGauge
          label="FACTEUR DE PUISSANCE"
          :value="fmtNum(reading?.power_factor ?? null, 3)"
          unit=""
          :note="(reading?.power_factor ?? 0) < 0.92 ? 'sous le plancher contractuel' : 'dans la norme'"
          :ratio="reading?.power_factor ?? null"
          :color="powerFactorColor(reading?.power_factor ?? null)"
        />
        <EvGauge
          label="TEMPÉRATURE"
          :value="fmtNum(reading?.temperature_celsius ?? null)"
          unit="°C"
          note="plage de service 15–35 °C"
          :ratio="reading?.temperature_celsius != null ? reading.temperature_celsius / 50 : null"
          :color="tempColor(reading?.temperature_celsius ?? null)"
        />
      </div>

      <!-- Historique de consommation -->
      <EvCard>
        <template #title>
          <div class="flex items-center justify-between w-full">
            <div>
              <span class="font-ev text-base font-semibold">Historique de consommation — 24 dernières heures</span>
              <div v-if="chartData" class="font-ev-mono text-[11px] text-ev-text-3 mt-0.5">
                GET /readings?site_id={{ id }}&amp;limit=24
                <template v-if="chartData.peakVal != null">
                  · pic mesuré {{ fmtNum(chartData.peakVal) }} kW à {{ chartData.peakTime }}
                </template>
              </div>
            </div>
            <div class="flex gap-1.5 shrink-0">
              <button
                v-for="w in (['24h', '7j'] as const)"
                :key="w"
                class="font-ev-mono text-xs font-semibold px-3 py-1.5 rounded-ev-btn border transition-colors cursor-pointer"
                :style="chartWindow === w
                  ? 'background: var(--ev-surface-2); border-color: var(--ev-border-hover); color: var(--ev-text)'
                  : 'border-color: var(--ev-border); color: var(--ev-text-3)'"
                @click="chartWindow = w"
              >{{ w }}</button>
            </div>
          </div>
        </template>

        <!-- SVG Chart -->
        <div v-if="chartData" class="mt-2">
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="w-full"
            style="height: 280px"
            preserveAspectRatio="none"
          >
            <!-- Y gridlines + labels -->
            <g v-for="tick in chartData.yTicks" :key="tick">
              <line
                :x1="PAD_L" :y1="chartData.sy(tick).toFixed(1)"
                :x2="W - PAD_R" :y2="chartData.sy(tick).toFixed(1)"
                stroke="rgba(255,255,255,0.06)" stroke-width="1"
              />
              <text
                :x="PAD_L - 6" :y="chartData.sy(tick) + 4"
                text-anchor="end"
                font-size="11"
                fill="rgba(255,255,255,0.3)"
                font-family="monospace"
              >{{ tick }}</text>
            </g>

            <!-- Capacity line -->
            <line
              :x1="PAD_L" :y1="chartData.sy(chartData.cap).toFixed(1)"
              :x2="W - PAD_R" :y2="chartData.sy(chartData.cap).toFixed(1)"
              stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="6 4"
            />

            <!-- Threshold line -->
            <line
              v-if="chartData.thr"
              :x1="PAD_L" :y1="chartData.sy(chartData.thr).toFixed(1)"
              :x2="W - PAD_R" :y2="chartData.sy(chartData.thr).toFixed(1)"
              stroke="var(--ev-amber)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"
            />

            <!-- Area fill -->
            <path
              :d="chartData.areaPath"
              fill="rgba(16,185,129,0.12)"
            />

            <!-- Consumption line -->
            <path
              :d="chartData.linePath"
              fill="none"
              stroke="var(--ev-green)"
              stroke-width="2"
              stroke-linejoin="round"
            />

            <!-- X labels -->
            <text
              v-for="lbl in chartData.xLabels"
              :key="lbl.i"
              :x="chartData.sx(lbl.i).toFixed(1)"
              :y="PAD_T + chartH + 16"
              text-anchor="middle"
              font-size="11"
              fill="rgba(255,255,255,0.3)"
              font-family="monospace"
            >{{ lbl.time }}</text>
          </svg>

          <!-- Légende -->
          <div class="flex items-center gap-6 mt-3 font-ev-mono text-[11px] text-ev-text-3">
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-5 h-0.5" style="background: var(--ev-green)" />
              consumption_kw
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-5 h-0.5 border-t border-dashed border-white/40" />
              capacity {{ chartData.cap }}
            </span>
            <span v-if="chartData.thr" class="flex items-center gap-1.5">
              <span class="inline-block w-5 h-0.5 border-t border-dashed" style="border-color: var(--ev-amber)" />
              threshold {{ chartData.thr }}
            </span>
          </div>
        </div>
        <div v-else class="py-10 text-center font-ev text-sm text-ev-text-3">
          Aucune donnée historique disponible
        </div>
      </EvCard>

      <!-- Bas de page : 2 colonnes -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-(--ev-gap-card)">

        <!-- Santé des capteurs -->
        <EvCard>
          <template #title>
            <span class="font-ev text-base font-semibold">Santé des capteurs</span>
            <span class="font-ev-mono text-[11px] text-ev-text-3 ml-2">sensors/status</span>
          </template>

          <div class="flex flex-col divide-y" style="--tw-divide-opacity: 1; border-color: var(--ev-border)">
            <div
              v-for="sensor in sensors"
              :key="sensor.family"
              class="flex items-center justify-between py-3.5"
              style="border-color: var(--ev-border)"
            >
              <span class="font-ev-mono text-sm text-ev-text">{{ sensor.family }}</span>
              <span class="font-ev-mono text-xs text-ev-text-3">last_seen {{ lastSeen }}</span>
              <span
                class="font-ev-mono text-xs font-semibold px-2.5 py-1 rounded-ev-pill flex items-center gap-1.5"
                :style="{ background: `${sensorStatusColor(sensor.status)}22`, color: sensorStatusColor(sensor.status) }"
              >
                <span class="size-1.5 rounded-full" :style="{ background: sensorStatusColor(sensor.status) }" />
                {{ sensor.status }}
              </span>
            </div>
          </div>
        </EvCard>

        <!-- Métriques secondaires -->
        <EvCard>
          <template #title>
            <span class="font-ev text-base font-semibold">Métriques secondaires</span>
          </template>

          <div class="flex flex-col gap-0">
            <!-- Courant -->
            <div
              v-if="reading?.current_a != null"
              class="flex items-center justify-between py-3.5 border-b"
              style="border-color: var(--ev-border)"
            >
              <div>
                <div class="font-ev-mono text-sm text-ev-text">current_a</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">courant triphasé calculé</div>
              </div>
              <div class="text-right">
                <span class="font-ev-mono text-xl font-bold text-ev-text">{{ fmtNum(reading.current_a) }}</span>
                <span class="font-ev-mono text-xs text-ev-text-3 ml-1">A</span>
              </div>
            </div>

            <!-- Humidité -->
            <div
              v-if="reading?.humidity_percent != null"
              class="flex items-center justify-between py-3.5 border-b"
              style="border-color: var(--ev-border)"
            >
              <div>
                <div class="font-ev-mono text-sm text-ev-text">humidity_pct</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">hygrométrie ambiante</div>
              </div>
              <div class="text-right">
                <span class="font-ev-mono text-xl font-bold text-ev-text">{{ fmtNum(reading.humidity_percent) }}</span>
                <span class="font-ev-mono text-xs text-ev-text-3 ml-1">%</span>
              </div>
            </div>

            <!-- Alertes actives -->
            <div class="flex items-center justify-between py-3.5">
              <div>
                <div class="font-ev-mono text-sm text-ev-text">alerts_active</div>
                <div class="font-ev text-[11px] text-ev-text-3 mt-0.5">alertes en cours sur ce site</div>
              </div>
              <div class="text-right">
                <span
                  class="font-ev-mono text-xl font-bold"
                  :style="{ color: alerts.length > 0 ? 'var(--ev-amber)' : 'var(--ev-green)' }"
                >{{ alerts.length }}</span>
              </div>
            </div>
          </div>
        </EvCard>

      </div>

      <!-- Alertes actives du site -->
      <EvCard v-if="alerts.length">
        <template #title>
          <span class="font-ev text-base font-semibold">Alertes actives ({{ alerts.length }})</span>
        </template>
        <div class="flex flex-col gap-3">
          <EvAlertCard v-for="a in alerts" :key="a.alert_id" :alert="a" />
        </div>
      </EvCard>

    </template>
  </div>
</template>
