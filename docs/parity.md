# Plane 对照清单

对照 Plane Cloud 工作区的信息架构（顶栏、图标轨、侧栏、项目标签、工作项布局、详情、周期、模块、视图、页面、收件箱、搜索、工作区/项目设置）。Ordr 使用自己的视觉和代码。URL 不强制尾部斜杠。

状态：`implemented` 已可用，`partial` 有入口或简化字段，`not-implemented` 只有占位或完全没有。

## 全局外壳

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 顶栏：工作区切换、居中搜索、收件箱、用户菜单 | partial | M1 | 搜索框会打开对话框，结果在 M5。没有 Help / Get started |
| 图标轨：Work、Wiki、AI、Settings、底部便签 | partial | M1 | AI 是说明页，没有助手 |
| 侧栏：New work item、Home、Drafts、Your work、Stickies | partial | M1 | New work item 先进入项目页；草稿/便签等待数据 |
| 侧栏 Workspace：Projects、Views、Cycles、Analytics、Archives、Dashboards | partial | M1 | 除 Projects 外是路线图页 |
| 侧栏展开的项目子导航 | not-implemented | M2 | 有项目之后再展开 |
| 项目内横栏：Overview、Work items、Cycles、Modules、Views、Pages、Intake | not-implemented | M2 | |
| URL `/{ws}/`、`/{ws}/projects/`、`/{ws}/settings/` | implemented | M1 | |
| URL `/{ws}/projects/{id}/issues/` 等项目路由 | not-implemented | M2 | |
| URL `/{ws}/browse/{KEY-N}/` | not-implemented | M2 | |
| URL `/{ws}/workspace-views/all-issues/`、`/active-cycles/`、`/analytics/`、`/archives/`、`/notifications/`、`/wiki/` | partial | M1 | 路由存在，内容未做 |
| `/settings/profile/api-tokens/` | partial | M1 | 占位，M5 实现 |

## 认证与成员（M1）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 邮箱 + 密码注册 / 登录 / 登出 | implemented | M1 | JWT 访问令牌 + 轮换刷新令牌，httpOnly cookie |
| 创建工作区（名称、slug）并切换 | implemented | M1 | |
| 工作区设置：名称、URL、公司规模、时区、删除 | partial | M1 | 没有 logo 上传，用首字母 |
| 成员表：姓名、邮箱、角色、加入日期 | partial | M1 | 角色含 Owner/Admin/Member/Guest。没有账务状态；认证固定为 Password |
| 按邮箱邀请，复制链接，接受后加入 | implemented | M1 | 不发邮件，链接出现在界面和 API 日志 |
| 角色权限：admin / member / guest | implemented | M1 | 只有 admin/owner 能改设置和邀请 |

## 工作区首页与项目列表

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 问候、日期、Quick links、Recents、Stickies | partial | M1 | 空状态文案，数据在后续里程碑 |
| 项目卡片：封面、emoji、标识、负责人、Joined | not-implemented | M2 | M1 是空的 Projects |
| 项目搜索、排序、筛选、Add project | not-implemented | M2 | 按钮先禁用 |

## 工作项（M2）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 列表，按状态分组，行内属性 | not-implemented | M2 | |
| 看板列 | not-implemented | M2 | |
| 日历 / 表格 / 甘特 | not-implemented | M2 | 同一批工作项的另外三种布局 |
| Display：属性、分组、排序、空分组、子工作项 | not-implemented | M2 | |
| Filters：状态、优先级、负责人、标签、周期、模块、日期 | not-implemented | M2 | AI filter 与 PQL 不做 |
| 创建工作项对话框 | not-implemented | M2 | |
| 详情：标题、属性、描述、子工作项、关系、链接、附件 | not-implemented | M2 | |
| 活动记录 | not-implemented | M2 | |
| 状态分组 Backlog / Unstarted / Started / Completed / Cancelled | not-implemented | M2 | |
| 优先级、标签、负责人、子工作项、阻塞/关联/重复 | not-implemented | M2 | |
| 草稿、归档 | not-implemented | M2 | |
| 投票、订阅 | not-implemented | M2 | 有则做简化 |
| 评论、提及、表情 | not-implemented | M4 | |
| 工时、Updates、Transition、里程碑 | not-implemented | — | 不在范围内 |

## 周期、模块、概览（M3）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 项目周期：Active / Upcoming / Completed | not-implemented | M3 | |
| 完成率、日期、负责人头像、燃尽、领先/落后 | not-implemented | M3 | |
| 工作区 Active cycles | not-implemented | M3 | |
| 模块列表 / 甘特、状态与日期 | not-implemented | M3 | |
| 项目 Overview 进度条 | not-implemented | M3 | 封面和里程碑不做完整版 |

## 页面、收件箱（M4）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 项目 Pages：Public / Private / Archives | not-implemented | M4 | Tiptap + Yjs |
| Wiki 首页与页面 | not-implemented | M4 | 工作区级页面 |
| 评论与 @提及 | not-implemented | M4 | |
| 通知 Inbox：All / Mentions | not-implemented | M4 | |

## 视图、搜索、开发者（M5）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 保存的视图，公开标记，收藏 | not-implemented | M5 | |
| 工作区 All work items | not-implemented | M5 | |
| 全局搜索 | not-implemented | M5 | |
| 导入 / 导出 JSON | not-implemented | M5 | |
| Webhooks 与投递记录 | not-implemented | M5 | |
| Personal access tokens | not-implemented | M5 | |
| Intake 待审队列 | not-implemented | M2 | 放在工作项里程碑，因为接受后生成工作项 |

## 明确不实现

账务、SSO、Identity、Workspace Governance、Teamspaces、Initiatives、Customers、Templates、Integrations、Releases、Epics、Work item types、Workflows、Automations、Recurring work items、Milestones、Time tracking / worklogs、Estimates 的完整体系（M2 会留一个简单点数）、Plane AI、Try 推广位（GitHub / Slack）。
