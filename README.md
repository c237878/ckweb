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
| `Media:ThumbCache` | 演员缩略图的落盘目录；没配则贴着数据库文件放 `<库目录>/ckthumbs`。整个目录可安全删除，下次访问会重新生成 |

## 数据库

启动时由 `ckapi/Services/DataService.cs` 负责：建表 → 按 `PRAGMA user_version` 逐级迁移 → 建索引 → `ANALYZE`。
**`CreateBaseTables` 是"当前完整结构"的唯一权威声明**，`Migrations` 是历史库的追赶路径，两者必须保持等价（改结构时同时改两处）。全新库会直接标记为最新版本、跳过迁移。

索引：`videos(ctime)`、`videos(category,ctime)`、`videos(code)`、`videos(country)`、`videos(seriesid,sort_order)`、`video_actors(actor_id)`、`video_likes(video_id,target_type)`、`video_likes(liked_at)`、`comics(ctime)`、`comic_chapters(comic_id,sort_order)`、`video_series(name)`、`actor_aliases(alias)`、`actor_links(actor_id,kind)`、`actor_images(actor_id,is_primary,file_name)` + 部分唯一索引 `actor_images(actor_id) WHERE is_primary=1`。

### 表

**videos** — 影片
`id` `name` `category`(单一分类文本) `code`(番号) `country` `seriesid`→video_series `file_path` `file_size` `cover_path`(**磁盘绝对路径，不是 Base64**) `media_attr_flags` `sort_order` `ctime`
> 入库时间就是 `ctime`。接口里的 `addedAt` 字段也取自 `ctime`，但前端目前没有任何地方渲染它。

**media_attr_flags（片源标记）** — `0` 未标记 · `1` 劣质 · `2` 无字幕 · `3` 完美。
前端展示文案与配色统一在 `ckweb/src/scripts/constants.js` 的 `MEDIA_FLAGS`，不要在页面里各写一份。

