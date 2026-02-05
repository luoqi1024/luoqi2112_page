# Start Page（个人导航）

这是一个纯原生 HTML/CSS/JS 的 GitHub Pages 静态主页（无 React/Next/Vite、无需构建）。
所有内容由 `data/config.json` 驱动。

## 使用

- 直接打开 `index.html`（双击）即可运行。
- 部署到 GitHub Pages：把仓库设置为 Pages 源即可。

> 说明：若你在某些浏览器里直接双击打开 `index.html` 时遇到 `fetch` 读取本地文件被拦截（file:// CORS），请用任意静态服务器预览（例如 VS Code Live Server）。GitHub Pages 线上访问不受影响。

## 替换头像

头像来源是 `data/config.json` 的 `profile.avatarSrc`。

- 默认指向：`assets/avatar.jpg`
- 你可以：
  1. 直接替换 `assets/avatar.jpg` 文件（保持文件名不变）；或
  2. 把 `profile.avatarSrc` 改成你新图片的相对路径（例如 `assets/me.png`）。

如果头像文件不存在或加载失败，页面会显示一个默认圆角占位（不会出现破图）。

## 替换壁纸

1. 把图片放到：`assets/wallpapers/`
2. 在 `data/config.json` 的 `wallpapers.images` 里把 `src` 改成相对路径，例如：
   - `assets/wallpapers/wall1.jpg`

## 修改账号与收藏

- 账号入口：修改 `data/config.json` 的 `profiles`。
- 分类收藏：修改 `data/config.json` 的 `collections`。
  - 每个分类都有 `title/icon/items[]`。
  - `items.tags` 会显示成标签。

## 功能概览

- 背景壁纸轮换（淡入淡出、上一张/下一张/暂停、记住最后一张、预加载下一张）
- 顶部搜索（可切换引擎，Enter 跳转）
- 站内搜索：搜索引擎选择「站内」，结果会在当前页面弹窗显示（支持 Accounts/Bookmarks/Photography/TODO，本地 TODO 从 localStorage 搜索）
- Profiles 账号卡片区（新标签打开，支持 mailto）
- Collections 分类书签（可折叠/展开）
- Extras：时钟、Todo（本地保存）、Recent（点击外链自动记录）

## 目录结构

- `index.html` 页面骨架
- `styles.css` 深色极简科技风样式
- `data/config.json` 配置
- `scripts/main.js` 入口
- `scripts/wallpaper.js` 壁纸轮换
- `scripts/render.js` 渲染器
- `scripts/storage.js` localStorage 工具

## 自测清单（建议）

- 昵称显示是否都变为「珞祈」（个人卡片、页面标题、页脚文字等）。
- 头像：删除/改名 `assets/avatar.jpg`，刷新后应显示占位，不破图；再放回图片应恢复正常。
- 搜索：下拉中出现「站内」。
- 站内搜索：
  - 搜索 `GitHub`：应在 Accounts 或 Bookmarks 中出现结果。
  - 搜索 `设计`：应命中 Bookmarks（如 Figma/Canva）或相关标签。
  - 搜索 `Sample 01`：应命中 Photography（如果你有放照片/配置里有 Sample 01）。
  - 先添加一条 TODO（比如 `测试todo`），再用站内搜索搜它，应命中 TODO 组并可在弹窗里点击「完成/恢复」。
