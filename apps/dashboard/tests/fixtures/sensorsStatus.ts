import { ref } from 'vue'

// État des capteurs commun aux tests des composables : SITE001 critique,
// SITE002 dégradé, SITE003 sain. L'inverse de l'ancien mock figé, pour qu'un
// test ne passe pas par hasard sur des valeurs codées en dur.
const FAMILIES = ['consumption', 'electrical', 'temperature', 'humidity', 'network']

function site(site_id: string, site_name: string, overall: string) {
  return {
    site_id,
    site_name,
    overall,
    sensors: FAMILIES.map(family => ({ family, status: 'ok', failing_until: null })),
  }
}

export const sensorsStatusModule = {
  useSensorsStatus: () => ({
    sensors: ref([
      site('SITE001', 'Bureau Paris La Défense', 'critical'),
      site('SITE002', 'Usine Lyon Vénissieux', 'degraded'),
      site('SITE003', 'Data Center Marseille', 'ok'),
    ]),
    pending: ref(false),
    error: ref(null),
  }),
}
