import { useQuery } from '@tanstack/react-query'
import { platformService } from '@/services/platformService'
import { queryKeys } from '@/lib/queryKeys'

export function usePlatformOverview(enabled = true) {
  return useQuery({
    queryKey: queryKeys.platform.overview,
    queryFn: () => platformService.overview(),
    enabled,
  })
}
