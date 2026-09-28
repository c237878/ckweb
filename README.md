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
`id` `name` `category`(单一分类文本) `code`(番号) `country` `seriesid`→video_series `studioid`→studios `file_path` `file_size` `cover_path`(**磁盘绝对路径，不是 Base64**) `subtitle_state` `watermark_state` `res_w` `res_h` `scan_time` `sort_order` `ctime`
> 入库时间就是 `ctime`。接口里的 `addedAt` 字段也取自 `ctime`，但前端目前没有任何地方渲染它。

**片源两维（schema v6 起）** — 原先 `media_attr_flags` 一格要同时表达"字幕在不在"和"画面有没有广告"，
两头话都说不清，也筛不准。v6 拆成两个独立维度，取值口径后端在 `ckapi/Utils/SourceStates.cs`、
前端在 `ckweb/src/scripts/constants.js`（`SUBTITLE_STATES` / `WATERMARK_STATES`），两边必须一一对应，
文案与配色只这一份，页面里不要再各抄一遍。

| 维度 | 取值 |
| --- | --- |
| `subtitle_state` 字幕 | `unknown` 未标记 · `none` 无字幕版（发行版本就没字幕） · `missing` 缺字幕（这片有字幕，这份没带上） · `has` 有字幕 |
| `watermark_state` 广告水印 | `unknown` 未标记 · `none` 无广告（画面干净） · `light` 角标水印（不影响观看） · `heavy` 满屏广告（影响观看） |
| `res_w` / `res_h` / `scan_time` | 扫描出来的显示宽高与测量时间，见下节「片源扫描」 |

v6 的值映射只搬确定说得通的：`2 无字幕`→`missing`（旧长文案就是"缺少字幕文件"）、
`3 完美`→`has`；`1 劣质`（300 条）在新口径里没有对应维度——它说的是清晰度，
而清晰度这次由扫描客观量出来，所以两维都留 `unknown`。

**"没看过"不存列，直接推**：`subtitle_state` 与 `watermark_state` 都还是 `unknown` 就算没给过结论
（`Utils.SourceStates.Unrated` 是那条件的唯一出处，今日推荐与首页排序都用它）。
v6 一度建过 `watched` 列来存这件事，v7 删了——前提是**扫描只写分辨率、不写这两个状态**；
哪天让自动途径去填字幕，这个口径会当场失效（全站都成"有结论"，推荐池清空）。
代价是那 300 条旧「劣质」两维都是 unknown，从此按没看过算，会重新进今日推荐。

**actors** — `id` `name`(UNIQUE) `country` `bio` `birthdate` `ctime`
> `birthdate` 是 ISO 文本，只收 `YYYY` / `YYYY-MM` / `YYYY-MM-DD` 三种写法（`NormalizeBirthdate` 卡死），
> 其余一律存 NULL。站上只给到年月时就存 `1988-05`，**不补成 01 号**——补出来的是假数据。
> 所以这一列不能配 `<input type="date">`（它表达不了"只有年月"），编辑框用文本输入。
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
部分唯一索引保证一人只有一张，详情页相册里可以「设为头像」手工改（`PUT /api/actor/{id}/image/primary`，
先全清再置一，命不中就不动）。主图就是列表页那张脸：列表 SQL 用标量子查询带出 `avatar`，
`ActorCard` 有值才渲染一个 56px 宽的头像条，没同步过照片的演员卡片与原来完全一样。
`width/height` 由第一次生成缩略图时顺带回填，不额外解码一次。
> 缩略图：`GET /api/actor/{id}/thumb/{s|m}/{fileName}`，`s`=160（列表页头像）、`m`=400（详情页相册），
> WebP q80，落在 `Media:ThumbCache` 下按 `<演员ID>/<宽度>-<原文件名>.webp` 存，
> 比源文件旧就重生成——所以换图不需要任何"清缓存"动作。
> **只有表里有的文件名才会被服务**（表就是白名单），未同步过的路径一律 404；解码失败的图退回原图。
> 实测：2.0 MB 的 3024×4028 手机直出图 → 400px 缩略图 23 KB、160px 头像 6 KB；首次生成 1.5 秒（冷读+解码），之后 5 毫秒。

**highlight_images** — `file_name` 主键 + `width` `height` `size` `mtime` `ctime`，艳图池（`<艳图目录>/default/`）的清单。
与 `actor_images` 是同一套同步口径（`ckapi/Utils/ImageIndex.cs` 一份实现，两处调用），
差别只在这张表没有归属列、也不需要主图标记。同步同样由界面上的「同步照片」触发，开页只读表。
墙上的格子拉 400px 缩略图、点开灯箱才回源拿原图：实测一池 43 张 9.2 MB（平均 220 KB），
缩略图平均 43 KB（降到 20%），一墙 14 张从约 3.0 MB 降到约 600 KB。

