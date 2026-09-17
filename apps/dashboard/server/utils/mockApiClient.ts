import { $fetch } from 'ofetch'

const BASE_URL = process.env.NUXT_MOCK_API_URL ?? 'http://localhost:3001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchMockApi<T>(chemin: string, opts?: any): Promise<T> {
  return $fetch<T>(`${BASE_URL}${chemin}`, opts)
}
