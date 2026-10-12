# 春秋象棋 · Netlify 适配源码

这是一份从《春秋象棋》ChatGPT Sites / Cloudflare Worker 版源码移植的 **Netlify 部署候选版本**。它保留了 `lib/game.ts` 的原始规则算法、`app/page.tsx` 的界面与客户端轮询协议，没有引入 WebSocket。

**状态声明（2026-10-12）**：已经完成源码迁移，运行 13 项本地模拟测试，全部通过。当前执行环境无法访问 npm 软件包仓库，因此 **尚未完成实际依赖安装、Next.js 构建、Netlify 部署或真实 PostgreSQL 联机实测**。不能将本文件包视为已经线上验收的产品；首次部署是必需的验证步骤。

## 技术结构

- 前端：Next.js 16 / React 19（App Router），仍然使用原来的 CSS、棋盘、交互和素材。
- 服务端：Next.js Route Handler `GET /api/room`、`POST /api/room`，交给 Netlify 自动识别的 Next.js adapter 执行。
- 数据库：Netlify Database（托管 PostgreSQL），`@netlify/database` 提供参数化 SQL 客户端。
- 数据库结构：`netlify/database/migrations/0001_create_rooms.sql`，Netlify 首次部署自动应用。
- 实时性：客户端每 1.5 秒 GET 轮询，POST 执行行动。仍然保留修订版本检查和请求去重。
- 身份：服务端生成 HttpOnly + Secure Cookie，无需 ChatGPT 登录。

## 文件

- `app/page.tsx`：原前端，未改变。
- `app/globals.css`：原界面 CSS，仅删除 Google Fonts 外部请求，使用系统中文字体回退。
- `app/api/room/route.ts`：在原游戏接口基础上，将 D1 调用替换为独立的仓储接口。
- `db/rooms.ts`：新的 PostgreSQL 存储适配层。
- `lib/game.ts`：与原导出源码字节一致的完整规则引擎。
- `netlify.toml`：Netlify build 设置。
- `netlify/database/migrations/0001_create_rooms.sql`：建表迁移。
- `tests/*.test.mjs`：规则、房间流程和仓储模拟测试。
- `PHONE_DEPLOY.md`：安卓手机从 ZIP 到 GitHub、Netlify 的完整操作说明。
- `docs/ORIGINAL_ARCHITECTURE.md`：原始 ChatGPT Sites 架构记录，**不是** 本适配版的运行说明。

## 在可联网的 Node.js 22 环境运行

```bash
npm install
npm test
npm run typecheck
npm run build
```

`npm run dev` 只启动 Next.js，不会自动创建 Netlify Database。本地进行完整 API/数据库联调时，需安装较新版本的 Netlify CLI 并用 `netlify dev` 启动本地数据库，或按 Netlify 文档配置自己的 PostgreSQL 数据库。你无需在安卓手机本地执行这些命令，手机上传仓库后交给 Netlify 的构建环境完成。

## Netlify 部署要求

1. **通过 GitHub 仓库导入**，让 Netlify 识别 Next.js，不能仅用静态文件拖拽上传。
2. Build command 为 `npm run build`，Publish directory 为 `.next`，均写在 `netlify.toml` 中。不要配置 `/* /index.html 200` 之类的单页应用重写规则，否则可能截获 `/api/room`。
3. 允许 Netlify Database 自动配置，数据库迁移目录必须随源码上传。使用它需要支持 Netlify Database 的 **Credit-based plan**，并会产生相应平台额度消耗。
4. Netlify 颁发的 `https://xxx.netlify.app` 域名可用于第一轮验证。但对中国大陆的访问不作保证，必须用大陆移动网络进行实测。
5. 原 ChatGPT Sites 的 **生产 D1 房间数据没有包含在源码 ZIP 内**。新站首次创建的是空数据库；旧房间码和浏览器 Cookie 不会迁移。

## 安全及并发约束

- 原 GET 和 POST 采用 no-store，房间写操作使用 `WHERE revision = expected` 和 `RETURNING` 保护并发更新。
- 查询全部经 `@netlify/database` 模板参数化，不拼接玩家输入。
- 发布前至少让两个独立浏览器分别验证创建、加入、猜拳、走棋、观战、并发、悔棋和刷新恢复。
- 仅适合有限规模的朋友测试，没有完善的房间 TTL、容量配额、速率限制或历史裁剪机制；不要直接作为大规模公开服务。

官方资料：

- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/
- https://docs.netlify.com/build/data-and-storage/netlify-database/api/
- https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/
