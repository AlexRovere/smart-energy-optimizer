import type { SiteId } from "~/types/api";
import type { EnergyReading } from "~~/shared/energyReadingSchema";
import { watchFetchError } from "../utils/fetchError";

export function useSiteCurrentReading(id: Ref<SiteId>) {
  const { data, pending, error } = useFetch<EnergyReading>(() => `/api/sites/${id.value}/current`, {
    watch: [id]
  })
  const route = useRoute()
  watchFetchError(error, {
    url: () => `/api/sites/${id.value}/current`,
    route: () => route.path,
  })
  return { data, pending, error }
}