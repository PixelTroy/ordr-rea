# Plane 对照清单

对照 Plane Cloud 工作区的信息架构（顶栏、图标轨、侧栏、项目标签、工作项布局、详情、周期、模块、视图、页面、收件箱、搜索、工作区/项目设置），以及补充截图 70–76 的详情页和表单。Ordr 使用自己的视觉和代码。URL 不强制尾部斜杠。

状态：`implemented` 已可用，`partial` 有入口或简化字段，`not-implemented` 只有占位或完全没有。

Verified 是 2026-10-22 用 `docker compose` 和 `scripts/seed-demo.mjs`（工作区 `gootroy`，项目 Clone Research）逐项打开页面对过的结果。`pass` 是这条能力的主要字段和布局都在，`partial` 是能用但和 Plane 参考比少了一块，`fail` 是打不开或和说明不符，`n/a` 是明确不做、没有再验收。

## 全局外壳

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 顶栏：工作区切换、居中搜索、收件箱、用户菜单 | partial | M5 | partial | 搜索覆盖工作项、项目、周期、模块和页面。没有 Help / Get started |
| 图标轨：Work、Wiki、AI、Settings、底部便签 | partial | M1 | partial | AI 是说明页，没有助手 |
| 侧栏：New work item、Home、Drafts、Your work、Stickies | partial | M2 | partial | New work item 打开创建对话框。草稿和 Your work 已接数据。便签仍是占位 |
| 侧栏 Workspace：Projects、Views、Cycles、Analytics、Archives、Dashboards | partial | M5 | partial | Views 打开 All work items。Cycles 是进行中的周期。Analytics / Dashboards 仍是占位 |
| 侧栏展开的项目子导航 | implemented | M2 | pass | Work items、Cycles、Modules、Views、Pages、Intake |
| 项目内横栏：Overview、Work items、Cycles、Modules、Views、Pages、Intake | implemented | M5 | pass | |
| URL `/{ws}/`、`/{ws}/projects/`、`/{ws}/settings/` | implemented | M1 | pass | |
| URL `/{ws}/projects/{id}/issues/`、`/overview/`、`/intake/` | implemented | M2 | pass | Intake 有 Open 列表和 Pending |
| URL `/{ws}/projects/{id}/cycles\|modules\|views\|pages/` | implemented | M5 | pass | 详情分别在 cycle、module、view、page id 下 |
| URL `/{ws}/browse/{KEY-N}/` | implemented | M2 | pass | |
| URL `/{ws}/workspace-views/all-issues/`、`/active-cycles/`、`/analytics/`、`/notifications/`、`/wiki/` | partial | M5 | partial | All work items、Active cycles、通知和 Wiki 已打开。Analytics 仍是占位 |
| URL `/{ws}/drafts/`、`/{ws}/your-work/`、`/{ws}/archives/` | implemented | M2 | pass | 草稿、分配给自己的工作项、已归档项目都能列出来 |
| URL `/{ws}/settings/access-tokens/` | implemented | M5 | pass | 创建框：Title、Description、过期日期或 Never expires，然后 Generate token。明文只出现一次 |

## 认证与成员（M1）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 邮箱 + 密码注册 / 登录 / 登出 | implemented | M1 | pass | JWT 访问令牌 + 轮换刷新令牌，httpOnly cookie。登录页和注册页都打开过 |
| 创建工作区（名称、slug）并切换 | implemented | M1 | pass | 顶栏切换器列出 Gootroy |
| 工作区设置：名称、URL、公司规模、时区、删除 | partial | M1 | partial | 没有 logo 上传，用首字母 |
| 成员表：姓名、邮箱、角色、加入日期 | partial | M1 | partial | 角色含 Owner/Admin/Member/Guest。没有账务状态；认证固定为 Password |
| 按邮箱邀请，复制链接，接受后加入 | implemented | M1 | pass | 不发邮件，链接出现在界面和 API 日志。演示里 Grace 通过链接加入并评论 |
| 角色权限：admin / member / guest | implemented | M1 | pass | 只有 admin/owner 能改设置和邀请。客人只读由 API 测试覆盖 |

## 工作区首页与项目列表

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 问候、日期、Quick links、Recents、Stickies | partial | M2 | partial | Recents 记录打开过的项目和工作项。Quick links 和 Stickies 仍空 |
| 项目卡片：封面、emoji、标识、负责人、Joined | implemented | M2 | pass | 封面是纯色，不是图片 |
| 项目搜索、排序、筛选、Add project | implemented | M2 | pass | 筛选按 Public / Private |

