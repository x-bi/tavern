-- PromptPreset.outputRulesJson 实际存储的是 V2 的 outputRuleOperations，
-- 列名仍是 V1 口径，容易导致后续代码混淆 outputRules 与 outputRuleOperations。
-- 统一重命名为 outputRuleOperationsJson。
-- 历史预设数据无价值（见清理方案 §0.2 / §2.3），无需 RENAME COLUMN 保留数据，
-- 直接 drop 旧列 + add 新列。
ALTER TABLE "PromptPreset" DROP COLUMN "outputRulesJson";

ALTER TABLE "PromptPreset" ADD COLUMN "outputRuleOperationsJson" TEXT NOT NULL DEFAULT '[]';
