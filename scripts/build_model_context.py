from __future__ import annotations

import re
import shutil
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "model-context"

OVERALL_PDF = ROOT / "轻量级 AI 酒馆方案深度研究与实施报告.pdf"
STAGES_PDF = ROOT / "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"

RADICAL_FIXES = str.maketrans(
    {
        "⻚": "页",
        "⻛": "风",
        "⻓": "长",
        "⻅": "见",
        "⻬": "齐",
    }
)

STAGE_WAVES = [
    (0, 8, "baseline", "基线与工程骨架"),
    (9, 24, "core-entities", "核心实体与首批页面"),
    (25, 36, "chat-loop", "Prompt Builder、Model Gateway 与聊天闭环"),
    (37, 45, "content-enhancement", "世界书、导入导出与设置"),
    (46, 50, "deploy-and-acceptance", "部署、备份、回归与 MVP 验收"),
]

OVERALL_MODULES = [
    ("00-executive-summary.md", "执行摘要", "执行摘要", "文件方案提炼"),
    ("01-project-scope.md", "项目目标、边界与约束", "文件方案提炼", "外部对标与可行性评估"),
    ("02-benchmark-and-feasibility.md", "外部对标与可行性", "外部对标与可行性评估", "必要修订与建议版方案"),
    ("03-revised-architecture.md", "建议版目标与架构", "必要修订与建议版方案", "实施路线图"),
    ("04-implementation-roadmap.md", "实施路线图", "实施路线图", "资源、预算与监控"),
    ("05-risks-monitoring-and-operations.md", "资源、监控、风险与运维", "资源、预算与监控", "最终建议版实施结论"),
    ("06-final-mvp-conclusion.md", "最终 MVP 结论", "最终建议版实施结论", None),
]


@dataclass
class Stage:
    number: int
    title: str
    body: str

    @property
    def wave(self) -> tuple[str, str]:
        for start, end, wave_id, wave_title in STAGE_WAVES:
            if start <= self.number <= end:
                return wave_id, wave_title
        return "unknown", "未分组"


def extract_pdf_text(pdf_path: Path) -> str:
    chunks: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            chunks.append(f"\n\n<!-- source-page: {index} -->\n\n{text}")
    return clean_text("\n".join(chunks))


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(RADICAL_FIXES)
    text = re.sub(r"filecite.*?", "", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def strip_page_number_lines(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if re.fullmatch(r"\s*\d{1,3}\s*", line):
            continue
        lines.append(line.rstrip())
    return "\n".join(lines).strip()


def strip_page_markers(text: str) -> str:
    return re.sub(r"\n?\s*<!-- source-page: \d+ -->\s*\n?", "\n", text)


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).translate(RADICAL_FIXES)
    value = value.lower()
    value = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:80] or "stage"


def split_between(text: str, start_heading: str, end_heading: str | None) -> str:
    start = text.find(start_heading)
    if start < 0:
        return f"> 未在源文件中找到标题: `{start_heading}`\n"
    end = len(text)
    if end_heading:
        found = text.find(end_heading, start + len(start_heading))
        if found >= 0:
            end = found
    return strip_page_number_lines(text[start:end])


def parse_stages(text: str) -> tuple[str, list[Stage]]:
    pattern = re.compile(r"(?m)^阶段\s*(\d+)\s*[|｜]\s*(.+)$")
    matches = list(pattern.finditer(text))
    if not matches:
        raise RuntimeError("No stage headings found in staged prompts PDF")

    overview = strip_page_number_lines(text[: matches[0].start()])
    stages: list[Stage] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        number = int(match.group(1))
        title = match.group(2).strip()
        body = strip_page_number_lines(text[match.start() : end])
        stages.append(Stage(number=number, title=title, body=body))
    return overview, stages


def extract_field(body: str, label: str) -> str:
    label_variants = {
        "完成后输出": ["完成后输出", "完成后请输出"],
    }
    all_labels = [
        "阶段目标",
        "前置依赖",
        "文件范围",
        "本阶段要做",
        "本阶段不要做",
        "验收标准",
        "可能风险",
        "人工检查点",
        "完成后输出",
        "完成后请输出",
    ]
    variants = label_variants.get(label, [label])
    label_pattern = "|".join(re.escape(item) for item in variants)
    next_labels = "|".join(re.escape(item) for item in all_labels if item not in variants)
    pattern = re.compile(rf"(?:{label_pattern}):\s*(.*?)(?=\n(?:{next_labels}):|\n你现在是|\Z)", re.S)
    matches = list(pattern.finditer(body))
    if not matches:
        return ""
    match = matches[-1] if label in {"验收标准", "可能风险", "人工检查点", "完成后输出"} else matches[0]
    return re.sub(r"\s+", " ", match.group(1)).strip(" -\n")


