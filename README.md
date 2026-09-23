# AI影城（ckweb + ckapi）

自托管的本地媒体库站点。两个仓库：

- **ckweb** — 前端，Vue 3.5 + Vite 7 + Pinia + vue-router，无 UI 组件库（样式全部自绘）
- **ckapi** — 后端，.NET 8 + SQLite（`Microsoft.Data.Sqlite` 裸 SQL，无 ORM）+ Swagger

## 跑起来

```bash
# 后端（默认 5033，可用 ServerPort 配置项改端口）
cd ckapi && dotnet run

# 前端（默认 3001，/api 代理到后端）
cd ckweb && npm install && npm run dev
```

- Swagger（仅开发环境）: http://localhost:5033/swagger
- 数据库文件与备份目录在 `ckapi/appsettings.json` 的 `ConnectionStrings` 里
- 联调别的后端实例：`VITE_PROXY_TARGET=http://localhost:5099 npm run dev`
- `npm run lint` 依赖 `eslint.config.js`（已提供扁平配置，规则以 warn 为主，不阻断构建）

## 配置项（ckapi/appsettings.json）

| 键 | 含义 |
|---|---|
| `ConnectionStrings:DefaultConnection` | SQLite 路径 |
| `ConnectionStrings:BackupPath` | 备份目录；不存在则跳过备份 |
| `ServerPort` | Kestrel 监听端口，默认 5033 |
| `Media:Roots` | 允许对外提供文件的目录白名单，默认 `["/Volumes"]` |

## 数据库

启动时由 `ckapi/Services/DataService.cs` 负责：建表 → 按 `PRAGMA user_version` 逐级迁移 → 建索引 → `ANALYZE`。
**`CreateBaseTables` 是"当前完整结构"的唯一权威声明**，`Migrations` 是历史库的追赶路径，两者必须保持等价（改结构时同时改两处）。全新库会直接标记为最新版本、跳过迁移。

索引：`videos(ctime)`、`videos(category,ctime)`、`videos(code)`、`videos(country)`、`videos(seriesid,sort_order)`、`video_actors(actor_id)`、`video_likes(video_id,target_type)`、`video_likes(liked_at)`、`comics(ctime)`、`comic_chapters(comic_id,sort_order)`、`video_series(name)`。

### 表

**videos** — 影片
`id` `name` `category`(单一分类文本) `code`(番号) `country` `seriesid`→video_series `file_path` `file_size` `cover_path`(**磁盘绝对路径，不是 Base64**) `media_attr_flags` `sort_order` `ctime`
> 入库时间就是 `ctime`。接口里的 `addedAt` 字段也取自 `ctime`，但前端目前没有任何地方渲染它。

**media_attr_flags（片源标记）** — `0` 未标记 · `1` 劣质 · `2` 无字幕 · `3` 完美。
前端展示文案与配色统一在 `ckweb/src/scripts/constants.js` 的 `MEDIA_FLAGS`，不要在页面里各写一份。

**actors** — `id` `name`(UNIQUE) `alias`(空格分隔的多个别名) `country` `bio` `ctime`
> 演员照片是**文件墙**，不走数据库列：目录取 `system_settings.posterDir`，按 `<posterDir>/<演员ID>/*.jpg|png|webp` 枚举，经 `GET /api/actor/{id}/posters` 返回文件名。原先那个始终为空的 `avatar_path` 列已在 schema v2 删除，别再去库里找演员头像字段。

**video_actors** — `(video_id, actor_id)` 复合主键，多对多
**video_series** — `id` `name` `alias` `link` `country` `ctime` `utime`
**video_likes** — `id` 自增 · `video_id` · `liked_at` · `target_type`(`video`/`comic`)。追加式记录，无去重、无用户标识
**comics** — `id` `name` `author` `description` `url` `cover_path` `directory` `status`(0 连载中 / 1 完结) `ctime` `utime`
**comic_chapters** — `id` `comic_id` `title` `directory` `sort_order` `image_count` `ctime`
**scan_directories** — `id` `path` `category`(`视频`/`封面`/`字幕`) `ctime` `utime`
**system_settings** — 名称/值 KV：`siteName` `pageSize` `posterDir` `homePageCategories` `homePageCategoryCount`
**friend_links** — `id` `name` `link` `logo` `description` `sortorder` `ctime` `utime`

