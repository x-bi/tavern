/// <reference types="vite/client" />

/**
 * Vite 环境与 .vue 模块的类型声明补充。
 *
 * - `vite/client` 提供 import.meta.env 等运行时类型；
 * - `*.vue` 模块声明让 TS 能识别 .vue 文件的默认导出为 Vue 组件。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
