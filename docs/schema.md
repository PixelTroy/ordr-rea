# 数据模型

M1 已经落库的是用户、会话、工作区、成员和邀请。后面的表按里程碑追加 migration，这里先把完整形状定下来，避免后面改主键和外键。

标识都用 cuid 字符串。时间戳是 `timestamptz` 语义上的 UTC（Prisma `DateTime`）。工作区以 `slug` 作为 URL，项目以 id 作为 URL，工作项以 `项目标识-序号`（例如 `CLONE-3`）作为浏览地址。

## M1（已迁移）

### users

| 列 | 说明 |
| --- | --- |
| id | 主键 |
| email | 唯一，小写 |
| password_hash | bcrypt |
| display_name | 显示名 |
| avatar_color | 由邮箱算出的颜色 |
| created_at / updated_at | |

### sessions

刷新令牌只存 SHA-256。访问令牌是 15 分钟 JWT，放在 httpOnly cookie `ordr_access`。刷新令牌 cookie 是 `ordr_refresh`，轮换时改写 hash。`revoked_at` 表示登出。

### workspaces

| 列 | 说明 |
| --- | --- |
| name, slug | slug 全局唯一，3–48，`[a-z0-9-]`，避开 `login` 等保留字 |
| description | |
| company_size | 例如 `1-10` |
| timezone | IANA 时区名 |
| logo_url | 预留，M1 界面用首字母 |
| owner_id | 创建者，不能被移除 |

### workspace_members

`(workspace_id, user_id)` 唯一。`role` 是 `ADMIN | MEMBER | GUEST`。创建者同时是 `ADMIN` 且 `is_owner = true`。界面把 owner 显示成 Owner。

权限：

- Owner：全部，包括删除工作区。
- Admin：改设置、邀请、改他人角色，不能删除工作区，不能动 owner。
- Member：读写工作区内容（项目从 M2 开始），不能改设置、不能邀请。
- Guest：只读工作区壳，不能改设置、不能邀请。项目范围在 M2 再收紧到被加入的项目。

### workspace_invites

`email + role + token + expires_at + accepted_at`。同一邮箱未接受的邀请会轮换 token。链接是 `{APP_URL}/invite/{token}`，接口返回并写日志，不发邮件。默认 7 天。接受时登录邮箱必须一致。

## M2 项目与工作项

### projects

`workspace_id`，`name`，`identifier`（工作区内唯一，大写 2–6 位，如 `CLONE`），`description`，`emoji`，`cover_color`，`network`（`PUBLIC` 工作区内可见 / `PRIVATE` 仅项目成员），`lead_id`，`default_assignee_id`，`timezone`，`issue_counter`，功能开关 `cycles_enabled`、`modules_enabled`、`views_enabled`、`pages_enabled`、`intake_enabled`、`time_tracking_enabled`，`estimate_type`（`NONE | POINTS | CATEGORIES`），`estimate_scale` JSON，`archived_at`。

### project_members

`(project_id, user_id)` 唯一，`role` 为 `ADMIN | MEMBER | GUEST`。创建者成为项目 Admin 和 lead。工作区 Admin 可以看见全部项目。工作区 Guest 只能看见被加入的项目。

### states

属于项目。`name`，`color`，`group`（`BACKLOG | UNSTARTED | STARTED | COMPLETED | CANCELLED`），`sequence`，`is_default`。新建项目时写入 Backlog、Todo、In Progress、Done、Cancelled。

### labels

属于项目。`name`，`color`，可选 `parent_id`（标签组）。

### issues（工作项）

`project_id`，`sequence_id`（项目内递增），`title`，`description`（纯文本或轻量 HTML/JSON），`priority`（`URGENT | HIGH | MEDIUM | LOW | NONE`），`state_id`，`parent_id`（子工作项），`created_by_id`，`start_date`，`due_date`，`completed_at`，`sort_order`，`estimate`，`is_draft`，`archived_at`。展示编号是 `{identifier}-{sequence_id}`。

### issue_assignees / issue_labels

多对多。

### issue_relations

`issue_id`，`related_issue_id`，`type`：`RELATES_TO | BLOCKS | BLOCKED_BY | DUPLICATE_OF`。展示时从两边查询。

