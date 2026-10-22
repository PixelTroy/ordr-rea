# Plane 对照清单

对照 Plane Cloud 工作区的信息架构（顶栏、图标轨、侧栏、项目标签、工作项布局、详情、周期、模块、视图、页面、收件箱、搜索、工作区/项目设置），以及补充截图 70–76 的详情页和表单。Ordr 使用自己的视觉和代码。URL 不强制尾部斜杠。

状态：`implemented` 已可用，`partial` 有入口或简化字段，`not-implemented` 只有占位或完全没有。

## 全局外壳

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 顶栏：工作区切换、居中搜索、收件箱、用户菜单 | partial | M5 | 搜索覆盖工作项、项目、周期、模块和页面。没有 Help / Get started |
| 图标轨：Work、Wiki、AI、Settings、底部便签 | partial | M1 | AI 是说明页，没有助手 |
| 侧栏：New work item、Home、Drafts、Your work、Stickies | partial | M2 | New work item 打开创建对话框。草稿和 Your work 已接数据。便签仍是占位 |
| 侧栏 Workspace：Projects、Views、Cycles、Analytics、Archives、Dashboards | partial | M5 | Views 打开 All work items。Cycles 是进行中的周期。Analytics / Dashboards 仍是占位 |
| 侧栏展开的项目子导航 | implemented | M2 | Work items、Cycles、Modules、Views、Pages、Intake |
| 项目内横栏：Overview、Work items、Cycles、Modules、Views、Pages、Intake | implemented | M5 | |
| URL `/{ws}/`、`/{ws}/projects/`、`/{ws}/settings/` | implemented | M1 | |
| URL `/{ws}/projects/{id}/issues/`、`/overview/`、`/intake/` | implemented | M2 | |
| URL `/{ws}/projects/{id}/cycles|modules|views|pages/` | implemented | M5 | 视图详情在 `.../views/{viewId}/` |
| URL `/{ws}/browse/{KEY-N}/` | implemented | M2 | |
| URL `/{ws}/workspace-views/all-issues/`、`/active-cycles/`、`/analytics/`、`/notifications/`、`/wiki/` | partial | M5 | All work items、Active cycles、通知和 Wiki 已可用。Analytics 仍是占位 |
| URL `/{ws}/drafts/`、`/{ws}/your-work/`、`/{ws}/archives/` | implemented | M2 | |
| URL `/{ws}/settings/access-tokens/` | implemented | M5 | 创建框：Title、Description、过期日期或 Never expires，然后 Generate token。明文只出现一次 |

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
| 问候、日期、Quick links、Recents、Stickies | partial | M2 | Recents 记录打开过的项目和工作项。Quick links 和 Stickies 仍空 |
| 项目卡片：封面、emoji、标识、负责人、Joined | implemented | M2 | 封面是纯色，不是图片 |
| 项目搜索、排序、筛选、Add project | implemented | M2 | 筛选按 Public / Private |

## 工作项（M2）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 列表，按状态分组，行内属性 | implemented | M2 | 行上还没有周期 / 模块芯片，等 M3 |
| 看板列，拖到另一列改状态 | implemented | M2 | |
| 日历 / 表格 / 甘特 | implemented | M2 | 日历可开关周末。甘特按开始/截止日期画条 |
| Display：属性、分组、排序、空分组、子工作项 | implemented | M2 | 存在 localStorage `ordr:display:{projectId}` |
| Filters：状态、优先级、负责人、标签、标题 | partial | M2 | 没有 AI filter、PQL、周期、模块、里程碑 |
| 创建工作项对话框 | implemented | M2 | 标题、描述、状态、优先级、负责人、标签、日期、父项、Create more |
| 详情：标题、属性、描述、子工作项、关系、链接、附件 | implemented | M2 | 见 `/{ws}/browse/{KEY-N}/` |
| 活动记录 | implemented | M2 | Comments 页签说明在 M4 |
| 状态分组 Backlog / Unstarted / Started / Completed / Cancelled | implemented | M2 | 项目设置里可增删 |
| 优先级、标签、负责人、子工作项、阻塞/关联/重复 | implemented | M2 | 关系类型 RELATES_TO、BLOCKS、BLOCKED_BY、DUPLICATE_OF。截图里的 Implements / Starts before 不做 |
| 草稿、归档 | implemented | M2 | 项目可归档；工作项可标记草稿 |
| 投票、订阅 | implemented | M2 | |
| 评论、提及、表情 | partial | M4 | 评论、@提及和一种表情反应已可用。页面内评论线程未做 |
| 工时、Updates、Transition、里程碑 | not-implemented | — | 不在范围内 |
| 项目设置 General / Members / States / Labels / Estimates | partial | M2 | `/{ws}/settings/projects/{id}/`。Estimates 只有点数和 T-shirt。没有 Epics、类型、工作流 |

