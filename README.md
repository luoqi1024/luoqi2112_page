# luoqi2112_page

这是一个个人导航页，也是我的静态主页。

项目用原生 `HTML + CSS + JavaScript` 写成，没有框架，没有打包步骤，打开结构就能看明白。页面主要放常用链接、搜索入口、待办事项和摄影内容，顺手做了壁纸轮播和抽屉式二级面板。

## 现在包含的内容

- 个人信息卡和常用账号入口
- 搜索框，支持 Google、Bing、DuckDuckGo 和站内搜索
- 书签分类，首页显示常用项，完整内容放在抽屉里
- Todo，小东西，但够用，数据存在浏览器 `localStorage`
- 壁纸轮播，支持图片和视频
- 摄影模块，首页随机展示几张，点开可以继续看

## 本地预览

不要直接双击 `index.html`。

页面启动时会读取 `data/config.json`，如果直接用文件方式打开，浏览器大概率会因为本地安全策略把 `fetch` 拦掉。起一个静态服务器就行，比如：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

如果你用 VS Code，直接开 Live Server 也可以。

## 主要配置

页面实际读取的是 [data/config.json](/d:/dev/gihub%20code/luoqi2112_page/data/config.json)。

常改的部分基本都在这里：

- `site`：站点标题、副标题、主页链接、GitHub 链接
- `profile`：昵称、简介、头像、兴趣标签
- `wallpapers`：壁纸轮播配置，支持图片和视频
- `search`：搜索引擎列表和默认搜索引擎
- `profiles`：账号入口
- `bookmarks`：常用书签和分类书签
- `todos`：Todo 展示数量之类的小设置
- `photos`：精选图片和相册内容
- `extras`：时钟、最近访问等开关

## 目录结构

```text
.
├── index.html                # 页面入口
├── styles.css                # 全站样式
├── data/
│   └── config.json           # 页面主配置
├── scripts/
│   ├── main.js               # 启动入口
│   ├── render.js             # 页面渲染
│   ├── wallpaper.js          # 壁纸轮播
│   ├── bookmarks.js          # 书签逻辑
│   ├── todo.js               # Todo 逻辑
│   ├── photos.js             # 摄影模块
│   ├── drawer.js             # 抽屉面板
│   ├── siteSearch.js         # 站内搜索
│   └── storage.js            # 本地存储
├── assets/
│   ├── touxiang.jpg          # 头像
│   ├── photos/               # 摄影图片
│   └── wallpapers/           # 壁纸和视频
└── .github/workflows/
    └── deploy.yml            # GitHub Actions 部署脚本
```

## 部署

仓库里已经有 [deploy.yml](/d:/dev/gihub%20code/luoqi2112_page/.github/workflows/deploy.yml)，当前配置是：

- 只有 `main` 分支收到 `push` 时才会触发
- 通过 `appleboy/scp-action` 走 SSH 上传文件
- 目标目录是 `/opt/1panel/www/sites/luoqi2112.com/index`

如果要让这套流程真的跑起来，需要在 GitHub 仓库里配好这些 Secrets：

- `SERVER_IP`
- `SERVER_USER`
- `SERVER_SSH_KEY`

## 备注

- 当前页面读的是 `data/config.json`
- 根目录的 `site-config.json` 不是当前入口在用的主配置文件