**video_actors** — `(video_id, actor_id)` 复合主键，多对多
**video_series** — `id` `name` `alias` `link` `country` `ctime` `utime`
**video_likes** — `id` 自增 · `video_id` · `liked_at` · `target_type`(`video`/`comic`)。追加式记录，无去重、无用户标识
**comics** — `id` `name` `author` `description` `url` `cover_path` `directory` `status`(0 连载中 / 1 完结) `ctime` `utime`
**comic_chapters** — `id` `comic_id` `title` `directory` `sort_order` `image_count` `ctime`
**scan_directories** — `id` `path` `category`(`视频`/`封面`/`字幕`) `ctime` `utime`
**system_settings** — 名称/值 KV：`siteName` `pageSize` `personPageSize` `posterDir` `homePageCategories` `homePageCategoryCount` `countries` `categories` `mcpApiKey`
**studios** — `id` `name`(UNIQUE) `country` `link` `ctime` `utime`；**studio_aliases** `(studio_id, alias)`；影片侧只有一列 `videos.studioid`
**video_links** — `id` `video_id` `kind` `url`，影片的外部档案地址，与 `actor_links` 同构
**friend_links** — `id` `name` `link` `logo` `description` `sortorder` `ctime` `utime`

> schema v2 删除了取证确认零引用的 `videos.added_at`、`videos.utime`、`actors.avatar_path`、
> `comic_chapters.utime`、`scan_directories.recursive`、`scan_directories.auto_create_series`
> 以及遗留表 `video_types`、`scan_tasks`（删表前转存为 `备份目录/dropped_<表>_<时间戳>.sql`）。
> 保留 `friend_links.logo`（数据全空但读写与设置页输入都在）与 `video_likes.target_type`（区分影片/漫画点赞）。

## 备份

`SQLiteHelper.BackupDatabase()` 用 SQLite 原生在线备份接口，每天一份（`<库名>_yyyy-MM-dd.db`），同名文件已存在则跳过。启动迁移前先做一次快照（`_pre-migration`）。
合并演员前也做一次（`_pre-merge`，**不覆盖**已有的那份）：合并是全站唯一的不可撤销写操作，留一份"今天动手之前"的状态比留 N 份中间态有用。
注意：**不是**每次写操作都备份 —— 早期实现如此，批量写入会退化成 N 次全库拷贝。

## API 一览

### /api/Video
| 方法 | 路由 | 说明 |
|---|---|---|
| GET | `/api/Video/list` | 分页列表，支持 `category` `country` `keyword` `seriesId` `hasFile` `subtitle` `watermark` `resolution` `prioritizeUnrated` `sortBy` |
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
`GET /stream/{id}`（支持 Range）· `GET /cover/{id}`（带 ETag + 一周强缓存）· `GET /{code}/subtitle/check` · `GET /{code}/subtitle` · `GET /{id}/recommend` · `POST /{id}/reset-file-size` · `PUT /{id}/file-info` · `DELETE /{id}/file` · `POST /rename-to-code`

片源两维与扫描（`Controllers/VideoSourceController.cs`）：
`PUT /{id}/source`（body `{"subtitle":…,"watermark":…}`，只改传了的那一维，取值见 `SourceStates`）·
`POST /{id}/scan`（单条重扫）· `POST /scan/all?force=`（启动全站扫描）· `GET /scan/status` · `DELETE /scan/all`
> `POST /{id}/reset-file-size` 会连带把两维与分辨率一起清空——换了文件等于这条没结论了。

### /api/Actor
`GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /countries` · `GET /{id}/videos` · `POST /images/sync` · `POST /{id}/images/sync` · `PUT /{id}/image/primary` · `POST /{id}/meta/fetch` · `POST /scrape/fetch` · `GET /scrape/status` · `DELETE /scrape/fetch` · `GET /{id}/poster/{fileName}` · `GET /{id}/thumb/{s|m}/{fileName}` · `GET /duplicates` · `POST /merge`
> 图片清单不再单独请求：`GET /{id}` 的 `data.images` 里就带着（来自 `actor_images`）。
> 列表每行带 `avatar`（主图文件名，没有照片则为 null）——脸只出现在演员列表页这一处。
> `GET /` 支持 `keyword` `country` `sortBy` 与两个筛选：`hasPortrait`（bool，三态）、
> `birthYear`（`none` = 没有生日，或四位年份）。判"有没有脸"用 `EXISTS (actor_images)`：
> 实测有图的 1083 位全都有主图，两种口径当前等价。生日存的可能是一元、`YYYY-MM` 或全日期，
> 所以年份统一取 `SUBSTR(birthdate, 1, 4)` 比；年份下拉的取值来自 `GET /actor/birth-years`
> （库里真出现过的，升序，45 个）——给一个 1900-2100 的空区间不如只列有的。
> 抓取按钮配的 `?src=` 来自 `GET /actor/scrape/sources`，不传时走 av-wiki。
> `GET /{id}/videos` 支持 `page` `pageSize` `subtitle` `watermark` `resolution` `hasFile`，筛选在服务端完成后再分页。