**actors** — `id` `name`(UNIQUE) `country` `bio` `ctime`
**actor_aliases** — `(actor_id, alias)` 复合主键，曾用名**一行一个**（schema v3 起）。
旧 `actors.alias` 用空格串多个别名，既没法精确检索也分不清「志保 Shiho」是一个还是两个，
v3 迁移按空白拆分去重后把列删掉了；清洗规则与迁移共用 `ckapi/Utils/Aliases.cs`
（去空去重、丢掉与本人姓名相同的项、单项 ≤60 字、每人 ≤20 个）。
检索：`/api/actor?keyword=` 会同时匹配姓名与曾用名，列表与详情都返回 `aliases: string[]`；
新增/更新传 `aliases` 数组，整组替换。
**actor_links** — `id` `actor_id` `kind` `url`，演员外链**一行一条**（schema v4 起）。
以前这些地址是塞在 `bio` 里的，等于从没被信任过：接口原样吐出去，前端也就原样渲染。
v4 迁移把含 `http` 的简介逐条抽出（382 位演员 → 528 行，379 条简介抽完就空了——它们本来就不是简介，
是被当成链接容器用了），剩下的正文写回 `bio`。校验/归类规则与迁移共用 `ckapi/Utils/Links.cs`：
只放行 http/https（`javascript:`、`data:` 一旦进了 `href` 就是现成的 XSS）、`www.` 开头补协议、
按主机名归类（x.com/twitter.com→`twitter`、instagram.com→`instagram`、javcup/av-wiki/fanza→`profile`，
都命中不了→`other`；`homepage` 只能手选）、忽略大小写与结尾斜杠去重、每人 ≤10 条、单条 ≤300 字。
`kind` 传空串表示"按域名自动归类"，非白名单值同样回落到自动归类。
列表与详情都返回 `links: [{kind, url}]`，新增/更新整组替换。
编辑器就在 `AddActorDialog` 里（一行一条：类型下拉 + 地址输入 + 移除），没抽成公共组件——目前只有这一处用。
详情页把每条渲染成一颗 `.tag.tag--info` 药丸，文案是「类型 + 主机名」（同一个类型常挂好几个站，只写类型分不清），
`href` 只放 http(s)：前端也再挡一道，万一有人直接改库塞进 `javascript:` 也不会变成可点链接。
前端 `LINK_KIND_OPTIONS`（`constants.js`）与后端 `Links.Kinds` 必须一一对应，改一边就要改另一边。
**actor_images** — `(actor_id, file_name)` 主键，演员图片**一行一张**：`is_primary` `width` `height` `size` `mtime` `ctime`。
图片字节仍在磁盘上（`<艳图目录>/<演员ID>/*.jpg|png|webp`），这张表存的是清单，
为的是**打开详情页不再扫盘**：以前每次进页面都要 `Directory.GetFiles` 一次，挂载卷冷读时能挂十几秒。
现在扫描只由界面上的「同步照片」触发（演员列表页扫全部、详情页扫一位），
`POST /api/actor/images/sync` 与 `POST /api/actor/{id}/images/sync` 各一个。
同步只 `stat` 不打开文件；同名文件被换掉（mtime 变了）就刷新 `size` 并清掉 `width/height`；
磁盘上没了的行会被删掉，整个目录没了的演员也一样——但**根目录不可读时一律直接报错、一个字都不写**，
否则卷没挂上就等于把整张表清空。每人自动选一张主图（先看 `默认/default/cover/avatar/1…` 这类命名，否则按文件名取第一张），
部分唯一索引保证一人只有一张，界面后续可手工改。
`width/height` 由第一次生成缩略图时顺带回填，不额外解码一次。
> 缩略图：`GET /api/actor/{id}/thumb/{s|m}/{fileName}`，`s`=160（列表页头像）、`m`=400（详情页相册），
> WebP q80，落在 `Media:ThumbCache` 下按 `<演员ID>/<宽度>-<原文件名>.webp` 存，
> 比源文件旧就重生成——所以换图不需要任何"清缓存"动作。
> **只有表里有的文件名才会被服务**（表就是白名单），未同步过的路径一律 404；解码失败的图退回原图。
> 实测：2.0 MB 的 3024×4028 手机直出图 → 400px 缩略图 23 KB、160px 头像 6 KB；首次生成 1.5 秒（冷读+解码），之后 5 毫秒。

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
`GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /countries` · `GET /{id}/videos` · `POST /images/sync` · `POST /{id}/images/sync` · `GET /{id}/poster/{fileName}` · `GET /{id}/thumb/{s|m}/{fileName}`
> 图片清单不再单独请求：`GET /{id}` 的 `data.images` 里就带着（来自 `actor_images`）。
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
一行摆开、放不下自动换行。四种卡片共用这一份定义，页面里不要再自己写胶囊行容器。

**可点与不可点靠 hover 区分，不靠形状**：`.tag` 外观统一，只有 `a.tag` / `button.tag`
有 hover（全局一条规则，描边取 `currentColor`），纯 `span.tag` 拿不到。
新增胶囊只要选对元素标签，不要自己写 hover。

**影视卡片只有两种形态**，靠 `.pill--wide` 类的显隐切换，没有第三种：

| 形态 | 显示内容 | 触发条件 |
| --- | --- | --- |
| 迷你 | 片源标记、文件大小、点赞数 | 默认 |
| 完全 | 再加 地区、分类、所属系列、演员 | 视口 ≥900px **且** 这张卡片本身 ≥200px |

```css
@media (min-width: 900px) { @container (min-width: 200px) { .pill--wide { display: inline-flex; } } }
```

视口条件与列数档位对齐（<900px 两列、≥900px 四列）；容器条件管的是
"屏幕很大但卡片很窄"的槽位——影片详情页右侧推荐位是 300px 面板排两列，每张只有 146px，
只看视口会给它完全形态、挤成一团。`.video-card` 上有 `container-type: inline-size`，
所以卡片自己就是自己胶囊行的查询容器。

**`mode` prop 已删除**：曾经有 `full` / `display` / `brief` 三种取值，首页与列表传的值不同，
导致同一个组件在不同页面少一两个胶囊——详情页推荐卡与列表卡长得不一样就是这个轴造成的。
现在窄槽位由容器条件自动降级，不需要调用方指定形态，也不要再加回来。

