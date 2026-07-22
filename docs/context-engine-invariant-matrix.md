# Context Engine V2 不变量验收矩阵

本表把 `tavern-codex-full-implementation-instructions.md` 第 16 章的 38 条不变量绑定到唯一运行路径和回归测试。修改 Context Engine、聊天、世界书、Replay 或长期记忆时，必须同步更新对应测试，不能用“测试总数”代替不变量覆盖。

|   # | 不变量收口点                                                     | 回归证据                                                                  |
| --: | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
|   1 | Matcher 使用 assistant direct influence entry 集合阻止 self echo | `world-book-matcher-v2.spec.ts`                                           |
|   2 | 每条 Included Trace 单独保存 lineage，Runtime 不再合并 lineage   | `world-book-matcher-v2.spec.ts` independent lineage                       |
|   3 | `resolveAssistantLineage` 排除包含当前 entry 的 lineage          | `world-book-matcher-v2.spec.ts`                                           |
|   4 | bridgeDepth 在 Matcher 中受最大值约束                            | `world-book-matcher-v2.spec.ts`                                           |
|   5 | `advanceWorldBookActivationState` 仅 current_user 创建 sticky    | `world-book-matcher-v2.spec.ts`                                           |
|   6 | assistant bridge 只按配置创建有限 continuation                   | `world-book-matcher-v2.spec.ts`                                           |
|   7 | Activation Event 使用非空 sourceKey 唯一键                       | `generation-lifecycle.spec.ts`、`world-book-import-export-v2.spec.ts`     |
|   8 | user_history_window 直接返回旧状态，不刷新 sticky/cooldown       | `world-book-matcher-v2.spec.ts`                                           |
|   9 | Preview/建议只返回 Proposed State，不调用提交事务                | `world-book-runtime.spec.ts`、`prompt-preview-context-engine.spec.ts`     |
|  10 | failed/stopped 仅终结 Request/Message，不提交 Trace/State        | `generation-lifecycle.spec.ts`                                            |
|  11 | 每候选独立 Attempt，只有 complete 写成功 Trace                   | `generation-lifecycle.spec.ts`、`model-fallback-policy.spec.ts`           |
|  12 | Chat Trace 只保存 Compiler 实际 included 的世界书                | `chat.service.ts` / `companion-chat.service.ts` 的 `toGenerationTrace`    |
|  13 | regenerate 复用传入 Turn，不创建 sequence                        | `generation-lifecycle.spec.ts`                                            |
|  14 | bridge 只读取 Turn active assistant 的成功 Trace                 | `timeline-selection.spec.ts`、`replay-active-pointer.spec.ts`             |
|  15 | Request 唯一键为 target + requestId，hash 冲突/终态固定          | `generation-lifecycle.spec.ts`                                            |
|  16 | active assistant 只由成功提交事务切换                            | `generation-lifecycle.spec.ts`、`t0b-turns.spec.ts`                       |
|  17 | version + generation lease 条件提交，冲突不建 Trace              | `generation-lifecycle.spec.ts`、前端 provisional tests                    |
|  18 | Conversation/Companion Replay 由有效 active Trace 重建           | `replay-active-pointer.spec.ts`                                           |
|  19 | Section 只按显式 placement/budgetPriority/sortOrder/id 排序      | `provider-prompt-compiler.spec.ts`                                        |
|  20 | Preset 仅显式操作 optional rule，required policy 不进入合并器    | `preset-rule-compiler.spec.ts`、`prompt-section-builder.spec.ts`          |
|  21 | required 超预算抛错，不做字符串截断                              | `provider-prompt-compiler.spec.ts`                                        |
|  22 | compactSourceHash 不匹配时只使用 canonical full content          | `provider-prompt-compiler.spec.ts`、`world-book-import-export-v2.spec.ts` |
|  23 | Companion Prompt/Preview 只读取 activeRevision                   | `companion-preview-active-memory.spec.ts`                                 |
|  24 | Projection 有正文时必须引用有效 Claim                            | `memory-provenance.spec.ts`                                               |
|  25 | Memory evidence 排除由当前 active revision 影响的 assistant      | `timeline-selection.spec.ts`                                              |
|  26 | user_fact 必须包含 user 来源                                     | `memory-provenance.spec.ts`                                               |
|  27 | 未确认导入 behavior_rule 降级为 lore/untrusted                   | `world-book-import-export-v2.spec.ts`                                     |
|  28 | Matcher 输入仅来自 canonical user/assistant 时间线               | `timeline-selection.spec.ts`、`world-book-runtime.service.ts`             |
|  29 | current_user_override 可重新授权处于 cooldown 的条目             | `world-book-runtime.service.ts`                                           |
|  30 | Preview 与真实聊天共用 Section Builder + Provider Compiler       | `prompt-preview-context-engine.spec.ts`                                   |
|  31 | Conversation/Companion 使用独立外键表和共享领域服务              | `t0b-turns.spec.ts`                                                       |
|  32 | history Section 保存 conversationRole 并按真实角色编译           | `provider-prompt-compiler.spec.ts`                                        |
|  33 | 成功 Trace 同时保存 canonical snapshot JSON 与 SHA-256           | `canonical-json.spec.ts`、`generation-lifecycle.spec.ts`                  |
|  34 | Activation Event unique key 包含非空 sourceKey                   | Prisma Schema、`world-book-import-export-v2.spec.ts`                      |
|  35 | Entry revision 切换删除旧状态，Trace 仍外键引用实际 revision     | `world-book-import-export-v2.spec.ts`                                     |
|  36 | Companion Runtime State 持久化并递增 version                     | `companion-preview-active-memory.spec.ts`                                 |
|  37 | Claim/Projection 唯一权威源为 Revision.dataJson                  | Prisma Schema、`companion-preview-active-memory.spec.ts`                  |
|  38 | failed/stopped 不分配 completedOrdinal，Replay 不猜测 assistant  | `generation-lifecycle.spec.ts`、`replay-active-pointer.spec.ts`           |

## 调用链门禁

- Prompt、Preview、World Book 和 Memory 的有效历史统一由 `ConversationTimelineService` / `CompanionTimelineService` 解析。
- Tavern 与 Companion 不保留旧 Prompt Builder；真实聊天和 Preview 都直接调用各自 Section Builder，再调用同一个 Provider Compiler。
- 数据库顺序只用于稳定查询，业务顺序必须来自显式 `sequence`、`completedOrdinal`、`sortOrder` 和稳定 ID。
- 任一新增上下文来源必须同时补：Section source、Compiler trace、Preview 展示、成功 Trace、Replay/Memory 边界与本矩阵测试。