### /api/Series
`GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `GET /countries` · `GET /{id}/videos` · `POST /{id}/sort`
> `GET /{id}/videos` 参数同上；`POST /{id}/sort` 提交的是整个系列的 id 序列，所以详情页进入排序模式时会先清掉片源筛选。

### /api/Comic
`GET /list` · `GET /{id}` · `POST /add` · `PUT /{id}` · `DELETE /{id}` · `POST /{comicId}/chapters` · `PUT /chapter/{id}` · `DELETE /chapter/{id}` · `GET /chapter/{chapterId}/images` · `GET /image/{chapterId}/{fileName}` · `GET /image/cover/{**path}` · `POST /decrypt/image` · `POST /decrypt/batch` · `POST /restore/image` · `POST /restore/batch` · `POST /{id}/like`

### 其余
`/api/Like` `GET /list` · `DELETE /{id}` · `POST /batch-delete` ；
`/api/SystemSetting` `GET /` · `GET /{name}` · `POST /` · `DELETE /{id}` ；
`/api/ScanDirectory` `GET /` · `GET /{id}` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `POST /check` ；
`/api/FriendLink` `GET /` · `POST /` · `PUT /{id}` · `DELETE /{id}` · `POST /{id}/move?dir=up|down`
> 友情链接的 `sortorder` 以前只能手填数字（真库里是 1..29 还带两条并列的 5），调一位要把后面挨个重填。
> `move` 的做法是按当前显示顺序（`sortorder, id`）把这一条挪一格，然后**整列重排成 1..N、只写变了的那几行**；
> 不做"交换两条的 sortorder"，因为并列时交换等于没交换。首/末越界与非法 dir 都回原因，不改数据。
> 设置 → 友情链接 每行的 ↑ ↓ 就是它，移动后重新拉清单并派发 `friendLinksUpdated` 让页脚换序。；
`/api/Highlights` `GET /posters`（读 `highlight_images`） · `POST /images/sync` · `GET /poster/{fileName}`（原图） · `GET /thumb/{s|m}/{fileName}` ；
`/api/Upload` `POST /video` · `POST /cover` ；
`/mcp` （JSON-RPC 2.0，需 `X-API-Key`）· `/api/mcp/status` · `/api/mcp/key`

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
    constants.js         SUBTITLE_STATES / WATERMARK_STATES / RESOLUTION_OPTIONS / SORT_OPTIONS
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
| 迷你 | 字幕、广告水印、分辨率+文件大小、点赞数 | 默认 |
| 完全 | 再加 地区、分类、所属系列、演员 | 视口 ≥900px **且** 这张卡片本身 ≥200px |

> 分辨率与体积并成一颗（`1080p 3.4 GB`）：两个说的都是"这个文件清楚多大"，分两颗会把迷你形态挤满。
> 两维里凡是"未标记"的那一维**不画胶囊**（`subtitleClass()` 对 `unknown` 返回空串，模板 `v-if` 直接不出），
> 所以没标过的卡片不会因为拆成两维就多出两颗空胶囊。

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

**PosterWall** —— 散贴照片墙（现在只有「艳图」在用；演员详情已换成逐张翻看的 `ActorAlbum`）：

```vue
<PosterWall :items="posters" :seed="seed" scatter :base-width="200" height="68vh" @shown="counts = $event">
  <template #caption="{ item }">{{ item.alt }} · {{ mb(item.size) }}</template>