## 工作项（M2）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 列表，按状态分组，行内属性 | implemented | M2 | pass | 分组和计数、ID、标题、状态、优先级、日期、负责人、标签、周期、模块、子工作项计数。没有行上的 “...” 菜单 |
| 看板列，拖到另一列改状态 | implemented | M2 | pass | 列按状态，卡片带同样的属性芯片 |
| 日历 / 表格 / 甘特 | implemented | M2 | pass | 日历可开关周末。表格含 Modules、Cycle。甘特按开始/截止日期画条；有日期时不再因跨度变量未初始化而白屏 |
| Display：属性、分组、排序、空分组、子工作项 | implemented | M2 | pass | 存在 localStorage `ordr:display:{projectId}`。属性含 cycle、module。没有 Dependencies |
| Filters：状态、优先级、负责人、标签、标题 | partial | M2 | partial | 另有周期和模块。没有 AI filter、PQL、里程碑 |
| 创建工作项对话框 | implemented | M2 | pass | 标题、描述、状态、优先级、负责人、标签、日期、父项、Create more |
| 详情：标题、属性、描述、子工作项、关系、链接、附件 | implemented | M2 | partial | 描述是纯文本框，不是富文本。右侧有 Parent、Labels、Cycle、Modules。没有 Milestone |
| 活动记录 | implemented | M2 | pass | Activity 页签列出 created / relation 等 |
| 状态分组 Backlog / Unstarted / Started / Completed / Cancelled | implemented | M2 | pass | 项目设置里可增删。演示数据铺在 Backlog、Todo、In Progress、Done、Cancelled |
| 优先级、标签、负责人、子工作项、阻塞/关联/重复 | implemented | M2 | pass | 关系显示成 Blocking 等。截图里的 Implements / Starts before 不做 |
| 草稿、归档 | implemented | M2 | pass | 草稿在 Drafts。项目可归档，Archives 列出 Old Scan |
| 投票、订阅 | implemented | M2 | pass | 详情顶部 Up / Down 和 Subscribe |
| 评论、提及、表情 | partial | M4 | partial | 评论、@提及和一种表情反应已可用。页面内评论线程未做 |
| 工时、Updates、Transition、里程碑 | not-implemented | — | n/a | 不在范围内 |
| 项目设置 General / Members / States / Labels / Estimates | partial | M2 | partial | `/{ws}/settings/projects/{id}/`。Estimates 只有点数和 T-shirt。没有 Epics、类型、工作流 |

## Intake（M2）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| Open / Closed、两栏列表和详情、Pending | implemented | M2 | pass | 演示有一条 Pending |
| Accept 生成工作项，Decline 关闭 | implemented | M2 | pass | 没有外部 Intake source 集成 |

## 周期、模块、概览（M3）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 项目周期：Active / Upcoming / Completed | implemented | M3 | pass | Sprint Alpha 在 Active，Sprint Beta: Competitor Research 在 Upcoming |
| 完成率、日期、负责人头像、燃尽、领先/落后 | implemented | M3 | pass | 燃尽理想线按范围线性下降，实际剩余看 `completedAt` |
| 周期详情 `/{ws}/projects/{id}/cycles/{cycleId}/` | implemented | M3 | pass | 工作项列表、右侧状态/负责人/标签、新建或添加已有工作项 |
| 同一项目只允许一个进行中的周期，日期不重叠 | implemented | M3 | pass | 重叠返回 400。演示的两个周期日期错开 |
| 工作区 Active cycles | implemented | M3 | pass | `/{ws}/active-cycles/` 只列出 Sprint Alpha，并有燃尽 |
| 模块列表 / 甘特、状态与日期 | implemented | M3 | pass | 状态 Backlog / Planned / In Progress / Paused / Completed / Cancelled |
| 模块详情 `/{ws}/projects/{id}/modules/{moduleId}/` | implemented | M3 | pass | 创建框含标题、描述、起止日期、状态。成员在 API 里 |
| 项目 Overview 进度条 | partial | M2 | partial | 按状态分组的进度条和侧栏。封面图和 Milestones 不做 |

## 页面、收件箱（M4）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 项目 Pages：Public / Private / Archives | implemented | M4 | pass | 三个页签、搜索、Public 行 |
| 页面编辑器 `/{ws}/projects/{id}/pages/{pageId}/` | implemented | M4 | partial | 标题和正文可编辑，Yjs 显示 Saved。工具栏比 Plane 少表格、图片和 AI summary |
| Wiki 首页与页面 | partial | M4 | partial | `/{ws}/wiki/` 列出工作区页面并可编辑。没有 Collections |
| 评论与 @提及 | implemented | M4 | pass | CLONE-1 上有 Grace 的评论，并提及 Ada，收件箱能看到 |
| 通知 Inbox：All / Mentions | implemented | M4 | pass | `/{ws}/notifications/`。可全部标为已读 |

## 视图、搜索、开发者（M5）

| 能力 | 状态 | 里程碑 | Verified | 说明 |
| --- | --- | --- | --- | --- |
| 保存的视图，公开标记，收藏 | implemented | M5 | pass | 创建框：标题、描述、Public/Private、布局。列表显示 Public 和 Favorited |
| 视图详情 `/{ws}/projects/{id}/views/{viewId}/` | implemented | M5 | partial | 高优先级视图只留下 High 工作项，布局和 Share 都在。过滤条不是 “Priority is High” 芯片 |
| 工作区 All work items | implemented | M5 | pass | `/{ws}/workspace-views/all-issues/` |
| 全局搜索 | implemented | M5 | pass | 工作项标题和描述、项目、周期、模块、页面 |
| 导入 / 导出 JSON | implemented | M5 | pass | `/{ws}/settings/exports/` 与 `/{ws}/settings/imports/`。形状是项目、状态、标签、工作项。只有管理员能导入 |
| Webhooks 列表和创建表单 | implemented | M5 | pass | 标题、Payload URL、V1 范围和 V2 的 created/updated/archived/deleted。V2 是一组动作，作用在所有选中的 V1 范围上，不是每个资源一套子勾选。投递带 `X-Ordr-Signature` |
| Personal access tokens | implemented | M5 | pass | Title、Description、过期日期或 Never expires，然后 Generate token。`Authorization: Bearer` 只对该工作区有效 |

## 明确不实现

账务、SSO、Identity、Workspace Governance、Teamspaces、Initiatives、Customers、Templates、Integrations、Releases、Epics、Work item types、Workflows、Automations、Recurring work items、Milestones、Time tracking / worklogs、Estimates 的完整体系（只有点数和 T-shirt）、Plane AI、Try 推广位（GitHub / Slack）、关系类型里的 Implements / Starts before / Finishes after。这些行的 Verified 都是 `n/a`。
