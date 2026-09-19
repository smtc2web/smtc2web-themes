# smtc2web-themes

[smtc2web](https://smtc2web.org) 主题商店（https://themes.smtc2web.org）：浏览、搜索、下载社区主题；使用 GitHub 账号登录后可上传并管理自己的主题。

## 功能

- 公开目录：搜索、标签筛选、按更新/下载/名称排序
- 主题详情：预览图、描述、标签、版本历史、下载
- GitHub 登录：上传 ZIP、发布新版本、下架 / 恢复 / 删除自己的主题
- 自动发布：主题仓库接入 [`smtc2web/theme-upload`](https://github.com/smtc2web/theme-upload) 工作流后，推送 `v*` tag 即可自动发布（OIDC 认证，无需任何 secret）
- 公开 JSON API：供 smtc2web v0.7.0 及第三方接入

主题 ZIP 要求：压缩包内恰好一个根文件夹，根文件夹中包含 `theme.toml` 且带 `[smtc2web.theme]` 配置节。

## 开发

```sh
pnpm install
pnpm db:migrate:local   # 首次运行时初始化本地 D1
pnpm dev
```

本地开发需要在 `.dev.vars` 中配置（可从 `.dev.vars.example` 复制）：

```
GITHUB_CLIENT_ID=你的 dev OAuth App Client ID
GITHUB_CLIENT_SECRET=你的 dev OAuth App Client Secret
SESSION_SECRET=任意随机字符串
```

常用命令：

```sh
pnpm type-check   # 类型检查（app / node / worker 三个 TS 项目）
pnpm test         # 主题包校验单测（node --test）
pnpm build        # 类型检查 + 构建
pnpm deploy       # 构建并部署到 Cloudflare Workers
pnpm cf-typegen   # 修改 wrangler.jsonc 绑定后重新生成类型
```

## GitHub OAuth App

在 GitHub → Settings → Developer settings → OAuth Apps 创建：

- 生产：Homepage `https://themes.smtc2web.org`，Callback `https://themes.smtc2web.org/api/auth/github/callback`
- 开发：Callback `http://localhost:5173/api/auth/github/callback`

然后配置生产环境（Client ID 写入 `wrangler.jsonc` 的 `vars`）：

```sh
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm exec wrangler secret put SESSION_SECRET
pnpm deploy
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/themes?q=&tag=&sort=&page=` | 主题列表（`sort`: `newest` / `popular` / `name`） |
| GET | `/api/themes/:slug` | 主题详情与版本历史 |
| GET | `/api/themes/:slug/screenshot` | 最新版本截图 |
| GET | `/api/themes/:slug/download?version=` | 下载 ZIP（未指定 version 时为最新版） |
| GET | `/api/tags` | 标签及数量 |
| GET | `/api/me` | 当前登录用户 |
| GET | `/api/me/themes` | 自己发布的主题（含已下架） |
| POST | `/api/themes` | 网页上传 ZIP（multipart：`file`、可选 `slug`） |
| PATCH | `/api/themes/:slug` | 修改状态：`{"status":"hidden"｜"published"}` |
| DELETE | `/api/themes/:slug` | 删除主题及其全部版本 |
| POST | `/api/actions/publish` | GitHub Actions OIDC 自动发布（`Authorization: Bearer <JWT>`） |