</PosterWall>
```

| prop / emit | 说明 |
| --- | --- |
| `items` | `[{ key, src, alt, full? }]`，`key` 必须是稳定标识（文件名）——布局种子与随机取批都取它；`src` 是墙上那张（可以是缩略图），`full` 给了灯箱看原图，不给就沿用 `src` |
| `base-width` | 期望海报宽度，实际按画布容量在 0.72×–1.5× 间伸缩 |
| `seed` | 自增即换一批；同一 seed 下顺序固定 |
| `scatter` | 照片墙模式：尺寸与长宽比更多元、铺满格子、允许适度压叠。两种模式的松散度集中在 `LAYOUT` 常量里 |
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

详情页头部是**左文本 / 右相册**两栏（`.actor-header--split`，断点 900px 与影视卡片的完全形态同一条线）。
右边是**一把摊开的照片**：当前这张抬到正中、收成圆形当头像，其余按左右偏移斜着压在它后面（重叠扇形）。
卡片位置只由"与当前张的槽位差"派生（`--r` / `--d` 两个 CSS 变量），切换时只是槽位差变了，
于是 CSS 过渡把每张都滑到新位置 —— 没有一行 JS 动画代码，也不会跳位。

- 圆里取的是图片**上三分**（`object-position: center 18%`）：竖构图按中间裁，头像会只剩腰。
- 扇面上摆 ±3 张，再往外各留 3 格缓冲：卡片是"滑进来"的，不是凭空出现；
  几百张图不会全建节点，按窗口切片。
- 侧面的卡片点一下就切过去（当前这张点了是放大原图）。整个相册只占**一个 Tab 停靠点**，
  方向键翻页、Esc 关灯箱、关闭后焦点落回原处。
- **当前看的是哪张按文件名记，不按序号**：设为主图后后端会把那张挪到数组最前，
  记序号的话翻页会跳去别的图片。
- 底部四个动作：「设为头像」（当前这张不是主图时才出现，主图带一枚"头像"徽章）、
  「抓头像」「抓资料」（见下节）、「重新同步」。
- **没有照片时不占半页**：退化成一条虚线空态（"这位演员还没有照片" + 抓头像 / 抓资料 / 同步照片），头部回到单栏。
- 与「艳图」的 `PosterWall` 是两套东西：那边一墙小图供浏览、随机取批、可换一批；
  这边逐张翻看、要能放大看细节。两者的灯箱各自实现，不互相牵连。

### av-wiki 抓取：头像与资料（`ckapi/Utils/AvWiki.cs` + `Services/ActorScraper.cs`）

站上每个女优是一个 WordPress tag，档案块（`AV女優名` / `別名義` / `生年月日` / 头像直链 / SNS，
以及档案块之前那段出道叙述）就挂在 tag 的 `description` 里，所以走 `/wp-json/wp/v2/tags` 这个
JSON 接口，不去解析网页排版。抓回来的是事实字段（日期、姓名集合）与站点自己写的一段简介。

**认错人比抓不到严重得多**：一张别人的脸、一段安错人的简介，都会长期挂在库里而没人去核对。
"确定"的口径写死在 `AvWiki.Certify`：命中结果里**恰好一个**档案的名字集合
与我们库里的姓名/曾用名对得上（交集项 ≥2 字）才算数；零个、多个、没有可抓字段一律跳过并给出原因。
查询顺序：库里已有的 av-wiki 档案链接（自己的数据已经指向它）→ 含假名的曾用名（最接近站上的写法）
→ 其余曾用名 → 本名，每人最多问 5 次。繁简字形不同就是不同的人，**不做繁简归一**——
归一就把「泽/沢」这类差异抹平了，那正是查重风险所在。

一次查档、按需落多项，`Want` 掩码决定这次要什么（`avatar` / `profile` / `all`）：

- **头像**：落盘文件名固定 `默认.<ext>`（`ImageIndex` 补选主图时第一个就认它）；已有照片的人不动手。
- **资料**：只填当前空着的字段 —— `birthdate = COALESCE(birthdate, ?)`、`bio = COALESCE(NULLIF(TRIM(bio),''), ?)`。
  人写过的简介绝不覆盖；简介超 400 字就截到最近的整句。
- **av-wiki 只收日本女优，所以只看国家**：非日本的一律不去问（`ActorScraper.EligibleSql` / `SkipReason`）。
  不关联"演过 av 分类没有"——改过分类、或只挂了几部素人片的人会被误伤，而误伤的代价是这个人永远没有头像
  （实测小林真梨香：名下没有 av 片，但站上有她的档案）。
  省时间只是顺带（1598 位里约 97 位非日本被跳过）；主要是不给错配留机会 ——
  一个中国网红的名字恰好撞上某个日文 tag，就会把别人的脸和简介安到她身上，而这种错法长期没人会去核对。
  单演员入口在任何网络请求之前先挡，返回可直接展示的原因；
  详情接口带 `scrapeable`，不合格的人页面上那个抓取按钮直接不出现。
  `'日本'` 是 设置 → 地区与分类 里的规范取值，在那里改名要同步改这里。
- **还在查重候选里的一律跳过**（先合并再抓，免得同一张脸、同一段简介在两个名字下各存一份）。
- 站间节流 300ms；连续 3 次站点失败就中止本轮，不跟限流硬碰。
- 全站抓取是**服务端后台任务**（`Services/ScrapeJob.cs`）：`POST /scrape/fetch {what}` 启动并立刻返回，
  `GET /scrape/status` 给进度（processed / total / hit / percent / etaSeconds / what / note），
  `DELETE /scrape/fetch` 请求停止。**列表页与详情页都只有一个抓取按钮**（`抓取头像与资料`）：
  两个按钮查的是同一份档案，拆开点等于往同一个站点问两遍，所以单位入口收成
  `POST /actor/{id}/meta/fetch`（Want.All），批量入口固定发 `what=all`。
  同一时刻只跑一个任务，在跑时按钮变成「停止抓取」。
  每 2 秒轮一次，**离开页面、关浏览器都不影响它继续跑**，回来还能看到进度。
  进程内单例（这活儿是往别人站点上问话，并行没意义）；重启后端只丢进度不丢成果，
  已抓的文件与已填的字段都在，重跑会自动跳过填好的人。
- 进度条只在任务运行时存在，跑完即收起、结果改由一条提示承载；ETA 用已跑出的平均速度估，
  样本不足 3 位不给数，免得开局乱跳。
- 一个坑留档：`CancellationTokenSource` 一旦 `Cancel` 就不可复用，
  做成 `readonly` 字段会让"停止过一次之后再也启动不起来"（第二次任务在第一圈就退出）。
  每次 `Start` 换一个新源、并把它的局部引用传给循环体。
- 每抓成一位写一行日志（演员 ID、我们的名字、抓了什么、档案名与 slug）：批量跑的时候，
  这是唯一能回看"这些数据是从哪个档案抓来的"的地方。

### 老师图鉴抓取：生日与别名（`ckapi/Utils/LaoshiWiki.cs` + `Services/LaoshiScraper.cs`）

`laoshi.ink` 是纯静态 HTML 的女优资料站（Cloudflare 前置，686 份档案），**只有人物、没有任何影片信息**
（页脚明写不提供视频、封面、番号、下载）。站上字段既在可见的 `.spot-fact-table`
（`<span>标签</span><strong>值</strong>`）里，也在 `<script type="application/ld+json">` 的 `Person` 节点里：
别名与头像读 JSON-LD，出生日期只有事实表有，所以两处都读。

**这条源只补三样**：`actors.birthdate`、`actor_aliases`（日文名 / 罗马音 / 曾用名）、头像。
**简介明确不接** —— 那站冷门页的"简介"是「某某是日本演艺人物榜第 700 位收录人物，
当前页面仅整理公开基础资料」这类榜单套话，写进 `bio` 不如留空。

- **档案地址是 `actor-001` 这种不透明编号，名字拼不出 URL**，所以先取一次 `/actresses/` 索引页
  （1 个请求换 686 条 姓名→编号）。索引**只在内存里活 30 分钟、不落库**：
  站方 `/terms` 明写不得批量抓取，把对方整份档案结构搬进自己库里是比抓取更大的动作。
  抓取日志里仍会记下档案编号，事后能回看这个人是从哪份档案补的。
- **候选集先用索引过一道**（`CandidatesAsync`）：1481 位缺东西的人里只有约 370 位在站上有档案，
  而批量任务的间隔是按"每一位候选"付的 —— 不过滤就是让 8 秒的刹车踩在根本不会发请求的人身上。
- **别名只写没人占用的写法**：`actor_aliases` 同时是"重复演员候选"的依据，
  某个写法已经是别人的姓名或别名就不塞进去，免得凭空造出一对假候选。
  也没走 `Aliases.Normalize`：那条规则按空白再拆一次，会把 `Yua Mikami` 拆成两条。
- **占位符过滤**：站上缺的字段写成「待补充」「暂未确认」，`LaoshiWiki.Fact` 一律当没有；
  日期两种格式都见过（`1988 年 5 月 24 日` 与 `1970-10-06`），共用 `ScrapeChannelService.JapaneseDate`。
- **头像按中文名直链**：`/assets/img/celebrities/jav/<姓名>.jpg`，不碰详情页也能拿到，无防盗链。
- 礼貌参数比 av-wiki 保守一个数量级：通道里种的是 **间隔 8 秒、每日 40 位、连续 3 次失败冷却 4 小时**
  （av-wiki 是 1.5 秒 / 300 次 / 2 小时）。全量跑约 370 位要分 10 天，这是故意的。
- 抓取按钮的**来源下拉框**在演员列表页（批量）与演员详情页相册工具条（单位）各一个，
  与「抓头像与资料」并排；一位演员一次点击就把头像、生日、别名全补齐。
  取值见 `constants.js` 的 `ACTOR_SOURCES`，必须与后端实现 `IActorSource` 的类的 `Key` 一致；
  两个源补的字段不同，tooltip 文案在 `ACTOR_SCRAPE_TIPS` 里各写一句。选择记在 localStorage，
  一轮跑不完（配额会先刹车）下次进来还是同一个源。

### 片源扫描：只量分辨率（`ckapi/Utils/MediaProbe.cs` + `Services/SourceScanner.cs`）

4798 条影片手动填分辨率不现实，也不需要装 ffmpeg——**直接读 MP4 的盒（box）结构**就够了：

- 元数据都在 `moov` 里。这批文件（都是 `.mp4`，放在 SMB 共享上）的 `moov` 普遍排在 `mdat` 之后、
  贴着文件尾，所以**从文件头按 size 跳着读盒头**就能定位它，不必猜"读尾部 4MB"这种启发式。
- 定位到 `moov` 之后也只读需要的小块：每条 trak 的 `tkhd`（显示宽高）与 `mdia/hdlr`（这条是不是视频轨）。
  `AUTOCODE` 那批 `moov` 有 12MB，整块读进内存纯属浪费。
- 宽高取 `tkhd` 的**显示值**而不是 `stsd` 的编码值：`607×1080` 这种非方形像素的片子编码是 `1080×1080`，
  但看到的的确是 1080 行。`tkhd` 是 16.16 定点数，**四舍五入**再取整（直接右移会把 607.99 报成 607）。
- **报成"多少 p"和筛档都按短边**（`MIN(res_w, res_h)`），不按高度：横屏的短边就是高度，两种口径对横屏等价；
  差别在竖屏那 188 条——按高度会把 `720×1280` 报成"1280p"、把 5 条 `1440×2560` 混进 4K 档，
  而手机视频通行叫法就是按短边叫 720p / 1440p。原始宽高两列都存着，详情页原样显示 `720×1280`。
- **为什么不靠文件名**：`/Volumes/av/021014-540.mp4` 里那个 `540` 是序号，当分辨率读会把一批 720p 标成 540p；
  实测 4798 条里只有 2 条文件名真含分辨率字样。

**扫描只写 `res_w` / `res_h` / `scan_time`，别的列一概不碰**：字幕与广告水印两维由人在界面上给结论。
（早先扫描会顺带把"容器里有字幕轨 / 字幕目录里有同番号文件"填成 `has`，撤掉了——
有字幕轨不等于那份字幕能用，没有也不等于"这片子本来就没字幕"，这一维真正在问的是"要不要去补"。）
同理**扫描不能碰这两个状态**：界面上"没看过"就是两维都没标（见上文的 `Unrated`），
自动填了字幕，今日推荐就没有"没看过"的片可推了。

- 探测与写库分两步：文件在共享盘上，一次小读一个来回（实测 0.1~0.5 秒），所以**并发只放在探测**
  （6 路），写库回到单线程、一批 24 条一个事务——SQLite 连接不是线程安全的。
- 全站扫描是**服务端后台任务**（`Services/SourceScanJob.cs`），与头像抓取同一套：
  `POST /scan/all` 启动并立刻返回、`GET /scan/status` 给进度、`DELETE /scan/all` 请求停止，
  影片列表页工具栏「扫描片源」→ 变成「停止扫描」，进度条用抽出来的 `views/components/JobBar.vue`
  （演员列表的抓取进度条同一份样式，不再各写一遍 CSS）。
  实测全库 3884 个文件跑完 515~934 秒（看共享盘冷热），量到 3877、读不出 7。
- 那 7 个读不出来的**不是解析器漏了**：查过字节，`AUTOCODE-468` 开头就不是合法盒，
  `ALDN-352` 只有 `ftyp/free/mdat` 且 `mdat` 到文件尾（**没有 moov**，等于没下完），
  `SORA-354` 的 `mdat` 声明长度比文件本身还大。这类统一报"文件不在，或读不出元数据"。
- `force=true`（全站重扫）只在后端与接口文档里留着，界面不摆按钮：换过文件的正常走法是在详情页
  点「重置」清掉这一条，它就成了「未扫描」，下一次「扫描片源」自然把它带上（分辨率筛选里也有「未扫描」一档方便清点）。

### 影片元数据结构（v9 片商收成单值；v10 撤除标签与合辑）

对齐 TMDB 的结构位，但只落**用得起来**的那几个；`media_images`、拆 `videos/video_files`
两条实测无数据支撑（每个番号恰好一张封面、重复番号 0 条），没做。

- `videos.original_name` / `release_date`：现在的 `name` 其实是**中文译名**，不改列名（牵动一片代码），
  语义写在这里与界面上。发行日期沿用生日那套口径：只收 `2024` / `2024-03` / `2024-03-15`，不补零。
  改这两列走 **`PUT /api/video/{id}/meta`**，不走整份 `PUT /video/{id}`——后者会把
  `cover_path` 等字段按传入值一起写，漏传就清空，只想改个发行日期不该冒这个险。
- **片商是实体不是字符串，但一部片只有一家**：`studios` + `studio_aliases`，影片侧是
  `videos.studioid`（v9 起，与 `seriesid` 同形）。原来照 TMDB 做成 `video_studios(video_id, studio_id, role)`
  多对多，预设"制作商 + 发行商"会常见；实际填下来 27 部有片商的没有一部挂过两家、`role` 全是空串，
  多对多换来的只有"界面得假装单选"。存成文本列同样不行——「麦当娜 / Madonna / マドンナ」会被当成三家，
  所以实体与别名表留着，只是关系收成外键列。
  **保存时顺手补同系列**：`FillSeriesStudios` 把这家片商写进同系列**还没填片商**的影片（已有片商的绝不动，
  系列里混进别家时那些结论得留着），补了几部回在消息里，界面直接显示。清空只清自己。
  管理页在 设置 → 片商（`StudioManager.vue`，v10 起词表只剩这一份），对话框里正名 / 别名 / 国家 / 官网
  四个字段一起给：国家取自「地区与分类」那份规范清单，官网缺协议会补 `https://`，否则点开来会跳回本站。
  影片编辑里片商是**单选可搜**，与「所属系列」用同一个 `ComboBox`——同形就该同控件。
