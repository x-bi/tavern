/* global URL, console */
import { readFile } from 'node:fs/promises';

const [main, listView, chatView] = await Promise.all([
  readFile(new URL('../apps/web/src/main.ts', import.meta.url), 'utf8'),
  readFile(
    new URL('../apps/web/src/views/companions/CompanionListView.vue', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../apps/web/src/views/companions/CompanionChatView.vue', import.meta.url),
    'utf8'
  )
]);

assertIncludes(main, "app.component('NDrawer', NDrawer)", 'drawer component registration');
assertIncludes(listView, '@click.stop="openSettings(item.id)"', 'list settings entry');
assertIncludes(listView, "query: { panel: 'memory' }", 'settings route query');
assertIncludes(chatView, "ref(route.query.panel === 'memory')", 'automatic drawer opening');
assertIncludes(chatView, 'v-model:show="showMemory"', 'memory drawer binding');
assertIncludes(chatView, '正在加载记忆与设置', 'drawer loading state');
assertIncludes(chatView, '记忆与设置加载失败', 'drawer error state');
assertIncludes(chatView, '开启长期记忆', 'memory switch');
assertIncludes(chatView, '保存角色设置', 'companion settings action');
assertIncludes(chatView, '立即更新', 'memory refresh action');
assertIncludes(chatView, '清空记忆', 'memory clear action');
assertIncludes(chatView, '恢复 v{{ revision.version }}', 'memory revision restore action');

console.log('Companion memory and settings UI checks passed.');

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`Missing ${label}: ${expected}`);
}