**四种卡片的可点外观统一由全局 `.card--clickable` 提供**（手型光标 + hover 光影），
`.card.selected` 提供选中描边；影片 / 漫画 / 演员 / 系列卡片只在组件里写自己的排布，
不要再各写一份 `cursor`、`:hover`、`.selected`，也不要再用 `.card--link`、`.picking` 这类
只为光标存在的临时类（整张卡片一直可点，光标就该一直是手型）。
`.card` 本身不给光标，因为 LikeList 的表格容器也复用 `.card` 但不可点。

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

**面板浮层统一走 `.dropdown-menu` + `.dropdown-option`**，不要再抄第三份（演员候选曾经是独立的
`.suggest`，已并进来）。面板高度不写死在场景里：`scripts/utils/dropdownFit.js` 的
`autoFitDropdown(menu, anchor)` 在展开时量一次——沿祖先求可视范围（滚动容器会裁剪绝对定位后代，
对话框的 `.dialog__body` 就是），向下放不下就压高度、上方更宽松就加 `.is-above` 朝上翻，
并且**向下取整到整行**（宁可少露一行也不切半行），滚动/改窗时跟随重算，收起时还原。
新加浮层控件时调这一个函数即可，别在 CSS 里为某个场景另设 `max-height`。

**数字值注意**：`options` 里放真正的数字（`{ value: 0, label: '连载中' }`），
不要再写 `v-model.number` —— 原生 `<option>` 会把值变成字符串，`.number` 就是为补这个洞存在的，
自绘组件直接透传 `opt.value`，不需要它。

**PosterWall** —— 散贴照片墙（演员详情与「艳图」共用）：

```vue
<!-- 艳图：照片墙模式 -->
<PosterWall :items="posters" :seed="seed" scatter :base-width="200" height="68vh" @shown="counts = $event">
  <template #caption="{ item }">{{ item.alt }}</template>
</PosterWall>
```

| prop / emit | 说明 |
| --- | --- |
| `items` | `[{ key, src, alt }]`，`key` 必须是稳定标识（文件名）——布局种子与随机取批都取它 |
| `base-width` | 期望海报宽度，实际按画布容量在 0.72×–1.5× 间伸缩 |
| `seed` | 自增即换一批；同一 seed 下顺序固定 |
| `scatter` | 照片墙模式：尺寸与长宽比更多元、铺满格子、允许适度压叠；默认关（演员详情那种整齐网格）。两种模式的松散度集中在 `LAYOUT` 常量里 |
| `@shown` | `{ shown, total }`，父页面用它显示"显示 N / M 张"并决定要不要给换一批按钮 |

效果是"乍看乱、细看匀"的抖动网格：画布按容量等分成格子（每行张数尽量平均，不留短尾行），
每张在自己格子里做小幅位移与倾角。**画布不滚动**——张数超过容量就随机取一批展示，
而不是把画布拉长出滚动条。所有随机量由 `文件名哈希 + seed` 派生（不用 `Math.random()`），
所以 resize、返回本页都不会整墙跳位，只有换 seed 才换人。

**ChipListEditor** —— 字符串数组型的小标签编辑器（演员曾用名）：`v-model` 就是 `string[]`，
回车或点「添加」入列，点 × 移除，重复值给 toast 拦下。
```vue
<ChipListEditor v-model="form.aliases" label="新增曾用名" hint="一行一个，检索影片时输入这些名字也能找到本人" />
```
与 `TaxonomyTable` 的分工：那个管全局数据源（带引用计数、改名级联、立即落库），
这个只管"一条记录身上挂的几个值"，父组件拿到什么就存什么。

### 演员相册（`views/components/ActorAlbum.vue`）

详情页头部是**左文本 / 右相册**两栏（`.actor-header--split`，断点 900px 与影视卡片的完全形态同一条线）：
一次看一张、`‹ ›` 翻页、底部 `n / 总数` + 重新同步；点图片放大看原图，Esc 关闭、焦点回到触发按钮。
整个相册只占**一个 Tab 停靠点**（放大与翻页都在同一个按钮上，方向键就地翻页）。

