# Ordr

Ordr 是一个可自托管的工作管理应用。信息架构参考了 [Plane](https://github.com/makeplane/plane) 的公开产品（工作区、项目、工作项、周期、模块、页面），代码是从头写的，没有复制 Plane 的 AGPL 源码。视觉也是自己的。

## 为什么是 NestJS

后端用 TypeScript 的 NestJS，而不是 Django / DRF：

- 和 Next.js 前端共用 `@ordr/shared` 里的角色、优先级、状态分组和 slug 规则。
- 模块边界可以按工作区、项目、工作项、周期、页面、通知拆开，和领域一一对应。
- Prisma migration 按里程碑追加，评审时能看见表结构。
- 页面协作（Yjs + Socket.IO）和 Webhook 投递可以留在同一个 Node 进程里，Redis 负责登录限流和以后的多实例广播。

前端是 Next.js（App Router）+ React。浏览器只访问同源的 `/api/*`，由 Next 路由转发到 API，会话 cookie 因此不需要跨站。

## 架构

```
apps/web      Next.js 界面
apps/api      NestJS + Prisma
packages/shared   枚举与 slug 规则
Postgres      主数据
Redis         登录计数，后续的协作广播
```

认证是邮箱 + 密码。访问 JWT（15 分钟）和刷新 JWT（30 天，轮换，只存哈希）都放在 httpOnly cookie 里。工作区 URL 是 `/{slug}`。角色是 Admin、Member、Guest；创建者额外标记为 Owner。邀请不发邮件，API 返回链接并写入日志，接受时登录邮箱必须和邀请一致。

完整表结构在 [docs/schema.md](docs/schema.md)。和 Plane 界面的对照在 [docs/parity.md](docs/parity.md)。

## 本地启动

需要 Docker。

```bash
cp .env.example .env
docker compose up --build
```

- 界面：http://localhost:3000
- API：http://localhost:4000/api/v1/health

注册后创建工作区，在 **Settings → Members** 里邀请。页面上会给出 `http://localhost:3000/invite/...`。

只想跑依赖、自己起应用：

```bash
docker compose up postgres redis
pnpm install
pnpm db:migrate
pnpm dev
```

`pnpm dev` 会编译 shared，然后同时启动 API（4000）和 Web（3000）。API 读仓库根目录或 `apps/api` 的环境变量；也可以直接导出：

```bash
export DATABASE_URL=postgresql://ordr:ordr@localhost:5432/ordr
export REDIS_URL=redis://localhost:6379
export JWT_ACCESS_SECRET=dev-access-secret-change-me
export JWT_REFRESH_SECRET=dev-refresh-secret-change-me
export APP_URL=http://localhost:3000
```

测试使用数据库 `ordr_test`（`docker/init.sql` 会在第一次初始化数据卷时创建）。

```bash
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

已经有 `docker compose` 占着 3000 端口时，用 `E2E_NO_SERVER=1 pnpm test:e2e`。

## 里程碑

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M1 | 单体仓库、认证、工作区、成员邀请、外壳、CI | 已完成 |
| M2 | 项目与工作项：状态、优先级、标签、负责人、子工作项、关系、活动、列表、看板、日历、表格、甘特、Intake | 已完成 |
| M3 | 周期（日期、进度、燃尽）和模块 | 已完成 |
| M4 | 协作页面（Tiptap / Yjs）、评论、@提及、通知 | 已完成 |
| M5 | 保存的视图与筛选、搜索、导入导出、API token、Webhook | 本版本 |

每个里程碑都会更新 `docs/parity.md`。账务、SSO、AI、集成、工作流、工时不在范围内。

## 测试

- `apps/api/test`：认证、工作区、邀请、工作项、周期、页面、视图、令牌和 Webhook。
- `e2e/`：注册与邀请、项目与工作项、周期、页面评论、保存视图和搜索。
- GitHub Actions（`.github/workflows/ci.yml`）跑 lint、API 测试和 Playwright。
