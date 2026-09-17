import type { SiteId } from "~/types/api";
import type { EnergyReading } from "~~/shared/energyReadingSchema";

export function useSiteCurrentReading(id: Ref<SiteId>) {
  return useFetch<EnergyReading>(() => `/api/sites/${id.value}/current`, {
    watch: [id]
  })
}