- **题材标签与关联合辑整体撤除（v10）**：`tags` / `tag_aliases` / `video_tags` / `tag_suggestions` /
  `video_groups` / `video_group_items` 六张表连同控制器、筛选、详情页区块、MCP 的打标工具一起删掉。
  理由不是实现有问题，是收益撑不起成本：标签这套东西的前提是"有人按标签浏览"，而词表要人维护、
  AI 提的候选要人审、近义词要人并入，每天在做的只有一个人；合辑则是库里一组都没建过。
  撤除前有 pre-migration 快照（`/Volumes/disk1/Data/backup/ckplayer_*_pre-migration.db`），要回滚用它。
  当年那三条设计结论（受控词表、AI 不许建词、按词批处理不按行）写在 git 历史与提交说明里，
  将来若重做，仍然照那三条走。
- `video_links`：影片的外部档案地址，与 `actor_links` 同构、共用 `Utils/Links` 的校验与归类。
  它同时是将来抓取的首选定位键——自己的数据已经指向档案时，抓取不用再搜一遍也不会认错片。
- 详情页播放器下方统一成**一份两列清单**（`.kv-list`：定宽标签列 + 值列），标签一律不带冒号、
  字号统一 `--f-sm`；两档顺序：片源（字幕 / 广告水印 / 分辨率）→ 档案（原名 / 发行 / 片商 / 系列 / 演员）。
  类名别叫 `.facts`，那是卡片属性行的全局类，会串味。
