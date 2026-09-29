// Libellés affichés pour les valeurs brutes de l'API Mock. Une valeur inconnue
// s'affiche telle quelle : mieux vaut un mot anglais qu'une case vide.
import type { DataQuality } from '../types/api'

const SITE_TYPES: Record<string, string> = {
  office: 'Bureaux',
  factory: 'Usine',
  datacenter: 'Centre de données',
  hospital: 'Hôpital',
  retail: 'Commerce',
}

const SITE_STATUSES: Record<string, string> = {
  active: 'En service',
  inactive: 'Hors service',
  maintenance: 'En maintenance',
}

const QUALITIES: Record<DataQuality, { label: string; hint: string }> = {
  good: { label: 'Complète', hint: 'Toutes les mesures sont présentes.' },
  partial: { label: 'Partielle', hint: 'Un capteur en défaut : une partie des mesures manque.' },
  degraded: { label: 'Dégradée', hint: 'Plusieurs capteurs en défaut.' },
  critical: { label: 'Critique', hint: 'Perte réseau : aucune mesure reçue.' },
}

const SENSOR_FAMILIES: Record<string, string> = {
  consumption: 'Consommation',
  electrical: 'Électrique',
  temperature: 'Température',
  humidity: 'Humidité',
  network: 'Réseau',
}

const SENSOR_STATES: Record<string, string> = {
  ok: 'En service',
  failing: 'En panne',
  degraded: 'Dégradé',
  critical: 'Critique',
}

const HEALTHS: Record<string, string> = {
  ok: 'Sain',
  degraded: 'Dégradé',
  critical: 'Critique',
  failing: 'En panne',
}

export function sensorFamilyLabel(family: string): string {
  return SENSOR_FAMILIES[family] ?? family
}

export function sensorStateLabel(state: string): string {
  return SENSOR_STATES[state] ?? state
}

export function healthLabel(health: string): string {
  return HEALTHS[health] ?? health
}

export function siteTypeLabel(type: string | undefined): string {
  if (!type) return '—'
  return SITE_TYPES[type] ?? type
}

export function siteStatusLabel(status: string): string {
  return SITE_STATUSES[status] ?? status
}

export function qualityLabel(quality: DataQuality): string {
  return QUALITIES[quality]?.label ?? quality
}

export function qualityHint(quality: DataQuality): string {
  return QUALITIES[quality]?.hint ?? ''
}