> schema v2 删除了取证确认零引用的 `videos.added_at`、`videos.utime`、`actors.avatar_path`、
> `comic_chapters.utime`、`scan_directories.recursive`、`scan_directories.auto_create_series`
> 以及遗留表 `video_types`、`scan_tasks`（删表前转存为 `备份目录/dropped_<表>_<时间戳>.sql`）。
> 保留 `friend_links.logo`（数据全空但读写与设置页输入都在）与 `video_likes.target_type`（区分影片/漫画点赞）。

## 备份

`SQLiteHelper.BackupDatabase()` 用 SQLite 原生在线备份接口，每天一份（`<库名>_yyyy-MM-dd.db`），同名文件已存在则跳过。启动迁移前先做一次快照。
注意：**不是**每次写操作都备份 —— 早期实现如此，批量写入会退化成 N 次全库拷贝。

## API 一览

### /api/Video
| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/Video/list` | 分页列表，支持 `category` `country` `keyword` `seriesId` `hasFile` `mediaAttrFlags` `prioritizeUnrated` `sortBy` |
| GET | `/api/Video/{id}` | 详情（含 actors、likeCount） |
| POST | `/api/Video/add` | 新增 |
| PUT | `/api/Video/{id}` | 更新（番号变更会连带重命名磁盘文件） |
| DELETE | `/api/Video/{id}` | 删除。`?deleteFiles=true` 才连磁盘文件一起删；**默认 false**，删文件必须显式选择 |
| DELETE | `/api/Video/batch` | 批量删除 |
| POST | `/api/Video/{id}/like` | 点赞 |
| GET | `/api/Video/meta` | 分类/国家/系列 + 首页配置 |
| GET | `/api/Video/home-sections` | **首页各分类板块一次返回**（替代按分类多次请求） |
| GET | `/api/Video/autocode` | 生成下一个 `AUTOCODE-###` |
| GET | `/api/Video/daily-recommend` | 今日推荐：只缓存未看过影片的 id（不够数才掺看过的），卡片字段每次现查；按天缓存，`count` 变化或 `?refresh=true` 都会重建 |
| GET | `/api/Video/recently-liked` | 最近点赞 |
| GET | `/api/Video/top-liked` | 高赞影片 |
| GET | `/api/Video/likes/stats` | 点赞日历 + 近 12 个月统计 |

### /api/video（流媒体与文件）
`GET /stream/{id}`（支持 Range）· `GET /cover/{id}`（带 ETag + 一周强缓存）· `GET /{code}/subtitle/check` · `GET /{code}/subtitle` · `GET /{id}/recommend` · `POST /{id}/reset-file-size` · `PUT /{id}/file-info` · `PUT /{id}/media-flags` · `DELETE /{id}/file` · `POST /rename-to-code`

### /api/Actor
`GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /countries` · `GET /{id}/videos` · `GET /{id}/posters` · `GET /{id}/poster/{fileName}`
> `GET /{id}/videos` 支持 `page` `pageSize` `mediaAttrFlags` `hasFile`，筛选在服务端完成后再分页。

### /api/Series
`GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /countries` · `GET /{id}/videos` · `POST /{id}/sort`
> `GET /{id}/videos` 参数同上；`POST /{id}/sort` 提交的是整个系列的 id 序列，所以详情页进入排序模式时会先清掉片源筛选。

### /api/Comic
`GET /list` · `GET /{id}` · `POST /add` · `PUT /{id}` · `DELETE /{id}` · `POST /{comicId}/chapters` · `PUT /chapter/{id}` · `DELETE /chapter/{id}` · `GET /chapter/{chapterId}/images` · `GET /image/{chapterId}/{fileName}` · `GET /image/cover/{**path}` · `POST /decrypt/image` · `POST /decrypt/batch` · `POST /restore/image` · `POST /restore/batch` · `POST /{id}/like`

