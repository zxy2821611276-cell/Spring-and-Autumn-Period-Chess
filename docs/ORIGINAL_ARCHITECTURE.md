<!-- Historical reference for ORIGINAL Cloudflare deployment, not this Netlify port. -->
# 技术结构检查与香港服务器迁移评估

## 检查范围

检查对象为工作区完整 Git 源码，提交 cc9de3b5e674550f0f8de79cb93c8ebfd2629b2f。线上 Sites 元数据确认当前最新版本为1，公开访问。未读取生产棋局内容，也未执行任何部署或购买操作。

## 当前结构

| 层次 | 实际实现 | 主要文件 |
|---|---|---|
| 前端 | React 19.2.6、TypeScript、客户端状态与 CSS 响应式布局 | app/page.tsx、app/globals.css |
| 框架 | Vinext 1.0.0-beta.5、Vite 8.0.13；采用 Next App Router 文件约定，依赖 next 16.3.4，但当前构建不是普通 next build | package.json、vite.config.ts |
| 后端 | Cloudflare Worker 中的 GET/POST /api/room | app/api/room/route.ts、build/sites-worker.ts |
| 规则引擎 | 纯 TypeScript，服务端执行权威判断，前端复用合法目标提示 | lib/game.ts |
| 数据库 | Cloudflare D1，运行时 env.DB，直接 prepared SQL | app/api/room/route.ts |
| 数据库工具 | Drizzle ORM 0.45.2 / drizzle-kit 0.31.10；schema 与迁移存在，但实际房间接口未调用 getDb() ORM 辅助函数 | db/、drizzle/ |
| 通信 | 同源 HTTPS fetch；GET轮询、POST动作，无 WebSocket、SSE、Socket.IO、Redis、Durable Objects | app/page.tsx |
| 身份 | 随机 HttpOnly Cookie，服务端存 SHA-256 哈希；不要求 ChatGPT登录 | app/api/room/route.ts |
| 资源 | CSS中文棋子、本地 SVG，另有 Google Fonts 外链 | public/、app/globals.css |

## 房间与同步

创建房间生成8位大写十六进制房间码。房间有两个玩家席位；GET读取者未占席时为观战者，不能提交棋局操作。猜拳先存各方选择，双方提交前公开响应只有提交与否，不公开手势；玩家身份哈希、撤销快照和请求去重表也不在公开响应中返回。

可见页面每1500毫秒 GET 一次完整公共状态；页面在后台时不轮询，回前台或 online 事件触发读取。POST提交创建、入座、猜拳、选边、移动、认输、协商请求、接受或拒绝。网络失败由后续读取恢复，不存在服务器推送。观众与玩家共用轮询机制。界面的“已连接”表示最近读取成功，并不证明对手在线；未实现对手心跳、在线人数或观众名单。

服务端读取房间状态后验证动作，再执行：

```sql
UPDATE rooms SET data=?, revision=revision+1 WHERE id=? AND revision=?;
```

以旧 revision 为条件，仅一个竞争更新能成功。失败返回409，客户端重读。POST动作使用 requestId，房间最近100个请求ID用于去重；过期旧请求仍受 revision 校验。创建房间和入座不走同一去重分支，不能宣称创建接口具备完整重试幂等性。房间码碰撞没有自动重试，但主键约束避免覆盖。

每次完整行动前保存 Game 快照，双方同意悔棋后恢复。房间 data 内同时保存棋盘、分数、行动权、易位标志、过路兵资格、特殊技能、猜拳、历史和协商请求。当前没有房间过期清理、历史上限、限流或完备抗滥用机制。长局历史随整行 JSON 增长，迁移时应保留功能并另行评估容量。

## 数据库结构

```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL
);
```

`data` 是序列化 Room：players（身份哈希及称呼）、phase、target、hands、rps、winner（猜拳胜者）、white、game、history、request、seen。Game 结构见 lib/game.ts。created_at 是创建时毫秒时间戳，未做TTL。没有单独用户表、聊天表或棋谱表。

## Sites 与 Cloudflare 依赖的区分

