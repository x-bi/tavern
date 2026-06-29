import { computed } from 'vue';
import { useRoute } from 'vue-router';

export function usePageTitle() {
  const route = useRoute();

  return computed(() => String(route.meta.title ?? 'Tavern Lite'));
}