- **演员年龄**：`ageAt(发行日期, 出生日期)`（`scripts/utils/format.js`）算的是"发行时多大"，
  两边都精确到月日才按生日是否未到减 1，缺日期或算出负数一律不显示。渲染成演员名字后面
  一段 `· 24 岁` 的次要文本（`--f-xs` + `--text-faint`），不额外占行也不抢链接的视觉重心。
- 列表页筛选：影片列表有「按片商」（值传 id），题材标签那个筛选已随功能一起撤掉。
- **设置 → 片商的列表固定按正名升序**（原先按名下影片数排，新加的、还没挂片的片商
  会被挤到最后一页，找不到）；SQLite 没有拼音排序，中文名按码位序，与演员/系列列表同一套口径。
- **影片详情页的片商填了官网就是外链**（`GET /video/{id}` 顺带 `st.link as studio_link`，
  卡片查询没这一列时 `Str` 返回 null），与系列/演员同用 `.actor-link` 的样式；没填官网就只是文本。

**抓取通道目前不通**：av-wiki.net 已上 Imunify360 反爬，我们那套请求头被直接拒
（`Access denied by Imunify360 bot-protection`），**已上线的演员头像/资料抓取同样受影响**；
javcup 详情字段是混淆 JS，javlibrary / javdb 从这台机器连不上。
所以这几列先由人工填，通道恢复或换到别的源之后再补抓取，并且要把限速/配额/熔断做成可视化配置。