### 其余
`/api/Like` `GET /list` · `DELETE /{id}` · `POST /batch-delete` ；
`/api/SystemSetting` `GET /` · `GET /{name}` · `POST /` · `DELETE /{id}` ；
`/api/ScanDirectory` `GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `POST /check` ；
`/api/FriendLink` `GET /` · `POST /` · `PUT /{id}` · `DELETE /{id}` ；
`/api/Highlights` `GET /posters` · `GET /poster/{fileName}` ；
`/api/Upload` `POST /video` · `POST /cover`

### 响应约定
统一 `{ success, data, message }`。分页有两种历史形态，前端按端点分别读取，勿混用：
`/Video/list` 返回 `data.list` + `data.total`；`/Actor`、`/Series`、`/Comic/list`、`/Like/list` 返回 `data` + 顶层 `total`。
业务失败（重名、记录不存在）目前返回 **HTTP 200 + `success:false`**，前端依赖读 `success` 分支提示 —— 改成 4xx 会让这些提示静默失效，需前后端一起改。

## 前端结构

```
src/
  assets/main.css        设计令牌 + 全局工具类（唯一色彩来源）
  scripts/
    api/index.js         axios 实例与各模块 API
    store/app.js         pinia：站点名/分页大小/主题
    constants.js         MEDIA_FLAGS / SORT_OPTIONS
    utils/               format / debounce / filterPersist / ckplayer(按需加载)
  plugins/router.js      懒加载路由 + 404 + scrollBehavior
  views/pages/           12 个页面
  views/components/      VideoCard ComicCard Pagination ComboBox Dialog …
```

**主题**：`:root` 是暗色（影院金强调），`html[data-theme='light']` 覆盖为亮色；切换按钮在页头，选择记在 `localStorage.ck_theme`，`index.html` 内联脚本在首帧前落地避免闪白。
写样式时**不要新增硬编码色值**，一律用 `--bg-elev` `--text-dim` `--accent` 这类令牌；`main.css` 里已有的 `.btn/.tag/.card/.field/.dialog/.empty/.skeleton` 优先复用。

### 样式约定

- **元素间距只用 flex/grid 的 `gap`**，由父容器声明，不用 margin 撑。margin 只允许四种用途：
  `margin: 0 auto` 容器居中、`margin-left/right/top: auto` 推到另一端、`.sr-only` 的 `-1px` 裁剪、
  `appearance:none` 配套的 spin-button 复位。
- **控件尺寸用高度 token 定死**，不靠 padding 撑：`--ctl-h-xs`(24) 标签、`--ctl-h-sm`(32) 小按钮、
  `--ctl-h` (38) 标准按钮/输入框/下拉框；纵向不留 padding，水平内缩用 `--ctl-pad-x*`。
  文字居中靠 `display:flex + align-items/justify-content`。
- **药丸的 hover 全站只有一套**：`a.tag:hover` / `button.tag:hover` 描边取 `currentColor`，
  `.tag` 基础态就有 1px 透明边框占位，所以 hover 不改变尺寸。不可点的 `.tag` 没有 hover。
  不要再写 `filter: brightness()` 或自定义背景式 hover。
- **同功能元素只有一个类**，对照表在 `main.css` 的「布局」段注释里：
  页面主标题 `.page-title` / 区块标题 `.section-title` / 卡片标题 `.card-title` / 元信息 `.meta` /
  标签 `.tag + .tag--*` / 控件 `.btn .input .select`。不要在页面里再造同义类。

### 列表卡片交互模型

影片 / 演员 / 系列三个列表页共用同一套模式，卡片底部**不放任何按钮**：

| 模式 | 入口 | 点卡片 | 卡片上 |
| --- | --- | --- | --- |
| `browse`（默认） | — | 进详情页 | 无勾选框 |
| `select` | 头部「删除」 | 勾选/取消 | 出现勾选框，头部变「全选 / 删除选中 (N) / 取消」 |
| `edit` | 头部「编辑」 | 打开该条编辑框 | 无勾选框；**关完弹窗仍是编辑模式**，可继续点下一条，点「退出编辑」才回 browse |

`VideoCard` 与 `ComicCard` 用 `click-action`（`browse`/`select`/`pick`）表达这个差异，`selectable` 只管勾选框显不显示。
演员、系列卡片是页面内联结构，用各自的 `onCardClick` 分派。
「重置」与「点击番号复制」都不再出现在卡片上，前者只在影片详情页有。
漫画没有批量删除接口，批量删除是前端逐条调 `DELETE /api/comic/{id}`，中途失败会把已删数量与首条原因一起报出来。

### 列数与卡片内胶囊

网格全站只有 **`.grid` 一个类、两档列数**，首页 / 影片 / 系列 / 演员 / 漫画共用：

| 视口 | 列数 |
| --- | --- |
| < 900px | 2 列 |
| ≥ 900px | 4 列 |

原先演员、系列用的 `.grid--rows` 已删除，不要再加回来分叉。

卡片内的胶囊统一放进全局 **`.pills`**（flex + `gap: var(--s1)` + wrap），
一行摆开、放不下自动换行。四种卡片共用这一份定义，页面里不要再自己写胶囊行容器
（演员卡的 `.right-tags` 现在只负责推到名称右侧）。

**可点与不可点靠 hover 区分，不靠形状**：`.tag` 外观统一，只有 `a.tag` / `button.tag`
有 hover（全局一条规则，描边取 `currentColor`），纯 `span.tag` 拿不到。
新增胶囊只要选对元素标签，不要自己写 hover。

**信息档位与列数档位严格对齐**，同用 900px 这条线：

| 档 | 显示内容 |
| --- | --- |
| 窄屏（2 列） | 片源标记、文件大小、点赞数 |
| 宽屏（≥900px，4 列） | 再加 地区、分类、所属系列、演员 |

实现方式是给次要胶囊加 `.pill--wide` 类，靠 `@media (min-width: 900px)` 放开。
这里刻意用视口而不是 `@container`：只有这样才能保证"几列"和"显示多少"永远一致，
不会出现大屏列多反而每张卡信息更少的倒挂。

**`mode` 只剩两态**：默认（影片列表与首页板块完全同一套外观）与 `brief`
（详情页推荐条的紧凑行）。此前首页传 `display`、列表传 `full`，导致首页卡片少一个
分类胶囊、大小胶囊也不是按钮——两处看起来不一样，就是这个轴造成的。

**卡片 hover 只换光影不做位移**（无 `transform`）；按钮与胶囊的 `:active` 下压 1px 保留。

`VideoCard` 上点文件大小胶囊会复制番号；若该影片 `file_size` 为 0，
顺带触发一次路径重扫（`POST /api/video/{id}/reset-file-size`）并回填本卡显示。
这是刻意保留的快捷入口，`title` 里写明了这个副作用。

### 可复用控件

全站已不再使用原生 `<select>`（弹出层外观不可控），统一走两个自绘组件；
两者的浮层与选项行共用 `main.css` 里的 `.dropdown-menu` / `.dropdown-option`，不要另写一份。

**SelectList** —— 普通单选下拉，选项少时用：

```vue
<SelectList v-model="filters.country" :options="countries"
            all-label="全部地区" label="按地区筛选" @change="applyFilter" />