| 依赖 | 当前用途 | 迁移处理 |
|---|---|---|
| Sites项目清单 .openai/hosting.json | 项目ID、DB绑定声明、平台部署识别 | VPS无需项目ID，保留模板作来源记录 |
| Sites构建插件 | 打包清单、开发环境模拟登录等 | Node迁移时移除或替换平台构建接入 |
| build/sites-worker.ts | Worker入口及可选连接器请求上下文 | 改为目标服务器的入口/框架运行方式 |
| cloudflare:workers / env.DB | 房间API真实运行依赖 | 必须改为本地数据库访问，或继续使用对应Worker环境 |
| D1自动配置及迁移 | Sites负责创建绑定、部署时迁移 | 自管服务器自行初始化SQLite并备份 |
| ChatGPT域名、HTTPS和平台访问控制 | 原站访问与托管 | 换自有域名、TLS和反向代理 |
| app/chatgpt-auth.ts | 模板登录辅助，游戏页面和API未调用 | 不需要实现ChatGPT登录，可在后续清理 |
| lib/connectors*、connector-preview* | 模板连接器和预览支持，游戏未使用外部连接器 | 可在迁移时移除，无游戏功能损失 |
| R2 / BUCKET | manifest中为null，没有使用 | 无需迁移对象存储 |
| OpenAI API / 模型调用 | 没有 | 无API额度或密钥依赖 |

Sites后端服务本身不在源码包中，但应用侧构建插件及其许可证已包含。这个包完整保留应用源码，不意味着能复制托管平台内部服务。

## 香港轻量服务器可行性

结论：适合迁移，已有游戏规则和界面无需重新开发。主要是服务器运行方式与数据库适配。香港位置本身不能保证所有大陆网络的可达性或速度，需在购买前或试用时从实际使用网络验证域名、线路和HTTPS；本报告不推荐具体供应商或规格，不做容量保证。

建议后续保持单机同源结构：浏览器访问香港服务器的HTTPS域名，反向代理转到Node应用，房间数据用服务器本地SQLite。继续1.5秒轮询即可，不必为迁移引入WebSocket。小规模好友场景优先保留这套逻辑。每个活跃可见客户端约每秒0.67次查询，20个约每秒13.3次；这仅是请求量估算，不是机器性能承诺。

必须修改/配置的部分：

1. `app/api/room/route.ts`：替换 cloudflare:workers 导入和 D1 prepare/bind/first/run 接口。SQL与JSON数据结构可保留。保持 revision条件更新、受影响行数判断、请求去重和原子结算。可封装薄适配层，避免重写业务。
2. `db/index.ts`：若保留此模块，改用SQLite对应驱动或从目标构建中排除未使用的D1 helper。schema SQL可复用。
3. `vite.config.ts`、`build/sites-worker.ts`、`package.json`运行脚本：从Cloudflare Worker目标改为Node目标。可评估保留当前版本Vinext的Node运行方式，也可换标准Next构建，但都需要适配并测试，不能把最新Vinext文档的新版本配置直接套到本项目锁定的beta版本。本次未实现任何一种。
4. `app/globals.css`：移除Google Fonts外链改用已有系统字体，或把有合法授权的字体托管到本机。当前无其他必须访问外部服务的游戏资源。
5. 服务器配置：HTTPS、域名、反向代理、进程管理、数据库文件权限与持久目录、备份。反向代理必须正确处理Host/协议，让当前POST Origin比较正常通过，并禁止缓存 `/api/room`。
6. 玩家Cookie的Secure/HttpOnly/SameSite策略应保留。换域名后旧Cookie不会随数据转移。若要保留旧房间与原席位，需要另设计一次性身份迁移流程；从新房间开始则无需此项。

可原样保留：`lib/game.ts`全部游戏规则；前端布局、操作与提示；猜拳和选边逻辑；房间接口协议；积分、连动、特殊行动、悔棋、和棋、认输、观战和轮询机制。

可验证的新部署验收顺序：空库初始化；两个独立浏览器入座；猜拳保密；不同网络走棋；观战无写权限；重复/并发动作；刷新恢复；吃过路兵/升变/特殊行动；悔棋恢复；HTTPS代理Origin校验；服务器重启数据保留。

不要使用 `pnpm start`（当前其实启动 wrangler dev）作为香港生产部署方案，也不要只上传 public 或 dist/client。后端和数据库是远程对弈必需部分。

## 数据与导出边界

此次导出没有生产D1快照，不带原房间与历史。没有复制玩家浏览器Cookie。没有下载字体文件。原文档和图片不参与程序运行。完整依赖下载由锁文件描述，但不附带安装好的依赖或环境二进制，因此需要可访问包仓库的安装环境。

## 外部核验资料

检索于2026-10-12，仅用于确认平台的一般结构，不替代锁定版本实测。

- Cloudflare官方Vinext仓库 https://github.com/cloudflare/vinext
- Cloudflare D1文档 https://developers.cloudflare.com/d1/get-started/
- Cloudflare数据库概览 https://developers.cloudflare.com/workers/databases/connecting-to-databases/

本报告中具体文件、版本、轮询周期与功能结论均来自此次项目源码。
