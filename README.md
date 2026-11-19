# luoqi2112_page

这是一个个人导航页，也是我的静态主页。

项目用原生 `HTML + CSS + JavaScript` 写成，没有框架，没有打包步骤，打开结构就能看明白。页面主要放常用链接、搜索入口、待办事项和摄影内容，顺手做了壁纸轮播和抽屉式二级面板。

## 现在包含的内容

- 个人信息卡和常用账号入口
- 搜索框，支持 Google、Bing、DuckDuckGo 和站内搜索
- 书签分类，首页显示常用项，完整内容放在抽屉里
- Todo，小东西，但够用，数据存在浏览器 `localStorage`
- 壁纸轮播，支持图片和视频
- 摄影志首页封面、`photos/` 摄影档案与地图，以及 `photos/stories/` 摄影故事
- `moments/` 片刻馆，包含影厅、阅读室、诗歌室、唱片室、片语室和全馆藏索引
- 桌面模式（`desktop.js`），支持浮窗与组件布局，并记住布局选择
- 天气组件（`weather.js`），显示天气与温度，支持定位和本地缓存
- 音乐组件（`music.js`），播放配置中的曲目，支持切歌、进度控制和曲目记忆
- 资源维护工具：统一版本号、生成壁纸清单与摄影地图、添加照片签名水印

## 本地预览

不要直接双击 `index.html`。

页面启动时会读取 `data/config.json`，如果直接用文件方式打开，浏览器大概率会因为本地安全策略把 `fetch` 拦掉。起一个静态服务器就行，比如：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

如果你用 VS Code，直接开 Live Server 也可以。

## 主要配置

页面实际读取的是 [`data/config.json`](data/config.json)。

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
├── photos.css                # 摄影档案样式
├── .asset-version            # 当前静态资源版本号
├── WW_verify_KrgMR2fgJJbMnfNW.txt
│                             # 微信域名归属验证文件
├── data/
│   ├── config.json           # 页面主配置
│   ├── moments-*.json        # 片刻馆各展室内容
│   └── china-provinces.geojson # 摄影地图省级边界
├── moments/                 # 片刻馆序厅
│   ├── cinema/              # 影厅
│   ├── reading/             # 阅读室
│   ├── poetry/              # 诗歌室
│   ├── records/             # 唱片室
│   ├── fragments/           # 片语室
│   └── archive/             # 全馆藏索引
├── photos/
│   ├── index.html           # 摄影档案与地图
│   └── stories/             # 按旅程组织的摄影故事
├── scripts/
│   ├── main.js               # 启动入口
│   ├── render.js             # 页面渲染
│   ├── wallpaper.js          # 壁纸轮播
│   ├── bookmarks.js          # 书签逻辑
│   ├── todo.js               # Todo 逻辑
│   ├── photos.js             # 摄影模块
│   ├── photos-page.js        # 摄影档案页面交互
│   ├── moments-*.js          # 片刻馆展室、索引与导览交互
│   ├── desktop.js            # 桌面模式切换及布局管理
│   ├── weather.js            # 天气查询、定位与缓存
│   ├── music.js              # 桌面音乐播放及进度控制
│   ├── drawer.js             # 抽屉面板
│   ├── siteSearch.js         # 站内搜索
│   ├── storage.js            # 本地存储
│   ├── update_asset_version.py # 更新或检查静态资源查询版本号
│   ├── gen_wallpaper_manifest.py # 扫描壁纸、视频和 poster，生成 manifest.json
│   ├── gen_photo_atlas_map.py # 获取并简化省级边界，生成摄影地图 GeoJSON
│   └── add_photo_watermarks.ps1 # 使用 ffmpeg/ffprobe 为照片添加签名并导出 WebP
├── assets/
│   ├── touxiang.jpg          # 头像
│   ├── photos/               # 摄影图片
│   └── wallpapers/           # 壁纸和视频
└── .github/workflows/
    └── deploy.yml            # GitHub Actions 部署脚本
```

## 资源版本号流程

需要更新静态资源版本时，在仓库根目录运行：

```bash
python scripts/update_asset_version.py <新版本号>
python scripts/update_asset_version.py --check
```

更新命令会同步 `.asset-version` 和 HTML、CSS、JavaScript、JSON 中已有的 `?v=` 引用。`--check` 只校验版本一致性、本地 ES module 导入的版本参数及异常替换字符，不修改文件；部署前 CI 也会运行该检查，失败时停止部署。

## 部署

仓库里已经有 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，当前配置是：

- 只有 `main` 分支收到 `push` 时才会触发
- 通过 `easingthemes/ssh-deploy` 使用 SSH 和 rsync 增量同步
- 目标目录是 `/opt/1panel/www/sites/luoqi2112.com/index`
- 同步时会删除服务器上不再存在于仓库中的文件；域名验证文件需要随代码一起提交

如果要让这套流程真的跑起来，需要在 GitHub 仓库里配好这些 Secrets：

- `SERVER_IP`
- `SERVER_USER`
- `SERVER_SSH_KEY`

## 备注

- 当前页面读的是 `data/config.json`
- `WW_verify_KrgMR2fgJJbMnfNW.txt` 是微信域名归属验证文件，应保持在网站根目录