<SelectList v-model="filters.sortBy" :options="SORT_OPTIONS.video" label="排序方式" />
```

| prop | 说明 |
| --- | --- |
| `modelValue` | 选中项的 `value`，String 或 Number |
| `options` | `[{ value, label }]`，也可传纯字符串数组（value 即自身） |
| `all-label` | 顶部"全部"项文案（对应值 `''`），传空串则不渲染 |
| `placeholder` | 无选中项时的占位文案 |
| `label` | 触发按钮的无障碍名；页面没有可见 label 时必须给 |
| `disabled` | 禁用 |

**ComboBox** —— 带输入过滤的下拉，选项多时用（如 711 个系列）：

```vue
<ComboBox v-model="filters.seriesId" :options="seriesList"
          placeholder="筛选系列..." all-label="全部系列" @change="applyFilter" />
```

| prop | 说明 |
| --- | --- |
| `modelValue` | 选中项的 `id`，字符串 |
| `options` | `[{ id, name }]`，传入即用 |
| `placeholder` | 输入框占位文案 |
| `all-label` | 顶部"全部"项文案，传空串则不渲染该项 |
| `limit` | 下拉最多渲染条数，默认 50 |

两者都 emit `update:modelValue`（配合 `v-model`）与 `change`（值真正变化时），
都支持键盘上下/Enter/Esc、点击外部收起。ComboBox 额外有清除按钮。

**数字值注意**：`options` 里放真正的数字（`{ value: 0, label: '连载中' }`），
不要再写 `v-model.number` —— 原生 `<option>` 会把值变成字符串，`.number` 就是为补这个洞存在的，
自绘组件直接透传 `opt.value`，不需要它。



播放器 ckplayer 只在影片详情页按需注入（`scripts/utils/ckplayer.js`），不再全局加载。
注意播放器容器 `div#ckplayer` 会让浏览器把同名元素挂到 `window.ckplayer` 上，判断库是否就绪必须用 `typeof === 'function'`。

## 安全边界

- 无鉴权、CORS 全开、监听 `0.0.0.0` —— 仅适合可信局域网，别直接暴露公网。
- 上传目录与图片代理都受 `Media:Roots` 白名单约束；文件名经 `SafePath.AsFileName` 校验（拒绝 `..`、路径分隔符、隐藏文件）。
- 分页参数有上限（`pageSize` ≤ 500，top-N ≤ 100），页码下限 1。
- 异常详情只进日志，响应里回统一文案。
