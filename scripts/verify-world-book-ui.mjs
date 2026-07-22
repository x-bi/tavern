import { readFile } from 'node:fs/promises';

const [main, view, editor] = await Promise.all([
  readFile(new URL('../apps/web/src/main.ts', import.meta.url), 'utf8'),
  readFile(new URL('../apps/web/src/views/world-books/WorldBookView.vue', import.meta.url), 'utf8'),
  readFile(new URL('../apps/web/src/components/WorldBookEditor.vue', import.meta.url), 'utf8')
]);

for (const component of ['NSelect', 'NModal', 'NTab', 'NTabs']) {
  if (!main.includes(`app.component('${component}', ${component})`)) {
    throw new Error(`${component} is used by the world-book page but is not globally registered.`);
  }
}

assertIncludes(view, 'v-model:value="createForm.characterIds"', 'create character binding');
assertIncludes(view, ':options="targetCharacterOptions"', 'owned character options');
assertIncludes(editor, 'v-model:value="bookForm.characterIds"', 'edit character binding');
assertIncludes(editor, ':options="characterOptions"', 'edit character options');

for (const target of ['persona', 'conversation', 'companion']) {
  assertIncludes(view, `v-model:value="createForm.${target}Ids"`, `create ${target} binding`);
  assertIncludes(editor, `v-model:value="bookForm.${target}Ids"`, `edit ${target} binding`);
}
assertIncludes(editor, 'editingEntry?.compactStale', 'compact stale editor warning');
assertIncludes(editor, 'entry.compactStale', 'compact stale list warning');

console.log('World book multi-target binding and compact stale UI checks passed.');

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`Missing ${label}: ${expected}`);
}