### 抓取通道（可视化配置，`scrape_channels` + `Services/ScrapeChannel.cs`）

设置页新增「抓取通道」分区（可深链 `/settings?group=channels`）。一条通道 = 一个站点，三段都可配：

| 段 | 字段 |
| --- | --- |
| 去哪查 | `entity`（演员/影片）、`query_source`（番号 / 姓名 / 已有档案链接的 slug）、`fetch_url` 模板（`{q}` 编码、`{raw}` 原样、`{slug}`） |
| 怎么抽 | `fetch_kind` = `json`（点路径 `0.title.rendered`）· `html`（正则取第一个捕获组）· `builtin`（抽取在代码里，只管开关与礼貌）；`rules` 每条含目标、路径、转换（`jdate`/`upper`/`collapse`）、是否只填空值 |
| 多礼貌 | `min_interval_ms`、`daily_quota`、`fail_limit` + `cooldown_minutes`；运行态（今日已问、连续失败、冷却到几点、最后一次为什么被拒）同表同行，列表一次就能显示"能不能问、为什么不能" |

三条设计上的硬话：

- **可写目标走白名单**（`ScrapeChannelService.Targets`）。不做这层，规则里写 `videos.file_path`
  就等于给配置界面开了个任意 UPDATE 的入口。目标与通道实体不匹配、正则不合法、非 http(s)
  都会在保存时一次把所有问题说完，不让人一条条试。
- **反爬拦截要认出来，不能当"没查到"**。av-wiki 现在是 403 + `Access denied by Imunify360`，
  以前也回过 200 + `One moment, please` 的 JS 挑战页。两种都由 `DetectChallenge` 判成"被拦"
  并计入连续失败 → 到阈值自动进冷却。认不出来的话，批量任务会把"被拒"当"这条没有"，
  然后一路把剩下几千次全敲完 —— 这次被封就是这么来的。
- **试抓只读不写**（`POST /scrape/channel/{id}/test`）。改完地址与规则当场就能看到抽出了什么，
  不用改一版部署一次；它算真请求所以也计配额。落库走 `/{id}/apply`，`ifEmptyOnly` 的规则只填空值。

- **状态一键切换**：通道列表的操作列第一个就是「停用 / 启用」（`POST /scrape/channel/{id}/toggle`）。
  单独一个接口而不是让前端回整份配置——编辑对话框改一半没保存时，开关不该顺手把 rules 写回去。
- **停用 = 从抓取入口消失**：`GET /actor/scrape/sources` 只列通道存在且启用的源，
  演员列表与详情相册的来源下拉框用它（`utils/scrapeSources.js` 一份状态两处用，
  选过哪个记在 localStorage）。停用的源还摆在列表里让人选，选完只能吃一句拒绝。
  冷却中与配额用满的源**仍然在列表里** —— 那是一会儿就自己好的状态，藏起来会让人以为源没了。
- **单位抓取也过闸门**（`ScrapeJob.FetchOneAsync`）：先看开关/冷却/配额，等够最小间隔再问，
  抓完把结果回报给通道。之前只有批量走闸门，手工点既不计配额也不受间隔约束；
  批量 `Start` 同样先问一次开关，免得起一个第一圈就会自己停下来的任务。
- 按「停止抓取」收尾时不再报"任务异常中断"：等间隔时被叫停抛的是 `OperationCanceledException`，
  以前它落到兜底 catch 里，一条正常的停止被说成了事故。

表里种下两条内置通道（`fetch_kind=builtin`）：av-wiki 女优档案与老师图鉴女优档案，
按 `fetch_url` 里的域名认谁是谁（`FirstFor(entity, host)`），配额与熔断各算各的。
**批量抓取头像/资料现在也走这道闸门**：`ScrapeJob` 原来写死 `Task.Delay(300)`，
现在每条之前先问通道能不能问、按 `min_interval_ms` 等、把结果回报给熔断，
被拦或配额用满就带着原因停下这一轮（界面上看得到原因）。
只有"站点侧失败"才累计熔断数，"查无此档"是对话正常结束，不该把通道打死。