- 画框比例跟随图片：表里有宽高就用它，没有就用缩略图加载出来的自然尺寸，
  所以竖图不会在框里留出两条底色边。
- **没有照片时不占半页**：退化成一条虚线空态（"这位演员还没有照片" + 同步照片），头部回到单栏。
- 与「艳图」的 `PosterWall` 是两套东西：那边一墙小图供浏览、随机取批、可换一批；
  这边逐张翻看、要能放大看细节。两者的灯箱各自实现，不互相牵连。

### 输入行为（全站，写在 `scripts/utils/inputBehavior.js`）

`App.vue` 挂载时调一次 `setupInputBehavior()`，管两件事：

1. **点 label 不再把焦点/点击转给控件**——只有点到控件本身才聚焦、才展开下拉。
   下拉框是按钮实现的，原先点标题等于点按钮，会把列表展开出来。
   复选框/单选/文件选择保留"点标题即选中"（`KEEP_LABEL_ACTIVATION`），那是常规用法。
2. **给文本类输入打 `autocomplete="off"`**，不再一聚焦就弹浏览器记下的历史输入。
   已显式写了 `autocomplete` 的元素不覆盖（如目录分类那个 datalist 输入框）。

两处都收在这里而不是逐个元素写属性：全站四十多个输入框、三十多个 label，以后还会加字段，
写在标记里一定会漏。新增输入框不需要做任何事就自动纳入。

### 系统设置页

`views/pages/Settings.vue` 是「左侧标签 + 右侧单个分区卡片」的两栏结构：
点标签只显示对应分区（`role=tablist` / `tab` / `tabpanel`，方向键切换）。
之前用锚点滚动定位 + 滚动高亮，手机上要滚很久且高亮跟不上，已废弃，不要改回去。
分区顺序、导航项、标题与说明都取自脚本里的 `GROUPS` 一处定义；
新增一项设置只给 `settingsList` 的元素加上 `group`，它会自动落进对应分区并共用该分区的保存按钮。
窄屏（<900px）时标签变成顶部一行可横滑的标签条。

**数据源**分区管 `countries` / `categories` 两份清单：影片、系列、演员的地区和影片的分类，
可选值全部来自这里（后端 `Utils.Options.CommaList`），编辑页只能选不能造词，
所以不同页面看到的选项一定一致。清单为空时后端不回退到表内 DISTINCT —— 管理员清空是有意为之。

数据源用 **TaxonomyTable** 管理（`GET/POST /api/taxonomy`）：表格里能同时看到现有值、
每个值的分表引用数，并可改名 / 删除 / 上移下移 / 新增，每个操作立即落库，没有整页"保存"按钮。

```vue
<TaxonomyTable kind="countries" label="地区" :rows="countryRows" :orphans="countryOrphans" @saved="loadTaxonomy" />
```

两条约定要记住：

- **改名会级联**：后端在同一个事务里 `UPDATE videos / actors / video_series`，
  再写清单，并同步 `homePageCategories`。只改清单不动记录，就会出现"清单和数据显示两套值"，
  正是当初各页面地区选项不一致的根源。前端在有引用数时先弹二次确认并列出影响条数。
- **清单外的值会被列出来**：记录里用着但不在清单上的值（`orphans`）单独显示，可一键加入清单。
  没有这一栏，"下拉框为什么少一项"就永远查不出来。

### 播放器

播放器 ckplayer 只在影片详情页按需注入（`scripts/utils/ckplayer.js`），不再全局加载。
注意播放器容器 `div#ckplayer` 会让浏览器把同名元素挂到 `window.ckplayer` 上，判断库是否就绪必须用 `typeof === 'function'`。

## 安全边界

- 无鉴权、CORS 全开、监听 `0.0.0.0` —— 仅适合可信局域网，别直接暴露公网。
- 上传目录与图片代理都受 `Media:Roots` 白名单约束；文件名经 `SafePath.AsFileName` 校验（拒绝 `..`、路径分隔符、隐藏文件）。
- 分页参数有上限（`pageSize` ≤ 500，top-N ≤ 100），页码下限 1。
- 异常详情只进日志，响应里回统一文案。