def stage_markdown(stage: Stage) -> str:
    wave_id, wave_title = stage.wave
    fields = {
        "阶段目标": extract_field(stage.body, "阶段目标"),
        "前置依赖": extract_field(stage.body, "前置依赖"),
        "文件范围": extract_field(stage.body, "文件范围"),
        "本阶段要做": extract_field(stage.body, "本阶段要做"),
        "本阶段不要做": extract_field(stage.body, "本阶段不要做"),
        "验收标准": extract_field(stage.body, "验收标准"),
        "可能风险": extract_field(stage.body, "可能风险"),
        "人工检查点": extract_field(stage.body, "人工检查点"),
        "完成后输出": extract_field(stage.body, "完成后输出"),
    }
    lines = [
        "---",
        f"stage: {stage.number}",
        f'title: "{stage.title}"',
        f'wave: "{wave_id}"',
        f'wave_title: "{wave_title}"',
        f'source_pdf: "{STAGES_PDF.name}"',
        "---",
        "",
        f"# 阶段 {stage.number}｜{stage.title}",
        "",
        "## 快速读取",
        "",
        f"- 波次: {wave_title}",
    ]
    for key, value in fields.items():
        if value:
            lines.append(f"- {key}: {value}")
    lines.extend(
        [
            "",
            "## 完整阶段提示词与说明",
            "",
            "```text",
            stage.body.strip(),
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def build_core_brief(stages: list[Stage]) -> str:
    stage_lines = "\n".join(
        f"| {stage.number:02d} | {stage.title} | {stage.wave[1]} |"
        for stage in stages
    )
    wave_lines = "\n".join(
        f"| {start:02d}-{end:02d} | `{wave_id}` | {wave_title} |"
        for start, end, wave_id, wave_title in STAGE_WAVES
    )
    return f"""# Tavern Lite 模型上下文总览

## 用途

本目录把两个 PDF 解析成长期可复用的 Markdown 知识包，供 Codex、Claude Code 或其他模型在后续开发中按需读取。

## 源文件

- `{OVERALL_PDF.name}`: 总体方案、范围收敛、架构取舍、路线图、风险与验收。
- `{STAGES_PDF.name}`: 0-50 阶段的可执行开发提示词与验收要求。

## 首版硬目标

- 做轻量级、自托管、Web 优先的 AI 酒馆 / 角色对话系统。
- 首版闭环聚焦: 角色卡、会话、消息、Prompt Builder v1、Prompt 预览、OpenAI-compatible 模型配置、流式聊天、关键词世界书、导入导出、备份恢复与基础部署。
- 技术栈基线: Vue3 + Vite + TypeScript + Pinia + Vue Router + Naive UI；NestJS + Prisma + SQLite。
- 开发方式: 分阶段小步推进，每个阶段只改可控边界，必须声明依赖、文件范围、不做事项、验收标准和风险。

## 明确不进入 MVP 的内容

- 支付、公开市场、复杂后台、多租户 SaaS、大规模审核。
- 插件市场、机器人接入、TTS、图片生成、RAG、向量数据库、Redis。
- 群聊、复杂分支剧情、长期记忆摘要、脚本系统、多端原生包装。
- 前端保存或暴露 API Key；业务代码直接调用供应商 SDK；聊天接口绕过 Prompt Builder。

## 核心工程不变量

- Prompt Builder 是唯一 Prompt 组装入口；Prompt 预览与真实聊天必须复用同一条构建路径。
- Model Gateway 是唯一模型供应商适配入口；聊天服务和前端页面不直接耦合具体 provider。
- SQLite 适合首版低并发自托管；需要短事务、会话级锁、WAL、分页加载和备份恢复路径。
- 世界书首版只做关键词触发、scan depth、token budget、priority、命中调试，不做复杂递归或向量召回。
- 流式聊天使用 `POST /chat/stream` + fetch stream / SSE 语义，必须支持停止生成、失败回退、保存 assistant 回复。

## 推荐读取顺序

1. `README.md`
2. `overall-plan/00-executive-summary.md`
3. `overall-plan/01-project-scope.md`
4. `overall-plan/03-revised-architecture.md`
5. `stages/stage-index.md`
6. 当前要执行的 `stages/stage-XX-*.md`

## 阶段波次

| 阶段范围 | wave | 含义 |
|---|---|---|
{wave_lines}

## 阶段索引

| 阶段 | 标题 | 波次 |
|---:|---|---|
{stage_lines}
"""


def build_stage_index(stages: list[Stage]) -> str:
    rows = []
    for stage in stages:
        file_name = f"stage-{stage.number:02d}-{slugify(stage.title)}.md"
        deps = extract_field(stage.body, "前置依赖") or "未提取"
        scope = extract_field(stage.body, "文件范围") or "未提取"
        rows.append(
            f"| {stage.number:02d} | [{stage.title}]({file_name}) | {stage.wave[1]} | {deps} | {scope} |"
        )
    return """# 分阶段提示词索引

本索引来自分阶段提示词 PDF。每个阶段文件都包含 front matter、快速读取字段和完整阶段提示词。

| 阶段 | 标题 | 波次 | 前置依赖 | 文件范围 |
|---:|---|---|---|---|
""" + "\n".join(rows) + "\n"


def main() -> None:
    if not OVERALL_PDF.exists() or not STAGES_PDF.exists():
        raise FileNotFoundError("Expected both source PDFs in repository root")

    if OUT.exists():
        shutil.rmtree(OUT)

    overall_text = extract_pdf_text(OVERALL_PDF)
    stages_text = extract_pdf_text(STAGES_PDF)
    overall_module_text = strip_page_markers(overall_text)
    stages_module_text = strip_page_markers(stages_text)
    overview, stages = parse_stages(stages_module_text)

    write(OUT / "README.md", build_core_brief(stages))
    write(
        OUT / "source-map.md",
        f"""# Source Map

| Source PDF | Pages | Parsed Output |
|---|---:|---|
| `{OVERALL_PDF.name}` | 15 | `overall-plan/`, `source-extracts/overall-clean.md` |
| `{STAGES_PDF.name}` | 76 | `stages/`, `source-extracts/staged-prompts-clean.md` |

Generated by `scripts/build_model_context.py`.
""",
    )

    write(OUT / "source-extracts" / "overall-clean.md", strip_page_number_lines(overall_text))
    write(OUT / "source-extracts" / "staged-prompts-clean.md", strip_page_number_lines(stages_text))

    for file_name, title, start, end in OVERALL_MODULES:
        content = split_between(overall_module_text, start, end)
        write(
            OUT / "overall-plan" / file_name,
            f"""---
title: "{title}"
source_pdf: "{OVERALL_PDF.name}"
---

# {title}

{content}
""",
        )

    overall_index = "\n".join(
        f"- [{title}]({file_name})" for file_name, title, _, _ in OVERALL_MODULES
    )
    write(
        OUT / "overall-plan" / "README.md",
        f"""# 总体方案模块索引

{overall_index}

完整清洗抽取见 `../source-extracts/overall-clean.md`。
""",
    )

    write(
        OUT / "stages" / "README.md",
        f"""# 分阶段开发提示词

## 概览

{overview}

## 使用方式

- 先读 `stage-index.md` 判断当前阶段、依赖和文件范围。
- 再读对应 `stage-XX-*.md`。
- 阶段文件里的 `快速读取` 用于模型快速建立边界；`完整阶段提示词与说明` 保留 PDF 原始阶段内容。
""",
    )
    write(OUT / "stages" / "stage-index.md", build_stage_index(stages))
    write(
        OUT / "stages" / "_all-stages.md",
        "# 全阶段提示词合集\n\n" + "\n\n---\n\n".join(stage.body for stage in stages),
    )
    for stage in stages:
        file_name = f"stage-{stage.number:02d}-{slugify(stage.title)}.md"
        write(OUT / "stages" / file_name, stage_markdown(stage))

    print(f"Generated {OUT}")
    print(f"Stages: {len(stages)}")
    print(f"Overall modules: {len(OVERALL_MODULES)}")


if __name__ == "__main__":
    main()
