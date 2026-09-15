// Contrat Mock API EnerVision v1.1.0
// Les blocs marqués À DÉFINIR ne sont pas encore spécifiés côté API.

export type SiteId = 'SITE001' | 'SITE002' | 'SITE003' | 'SITE004' | 'SITE005' | 'SITE006' | 'SITE007';
export type SiteType = 'office' | 'factory' | 'datacenter' | (string & {});
export type SiteStatus = 'active' | 'inactive' | 'maintenance';

/** Qualité de la MESURE — ne pas confondre avec la santé matérielle. */
export type DataQuality = 'good' | 'partial' | 'degraded' | 'critical';
/** Santé MATÉRIELLE des capteurs. */
export type SensorHealth = 'ok' | 'degraded' | 'critical';
export type SensorFamily = 'consumption' | 'electrical' | 'temperature' | 'humidity' | 'network';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'spike' | 'threshold' | 'anomaly' | 'outage' | 'sensor';

export interface Site {
  site_id: SiteId;
  site_name: string;
  site_type: SiteType;
  location: string;
  capacity_kw: number;          // 200–1000
  status: SiteStatus;
  threshold_kw?: number | null; // paramètre local — absent de l'API Mock
}

export interface CurrentReading {
  site_id: SiteId;
  site_type: SiteType;
  timestamp: string;                     // ISO 8601
  consumption_kw: number | null;
  consumption_kwh: number | null;
  voltage_v: number | null;
  current_a: number | null;
  power_factor: number | null;
  temperature_celsius: number | null;
  humidity_percent: number | null;
  data_quality: DataQuality;
  /** Liste des raisons de valeurs null — à afficher, jamais à traiter comme 0. */
  null_reasons: string[];
}

export interface Reading {
  timestamp: string;
  site_id: SiteId;
  site_type: SiteType;
  consumption_kw: number | null;
  consumption_kwh: number | null;
  voltage_v: number | null;
  current_a: number | null;
  power_factor: number | null;
  temperature_celsius: number | null;
  humidity_percent: number | null;
  null_reasons: string[];
  data_quality: DataQuality;
}

/** Réponse brute de l'API : objet indexé par site_id. */
export type SensorsStatusResponse = Record<SiteId, SensorStatusRaw>;

export interface SensorStatusRaw {
  site_name: string;
  sensors: Record<SensorFamily, { status: SensorHealth | 'failing'; failing_until: string | null }>;
  overall: SensorHealth;
}

/** Forme normalisée utilisée côté composants. */
export interface SensorStatus {
  site_id: SiteId;
  site_name: string;
  overall: SensorHealth;
  sensors: Array<{
    family: SensorFamily;
    status: SensorHealth | 'failing';
    failing_until: string | null;
  }>;
}

export interface Alert {
  alert_id: string;
  site_id: SiteId;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  timestamp: string;
  value?: number | null;
  threshold?: number | null;
  acknowledged?: boolean;
}

/** Réponse brute de GET /stats/summary. */
export interface StatsSummaryRaw {
  timestamp: string;
  total_sites: number;
  total_consumption_kw: number | null;
  total_capacity_kw: number;
  average_load_percent: number | null;
  sites: Array<{
    site_id: SiteId;
    site_name: string;
    site_type?: SiteType;
    current_consumption_kw: number | null;
    capacity_kw: number;
    load_percent: number | null;
    data_quality: DataQuality;
  }>;
}

/** Forme normalisée utilisée côté composants. */
export interface StatsSummary {
  timestamp: string;
  total_consumption_kw: number | null;
  total_capacity_kw: number;
  avg_load_pct: number | null;
  sites_counted: number;
  sites_total: number;
  excluded_sites: SiteId[];
  sites: StatsSummaryRaw['sites'];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
}

// ---- À DÉFINIR (bloquants d'intégration) -------------------------------

/** Auth : endpoint, forme du token, scopes. Absent de la mock. */
export interface AuthSessionTODO {
  token: string;
  user: { id: string; name: string; role: 'admin' | 'operator' | 'viewer' };
  expires_at: string;
}

/** Prédiction ML : horizon, pas, confiance, format des recommandations. Absent. */
export interface PredictionTODO {
  site_id: SiteId;
  horizon_hours: number;
  points: Array<{ timestamp: string; predicted_kw: number; ci_low?: number; ci_high?: number }>;
  confidence: number;
  recommendations: Array<{ id: string; label: string; gain_kw: number; window: string; confidence: number }>;
}