### issue_links / attachments

链接保存 `url`、`title`。附件元数据加本地磁盘路径（`UPLOAD_DIR`），限制大小。

### issue_votes / issue_subscriptions

`value` 为 `1 | -1`。创建者自动订阅。

### activities

`workspace_id`，`project_id`，`issue_id` 可空，`actor_id`，`action`，`field`，`old_value`，`new_value`，`created_at`。工作项、周期、模块的变更都写这里。

### intake_items

`project_id`，`title`，`description`，`status`（`PENDING | ACCEPTED | DECLINED`），`source`，接受后的 `issue_id`。

## M3 周期与模块

### cycles

`project_id`，`name`，`description`，`start_date`，`end_date`，`completed_at`。进行中 / 即将开始 / 已完成由日期和 `completed_at` 推导。一个工作项同时只在一个周期里。

### cycle_issues

`(cycle_id, issue_id)`，`issue_id` 唯一，`created_at` 用于燃尽图。

燃尽：理想线从周期开始时的范围线性降到 0。实际剩余 = 当天范围减去 `completed_at` 不晚于当天的工作项。领先/落后 = 理想剩余 − 实际剩余。

### modules

`name`，`description`，`status`（`BACKLOG | PLANNED | IN_PROGRESS | PAUSED | COMPLETED | CANCELLED`），`start_date`，`target_date`，`lead_id`。

### module_issues

多对多，一个工作项可以属于多个模块。

## M4 页面、评论、通知

### pages

`workspace_id`，可选 `project_id`（空则属于 wiki），`title`，`access`（`PUBLIC | PRIVATE`），`content_json`（Tiptap JSON），`yjs_state`（Yjs 快照字节），`created_by_id`，`updated_by_id`，`archived_at`。

### page_favorites

`(page_id, user_id)`。

协作：Socket.IO 房间按页面 id。服务端持有 `Y.Doc`，把更新广播并定期写入 `yjs_state`。Redis pub/sub 用于多实例。客户端用短时票据，不把 httpOnly cookie 暴露给跨端口 WebSocket。

### comments / comment_reactions

评论挂在工作项上。正文用 Tiptap JSON。提及写成 `mention` 节点，保存 user id。反应是 `(comment_id, user_id, emoji)`。

### notifications

`user_id`，`workspace_id`，`actor_id`，`type`（`mention | assignment | comment | invite`），`title`，`body`，`href`，`read_at`。收件箱按全部 / 提及过滤。

### stickies / quick_links / recent_visits

首页小组件。sticky 属于用户和工作区。recent 在打开项目、工作项、页面时更新。

## M5 视图、搜索、令牌、Webhook

### saved_views

`workspace_id`，可选 `project_id`，`name`，`layout`（`LIST | KANBAN | CALENDAR | SPREADSHEET | GANTT`），`filters` JSON，`display` JSON（属性开关、分组、排序），`is_public`，`created_by_id`。工作区有内置的 All work items，不落库。

### view_favorites

`(view_id, user_id)`。

搜索不另建表，用 Postgres `ILIKE` / `tsvector` 覆盖工作项标题与描述、项目、周期、模块、页面。

### api_tokens

`user_id`，`name`，`token_hash`，`prefix`（展示用），`last_used_at`，`expires_at`。明文只在创建时返回一次，前缀 `ordr_`。`Authorization: Bearer` 与会话 cookie 走同一套守卫。

### webhooks / webhook_deliveries

工作区级。`url`，`secret`，`events`（`issue.created`、`issue.updated`、`issue.deleted`、`comment.created`、`project.created`、`cycle.created`、`module.created`），`is_active`。投递带 `X-Ordr-Signature`（HMAC-SHA256）。每次尝试写入 delivery：状态码、响应片段、是否成功。

导入导出不另建表。导出是工作区或项目的 JSON；导入按同一形状创建项目、状态、标签和工作项。

## 明确不做的 Plane 能力

账务、SSO、团队空间、倡议、客户、史诗、工作项类型、工作流、自动化、重复工作项、里程碑、发布、工时、Plane AI、第三方集成。这些只出现在导航占位和 `docs/parity.md`。
