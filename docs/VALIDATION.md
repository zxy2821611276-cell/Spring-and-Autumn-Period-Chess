# 迁移检查和验证边界（2026-10-12）

| 项目 | 状态 | 说明 |
|---|---|---|
| 游戏规则引擎 | 未修改，模拟测试通过 | 与原压缩包 `lib/game.ts` 同字节，10 项规则测试通过 |
| 客户端页面/联机 UI | 保留 | `app/page.tsx` 未修改 |
| CSS | 保留风格，移除外部字体请求 | 大陆访问字体不再依赖 Google Fonts |
| D1 迁移 PostgreSQL | 源码完成 | `db/rooms.ts` 使用 Netlify Database 参数化 SQL |
| 房间数据结构 | 保留 | 表内仍是原序列化 Room，revision 保留 |
| 原子更新 | 模拟测试通过 | `UPDATE ... WHERE revision=? RETURNING revision`，2 个并发请求只有一个成功 |
| 房间流程 | 模拟测试通过 | 3 项服务/数据库测试（包括 RPS、观战、悔棋和同步） |
| SQL 迁移 | 文件已生成 | 在 Netlify 数据库执行前尚无法验证 |
| npm install / Next build | **未验证** | 当前沙箱 DNS 无法访问 npm registry |
| 实际 Netlify 自动创建数据库 | **未验证** | 需要登录用户 Netlify 信用计费账号首次部署 |
| HTTPS 真实双浏览器联机 | **未验证** | 需要正式部署后测试 |
| 中国大陆访问 | **未验证** | Netlify 子域名受地域和线路限制 |

不包含旧 D1 的生产数据、真实密钥、旧浏览器 Cookie。使用 Netlify Database 会消耗平台额度。项目尚无流量限制或房间清理策略，适合小范围测试。若首次真实构建失败，以构建日志为准进行修复，不应宣称已经上线成功。
