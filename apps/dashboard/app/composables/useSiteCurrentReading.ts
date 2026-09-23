import type { SiteId } from "~/types/api";
import type { EnergyReading } from "~~/shared/energyReadingSchema";
import { observerErreurFetch } from "../utils/erreurFetch";

export function useSiteCurrentReading(id: Ref<SiteId>) {
  const { data, pending, error } = useFetch<EnergyReading>(() => `/api/sites/${id.value}/current`, {
    watch: [id]
  })
  const route = useRoute()
  observerErreurFetch(error, {
    url: () => `/api/sites/${id.value}/current`,
    route: () => route.path,
  })
  return { data, pending, error }
}