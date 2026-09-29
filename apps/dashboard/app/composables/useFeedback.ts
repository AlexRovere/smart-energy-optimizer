import { useFetch } from 'nuxt/app'
import type { Ref } from 'vue'
import type { FeedbackVoteResponse } from '~~/shared/feedbackSchema'
import type { SiteId } from '../types/api'

type Target = FeedbackVoteResponse['target_type']

// Votes « utile / pas utile » du compte sur un site (#47). Un vote s'affiche
// dès le clic ; la réponse du serveur ne fait que le confirmer.
export function useFeedback(siteId: Ref<SiteId>) {
  const { data } = useFetch<FeedbackVoteResponse[]>(
    () => `/api/sites/${siteId.value}/feedback`,
    { watch: [siteId], default: () => [] }
  )

  function voteFor(targetType: Target, targetId: string): boolean | null {
    return data.value?.find(v => v.target_type === targetType && v.target_id === targetId)?.useful ?? null
  }

  async function vote(targetType: Target, targetId: string, useful: boolean): Promise<void> {
    const others = (data.value ?? []).filter(v => !(v.target_type === targetType && v.target_id === targetId))
    data.value = [...others, { target_type: targetType, target_id: targetId, useful }]
    await $fetch(`/api/sites/${siteId.value}/feedback`, {
      method: 'PUT',
      body: { target_type: targetType, target_id: targetId, useful },
    })
  }

  return { voteFor, vote }
}
