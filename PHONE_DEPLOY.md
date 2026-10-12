# 安卓手机部署春秋象棋 · 一步一步操作

说明：以下步骤面向从 ChatGPT 下载 ZIP、且只有安卓手机、已经能登录 Netlify 的用户。无需在手机安装 Node.js 或 Git；GitHub Codespaces 是网页中的临时云端编辑器。**仅上传 ZIP 到 Netlify 的 Deploys 页面不能得到可用的联机游戏**。

## 第一段：下载与准备

1. 从 ChatGPT 下载 **`chunqiu-chess-netlify.zip`**，保存到手机“下载”文件夹。
2. 在 Chrome 登录 https://github.com ，没有账号则先注册。打开 https://github.com/new 。
3. Repository name 填 `chunqiu-chess`；Visibility 建议先选 **Private**；勾选“Add a README file”，点“Create repository”。
4. 如果手机网页按钮显示不全：Chrome 右上角 ⋮，开启“桌面版网站”，必要时横屏。

## 第二段：手机把 ZIP 解压进 GitHub 仓库

1. 进入刚创建的 GitHub 仓库。
2. 点击 **Code > Codespaces > Create codespace on main**。GitHub 会打开类似 VS Code 的网页编辑器。（Codespaces 自身有使用额度，关闭不用时应停止 Codespace。）
3. 在编辑器左侧 Explorer 文件区点击根文件夹旁菜单，选择 **Upload...**；或者把手机 ZIP 上传到当前根目录。文件名应该是 `chunqiu-chess-netlify.zip`。
4. 在编辑器菜单选择 **Terminal > New Terminal**。复制并运行下面第一组命令：

```bash
unzip -o chunqiu-chess-netlify.zip -d .
rm chunqiu-chess-netlify.zip
ls
```

确认输出的项目根目录中有 `package.json`、`app`、`db`、`lib`、`netlify` 和 `netlify.toml`，而不是只有一个名叫 `chunqiu-chess-netlify` 的子目录。本 ZIP 的结构经过处理，直接解压到根目录即可。

5. **推荐先在 Codespaces 云端验证**，这组命令会连接 npm 下载依赖，耗时取决于网络，不消耗手机本地存储。

```bash
npm install
npm test
npm run typecheck
npm run build
```

如果出现依赖下载或编译报错，记录 **第一条实际 ERROR**，不要直接跳过当作已经成功。因为导出 ZIP 的环境不能联网 npm，此处是第一次真正验证构建的机会。

6. 若验证成功，运行以下命令提交全部源码和安装生成的 `package-lock.json`：

```bash
git add .
git commit -m "Port Chunqiu Chess to Netlify"
git push origin main
```

7. 返回 GitHub 仓库网址刷新页面。应该看到 `package.json`、`netlify.toml`、`app/`、`db/`、`netlify/`；不要只看到一个 ZIP。

## 第三段：Netlify 导入仓库并发布

1. 打开你的 https://app.netlify.com/teams/zxy2821611276/projects 。
2. 点击 **Add new project**，选择 **Import an existing project**。
3. 选择 **GitHub**，按网站提示授权（如果没有看到 `chunqiu-chess`，检查 GitHub App 是否授权访问 Private 仓库）。
4. 选中 `chunqiu-chess`，分支选 `main`。
5. Framework 应识别为 **Next.js**。Build command 使用 `npm run build`。Publish directory 使用 `.next`（仓库里也有 `netlify.toml`）。不要使用 Vite、Wrangler 或纯静态拖拽部署模式。
6. 点击 **Deploy**。
7. Netlify 在安装依赖时识别 `@netlify/database`，应创建托管 PostgreSQL 并执行 `0001_create_rooms.sql`。Netlify Database 只在支持它的 Credit-based 方案中可用，并消耗相关额度。如果控制台提示不可用，先看 Netlify **Data & Storage > Database**、当前计费方案和 Deploy log。
8. 看到 **Published** 后，点击站点分配的 HTTPS 网址打开。

## 第四段：两部手机验收

1. 在手机 A 打开新 Netlify HTTPS 链接，填写称呼，创建房间，记录 8 位房间码。
2. 用**另一个浏览器配置或另一部手机** B 打开同站点，输入房间码加入。不要在同一浏览器里用两个标签模拟两个玩家，因为它们会共享 Cookie。
3. 验证猜拳提交前不泄露手势、双方交替走棋、黑方特殊行动、悔棋、重新匹配，以及刷新网页后棋局恢复。
4. 最后请位于中国大陆的玩家不用 VPN、使用普通移动数据网络打开网址。大陆能否访问 Netlify 的域名必须以这次实际测试为准，部署成功本身不能保证可达。

## 常见错误

- **部署时提示 `Module not found` 或 `npm install` 失败**：看第一条红色错误，将完整构建日志发给 ChatGPT。此 ZIP **尚未经过真实 Netlify build 验证**。
- **网站能打开，但创建房间报 500 或连接失败**：检查 Netlify Deploy log 是否显示数据库 provisioning/migrations 成功，再查看 Functions 日志。数据库没有初始化是常见原因。
- **403 请求来源无效**：检查访问地址是否是正确的 Netlify HTTPS 站点；若发生于自定义域名或代理访问，检查 URL/Origin 是否保持一致。
- **404 `/api/room`**：检查 Netlify 是否识别 Next.js 而非纯静态网页；不要添加 `/* /index.html 200`。
- **中国大陆打不开 `netlify.app`**：这不是棋局逻辑错误。可能需要独立域名或迁移香港服务器，先记录电信/移动/联通网络的访问结果。
- **老房间不存在**：新站数据库是空的；旧生产 D1 数据未包含在源码内。

参考 https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/ 和 https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/。