没上 CSS 选择器是因为要引 AngleSharp，一个依赖换一种写法不划算；正则丑但够用。
设置页的分区现在可深链（`?group=…`），刷新也停在原分区。

### AI 接口（MCP，`Services/Mcp.cs` + `Controllers/McpController.cs`）

给本机大模型用的口子，形状与 logapi-finance 一致：**同一个 `/mcp` 端点 + `X-API-Key` 头**，
JSON-RPC 2.0 手写（`initialize` / `tools/list` / `tools/call` / `notifications/*` / `ping`），
不引 SDK —— 面就这几个方法，加依赖换来的是版本漂移和一层不受控的 HTTP 栈。
`GET/DELETE /mcp` 按规范回 405（服务端不推事件流），通知回 202 空体。

四个工具，**全部只读**：`video_list`（可 `noStudio` / `unscanned` / `unrated` 直接捞缺数据的片）、
`video_get`、`studio_list`、`vocab_counts`（一屏库况：多少部没填片商、没量分辨率、没标片源，
演员缺生日几位）。筛选参数里的片商**接受正名、别名或 id**，认不出直接报错——
模型手上只有名字，硬要它先查一轮 id 只是白费往返。

三条收口：

- **整站免鉴权，只有这里加一道**。密钥存 `system_settings.mcpApiKey`，那行是空的分身就等于没开门
  （全 401）。生成与查看在 设置 → AI 接口，端点地址、客户端配置片段、工具清单都在那一屏，每块都能一键复制。
- **这个面上没有写入口**。AI 看得懂整个库，改不动整个库；要落库的动作一律走界面里人点过的那条路。
  （原先有 `tag_propose` 这条受控写入口，随题材标签一起在 v10 撤除。）
- **参数错按工具内错误回**（`isError: true` + 一句中文原因），不报 JSON-RPC 错误：
  SDK 会把后者当服务端故障，模型就再也读不到"你少传了 videoId"这种可自救的信息。

### 重复演员合并（`views/components/ActorMergeDialog.vue`）

演员列表页工具栏的「查重」打开一张候选表，一行一组，两个按钮决定**留谁**（留下来的是哪个艺名，
直接影响以后搜不搜得到人，所以方向必须当场选，不给默认值）。

`GET /api/actor/duplicates` 给两类线索，强的排前面：
**本名互指**（一人的本名恰好挂在对方的曾用名里）与**共享曾用名**（弱）。
实测 1612 位演员里 22 组候选、9 组是本名互指 —— 后面那批基本是繁简/新旧艺名同一人
（藤森里穗↔藤森里穂、长濑凉子↔長瀬涼子、沙月惠奈↔沙月恵奈）。
但共享曾用名**不等于**同一人：数据里就有把第三个女优的名字同时挂到两人名下的脏行，
所以界面只摆证据，不做自动合并，也不给"忽略此组"（误报留着不会误伤）。

`POST /api/actor/merge {from, to}` 一次做完：影片关系改挂（`INSERT OR IGNORE` 后再删，两人共用的片自然合流）、
曾用名整组搬过去**并把旧艺名也留成一条曾用名**、外链走 `Utils.Links.Normalize` 统一去重、
目标缺的地区/简介用来源的补上（已有的不覆盖）、来源连同子表删掉。全程一个事务。
**来源名下还有照片时直接拒绝**：图片按 `<艳图目录>/<演员ID>/` 定位，只把行改挂过去会得到一批 404，
磁盘目录得由人先挪 —— 宁可让界面说清楚，也不悄悄留下看不见的图。

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

当前分区（`GROUPS` 就是这个顺序）：**站点与首页**（网站名称、每页数量、首页展示分类与条数）
→ **图片目录** → **扫描目录** → **地区与分类**（即原来的「数据源」）→ **片商**
→ **抓取通道** → **AI 接口** → **友情链接**。

**配置类功能不进顶部菜单**：词表原先是 `/metadata` + 导航「词表」，现在嵌进设置
（`StudioManager.vue` 收 `embedded` 属性，独立成页时才有自己的页头），顶部菜单只剩浏览页。
`/metadata` 保留为重定向，老书签不会 404。

**每页数量分两档**：`pageSize` 管影片列表，`personPageSize` 管系列与演员列表
（卡片比影片小得多，一屏想看到的数量不是一个量级）。后者留空时 getter 回落到前者，
所以不配也不会变行为——store 里是 `personPageSize` getter，页面不要自己读原始设置。

**地区与分类**分区管 `countries` / `categories` 两份清单：影片、系列、演员的地区和影片的分类，
可选值全部来自这里（后端 `Utils.Options.CommaList`），编辑页只能选不能造词，
所以不同页面看到的选项一定一致。清单为空时后端不回退到表内 DISTINCT —— 管理员清空是有意为之。

这两份清单用 **TaxonomyTable** 管理（`GET/POST /api/taxonomy`）：表格里能同时看到现有值、
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
