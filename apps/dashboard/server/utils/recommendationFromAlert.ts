// Mappe un déclenchement d'alerte (conso ou pic) vers une recommandation affichable (#177).
import type {
  Recommendation,
  RecommendationPriority,
  RecommendationSource,
  RecommendationType
} from '../../shared/recommendationSchema'

export type AlertKind = 'conso' | 'pic'

export interface AlertTrigger {
  timestamp: string
  valueKw: number
  thresholdKw: number
}

const TITRE: Record<AlertKind, string> = {
  conso: 'Consommation moyenne élevée',
  pic: 'Pic de consommation détecté'
}

const DESCRIPTION: Record<AlertKind, string> = {
  conso: 'La moyenne glissante de consommation dépasse le seuil réglé pour ce site. '
    + 'Vérifier les équipements à forte charge continue et envisager de décaler certains postes.',
  pic: 'Une mesure dépasse anormalement la moyenne récente de ce site. '
    + 'Vérifier un démarrage simultané d\'équipements ou une anomalie ponctuelle.'
}

const TYPE: Record<AlertKind, RecommendationType> = {
  conso: 'efficiency',
  pic: 'load_balancing'
}

const PRIORITÉ: Record<AlertKind, RecommendationPriority> = {
  conso: 'medium',
  pic: 'high'
}

export function buildRecommendation(
  siteId: string,
  alertKind: AlertKind,
  source: RecommendationSource,
  trigger: AlertTrigger
): Recommendation {
  return {
    recommendation_id: `REC-${siteId}-${alertKind}-${trigger.timestamp}`,
    site_id: siteId,
    source,
    type: TYPE[alertKind],
    priority: PRIORITÉ[alertKind],
    title: TITRE[alertKind],
    description: DESCRIPTION[alertKind],
    trigger: {
      timestamp: trigger.timestamp,
      value_kw: trigger.valueKw,
      threshold_kw: trigger.thresholdKw
    },
    estimated_saving_kwh: 0,
    gain_kw: 0,
    confidence: 0,
    window: 'N/A'
  }
}