## Intake（M2）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| Open / Closed、两栏列表和详情、Pending | implemented | M2 | |
| Accept 生成工作项，Decline 关闭 | implemented | M2 | 没有外部 Intake source 集成 |

## 周期、模块、概览（M3）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 项目周期：Active / Upcoming / Completed | implemented | M3 | 日期范围不能重叠，因此同一天只有一个进行中的周期 |
| 完成率、日期、负责人头像、燃尽、领先/落后 | implemented | M3 | 燃尽理想线按范围线性下降，实际剩余看 `completedAt` |
| 周期详情 `/{ws}/projects/{id}/cycles/{cycleId}/` | implemented | M3 | 工作项列表、右侧状态/负责人/标签、新建或添加已有工作项 |
| 同一项目只允许一个进行中的周期，日期不重叠 | implemented | M3 | 重叠返回 400 |
| 工作区 Active cycles | implemented | M3 | `/{ws}/active-cycles/` |
| 模块列表 / 甘特、状态与日期 | implemented | M3 | 状态 Backlog / Planned / In Progress / Paused / Completed / Cancelled |
| 模块详情 `/{ws}/projects/{id}/modules/{moduleId}/` | implemented | M3 | 创建框含标题、描述、起止日期、状态。成员在 API 里 |
| 项目 Overview 进度条 | partial | M2 | 按状态分组的进度条和侧栏。封面图和 Milestones 不做 |

## 页面、收件箱（M4）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 项目 Pages：Public / Private / Archives | implemented | M4 | |
| 页面编辑器 `/{ws}/projects/{id}/pages/{pageId}/` | implemented | M4 | Tiptap + Yjs，经 Socket.IO 同步，标题单独保存 |
| Wiki 首页与页面 | partial | M4 | `/{ws}/wiki/` 列出工作区页面并可编辑。没有 Collections |
| 评论与 @提及 | implemented | M4 | 评论在工作项详情。提及写入通知 |
| 通知 Inbox：All / Mentions | implemented | M4 | `/{ws}/notifications/`。可全部标为已读 |

## 视图、搜索、开发者（M5）

| 能力 | 状态 | 里程碑 | 说明 |
| --- | --- | --- | --- |
| 保存的视图，公开标记，收藏 | implemented | M5 | 创建框：标题、描述、Public/Private、布局。列表显示公开标记和收藏 |
| 视图详情 `/{ws}/projects/{id}/views/{viewId}/` | implemented | M5 | 过滤条、五种布局、Share（Public/Private）、收藏。筛选会写回视图 |
| 工作区 All work items | implemented | M5 | `/{ws}/workspace-views/all-issues/` |
| 全局搜索 | implemented | M5 | 工作项标题和描述、项目、周期、模块、页面 |
| 导入 / 导出 JSON | implemented | M5 | `/{ws}/settings/exports/` 与 `/{ws}/settings/imports/`。形状是项目、状态、标签、工作项。只有管理员能导入 |
| Webhooks 列表和创建表单 | implemented | M5 | `/{ws}/settings/webhooks/`。字段：标题、Payload URL、V1 范围（Projects、Cycles、Work Items、Modules、Work item comments）以及 V2 的 created/updated/archived/deleted。投递带 `X-Ordr-Signature` |
| Personal access tokens | implemented | M5 | `/{ws}/settings/access-tokens/`。对话框：Title、Description、过期日期或 Never expires，然后 Generate token。`Authorization: Bearer` 只对该工作区有效 |

## 明确不实现

账务、SSO、Identity、Workspace Governance、Teamspaces、Initiatives、Customers、Templates、Integrations、Releases、Epics、Work item types、Workflows、Automations、Recurring work items、Milestones、Time tracking / worklogs、Estimates 的完整体系（只有点数和 T-shirt）、Plane AI、Try 推广位（GitHub / Slack）、关系类型里的 Implements / Starts before / Finishes after。
