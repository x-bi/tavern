---
stage: 13
title: "角色头像上传"
wave: "core-entities"
wave_title: "核心实体与首批页面"
source_pdf: "Tavern Lite 分阶段开发提示词总表与落地执行章.pdf"
---

# 阶段 13｜角色头像上传

## 快速读取

- 波次: 核心实体与首批页面
- 阶段目标: 让角色拥有上传头像能力。
- 前置依赖: 阶段 11、阶段 12。
- 文件范围: assets/* 、 AvatarUploader.vue 、角色表单。
- 本阶段要做: 后端上传 API、本地保存、前端上传组件。
- 本阶段不要做: 不处理 OSS/S3。
- 验收标准: 1. 角色头像可上传 2. 列表与详情页能展示头像 3. 非法文件会被拒绝 4. 资源记录写入数据库
- 完成后输出: 1. 修改文件列表 2. 新增文件列表 3. 如何测试上传 4. 已完成内容 5. 未完成内容 6. 风险和 TODO

## 完整阶段提示词与说明

```text
阶段 13|角色头像上传
阶段目标: 让角色拥有上传头像能力。
前置依赖: 阶段 11、阶段 12。
文件范围: assets/* 、 AvatarUploader.vue 、角色表单。
本阶段要做: 后端上传 API、本地保存、前端上传组件。
本阶段不要做: 不处理 OSS/S3。
你现在是本项目的开发助手,负责在现有代码基础上完成 Tavern Lite 的第 13 阶段开发。
项目背景:
角色头像是角色列表和详情页的重要视觉元素。第一版采用本地 uploads 目录存储。
当前阶段:
第 13 阶段:角色头像上传
前置条件:
- 已完成:角色详情页、角色编辑页
- 当前已有目录:assets 模块占位、角色前端页面
- 当前已有模块:角色 CRUD
本阶段目标:
- 实现本地头像上传
- 生成 Asset 记录与访问 URL
- 接入角色创建/编辑表单
本阶段需要实现:
1. 创建 AssetsModule 基础上传接口 POST /api/assets/upload
2. 限制文件类型和大小
3. 保存到本地 uploads/avatars/characters 或约定目录
4. 生成 Asset 表记录
5. 在 CharacterEditor 中接入 AvatarUploader.vue
6. 创建后能够把 avatarUrl 或 assetId 写回角色
涉及文件范围:
- apps/server/src/modules/assets/*
- apps/server/src/main.ts 或 ServeStatic 配置
- apps/web/src/components/AvatarUploader.vue
- apps/web/src/components/CharacterEditor.vue
- apps/web/src/api/assets.ts
- apps/web/src/api/characters.ts
本阶段明确不要做:
- 不要实现 OSS/COS/S3
- 不要做图片裁剪工作流
- 不要做用户头像
- 不要删除旧文件的复杂回收逻辑
- 不要暴露敏感路径
- 不要硬编码 Prompt
- 不要引入非 MVP 功能
代码要求:
- 后端要校验 mime/type/size
- URL 访问逻辑清晰
- 上传组件可复用
验收标准:
1. 角色头像可上传
2. 列表与详情页能展示头像
3. 非法文件会被拒绝
4. 资源记录写入数据库
完成后请输出:
1. 修改文件列表
2. 新增文件列表
3. 如何测试上传
4. 已完成内容
5. 未完成内容
6. 风险和 TODO
```
