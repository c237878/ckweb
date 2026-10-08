import axios from 'axios'
import { getAdminToken } from '@/scripts/utils/adminToken'

const api = axios.create({
  baseURL: '/api',
  timeout: 0, // 无超时限制
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * 破坏性接口（删片/删图/改名/批量）要带管理口令。头由这里统一加，
 * 调用点不用各自记得——漏一处就等于那个接口形同没锁。
 * 跨站的网页学不会发这个自定义头，也猜不到值，所以这一步同时挡掉了 drive-by 删除。
 */
function withAdminToken(config) {
  const token = getAdminToken()
  if (token) config.headers = { ...config.headers, 'X-Admin-Token': token }
  return config
}

/**
 * 401 转成一份正常的 { success:false, needToken } 载荷返回。
 * 不这么做的话各处 catch 里只能拿到 "Request failed with status code 401"，
 * 人看到的是一句英文故障，而不是一句"这操作需要口令，去设置-安全"。
 */
function unwrapNeedToken(error) {
  const data = error?.response?.data
  if (error?.response?.status === 401 && data && data.needToken) return data
  return Promise.reject(error)
}

api.interceptors.request.use(withAdminToken)

// 上传专用实例 - 跳过 Vite 代理，直连后端（避免大文件断流）
// baseURL 包含 /api 前缀，因为 UploadController 路由为 api/[controller]
// 局域网地址从 .env.development 的 VITE_API_LAN_HOST 读取，默认兜底
const LAN_IP = import.meta.env.VITE_API_LAN_HOST || '192.168.110.67'
const uploadAxios = axios.create({
  baseURL: import.meta.env.DEV
    ? `http://${LAN_IP}:5033/api`
    : '/api',
  timeout: 0,
  headers: { 'Content-Type': 'multipart/form-data' }
})

uploadAxios.interceptors.request.use(withAdminToken)

// 响应拦截器：与 api 实例保持一致
uploadAxios.interceptors.response.use(
  response => response.data,
  error => {
    console.error('Upload API Error:', error)
    return unwrapNeedToken(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return unwrapNeedToken(error)
  }
)

// 漫画相关API
export const comicApi = {
  getList: (params) => api.get('/comic/list', { params }),
  getDetail: (id) => api.get(`/comic/${id}`),
  add: (data) => api.post('/comic/add', data),
  update: (id, data) => api.put(`/comic/${id}`, data),
  delete: (id) => api.delete(`/comic/${id}`),
  // 章节
  addChapter: (comicId, data) => api.post(`/comic/${comicId}/chapters`, data),
  updateChapter: (chapterId, data) => api.put(`/comic/chapter/${chapterId}`, data),
  deleteChapter: (chapterId) => api.delete(`/comic/chapter/${chapterId}`),
  getChapterImages: (chapterId) => api.get(`/comic/chapter/${chapterId}/images`),
  // 解密
  decryptImage: (data) => api.post('/comic/decrypt/image', data),
  decryptBatch: (data) => api.post('/comic/decrypt/batch', data),
  restoreImage: (data) => api.post('/comic/restore/image', data),
  restoreBatch: (data) => api.post('/comic/restore/batch', data),
  // 图片访问
  getImageUrl: (chapterId, fileName) => `/api/comic/image/${chapterId}/${encodeURIComponent(fileName)}`,
  // 逐段编码：encodeURI 不转义 # % \，封面路径里出现 # 会被当成分数标识符而静默截断请求
  getCoverUrl: (coverPath) => `/api/comic/image/cover/${String(coverPath ?? '')
    .split('/').map(encodeURIComponent).join('/')}`,
  // 点赞
  like: (id) => api.post(`/comic/${id}/like`)
}

export const likeApi = {
  getList: (params) => api.get('/like/list', { params }),
  delete: (id) => api.delete(`/like/${id}`),
  batchDelete: (ids) => api.post('/like/batch-delete', { ids })
}

// 视频相关API
export const videoApi = {
  getList: (params) => api.get('/video/list', { params }),
  getDetail: (id) => api.get(`/video/${id}`),
  getRecommend: (id, limit = 8) => api.get(`/video/${id}/recommend`, { params: { limit } }),
  add: (data) => api.post('/video/add', data),
  update: (id, data) => api.put(`/video/${id}`, data),
  delete: (id, params) => api.delete(`/video/${id}`, { params }),
  batchDelete: (ids, params) => api.delete('/video/batch', { data: { ids }, params }),
  /** 取流按**版本行 id**（v11：一部片名下一份文件一行），封面仍是影片级 */
  getStreamUrl: (fileId) => `/api/video/stream/${fileId}`,
  /** 封面地址。传 size（'s'=160 / 'm'=400）走缩略图：卡片只有一两百像素宽，
   *  不该去拉中位 142KB、p99 2.7MB 的原图——那些文件还在挂载卷上。
   *  要原画质的地方（详情页大图、截图用的封面、裁头像的预览）就不要传 size。 */
  getCoverUrl: (id, size = '') => size
    ? `/api/video/cover/${id}/${size}`
    : `/api/video/cover/${id}`,
  checkSubtitle: (code) => api.get(`/video/${code}/subtitle/check`),
  getMeta: () => api.get('/video/meta'),
  /** 首页分类板块：一次请求取代按分类各发一次 list */
  getHomeSections: () => api.get('/video/home-sections'),
  getAutoCode: () => api.get('/video/autocode'),
  /** 某一版的播放进度（v13 起在库里）：换设备、清缓存不再从头看起 */
  getState: (fileId) => api.get(`/video/state/${fileId}`),
  /** position ≤1 秒后端会删掉记录，与本地"拖回开头就是不续播"同一条口径 */
  saveState: (fileId, position) => api.post('/video/state', { fileId, position }),
  /** 批量读进度（列表要显示"看到几成"时用，一次问完） */
  getStates: (ids) => api.get('/video/states', { params: { ids: (ids || []).join(',') } }),
  /** 某一版上被点赞的时间点（v12 的 play_time 攒出来的，做精彩瞬间用） */
  getMoments: (id) => api.get(`/video/${id}/moments`),
  /** 点赞落在版本上：fileId 不传后端按默认版本记（列表卡片那种没有版本概念的入口）。
   *  time = 点赞那一刻的播放位置（秒），只有详情页拿得到，别处不传就是 NULL */
  like: (id, fileId, time) => api.post(`/video/${id}/like`, null, {
    params: { ...(fileId ? { fileId } : {}), ...(time === null || time === undefined ? {} : { time }) }
  }),
  /** 疑似重复：内容指纹相同但挂在不同影片上的文件。只报证据，不自动处理 */
  getDuplicates: () => api.get('/video/duplicates'),
  // 体积分析：按目标码率算"重编码还能省多少"，只读
  optimize: (params) => api.get('/video/optimize', { params }),
  /** 全站扫描：任务在服务端后台跑，force=true 连量过的一起重扫（候选是"版本行"，不再按影片） */
  startScanAll: (force = false) => api.post('/video/scan/all', null, { params: { force } }),
  scanStatus: () => api.get('/video/scan/status'),
  stopScanAll: () => api.delete('/video/scan/all'),
  /** 文件名对齐：默认只做预检（dryRun），传 false 才真去改盘上的文件名 */
  renameToCode: (dryRun = true) => api.post('/video/rename-to-code', null, { params: { dryRun } }),
  /**
   * 文件层操作一律按版本行 id（v11）：重置大小、删文件、上传后写回、扫分辨率、标两维。
   * 一部片的每一版各有各的分辨率与字幕/水印结论，按影片 id 做这些事已经说不清是哪一版。
   */
  resetFileSize: (fileId) => api.post(`/video/version/${fileId}/reset-file-size`),
  deleteVideoFile: (fileId) => api.delete(`/video/version/${fileId}/file`),
  updateFileInfo: (fileId, data) => api.put(`/video/version/${fileId}/file-info`, data),
  /** 读这一版的文件头量分辨率（字幕与广告水印不参与扫描，由人工标） */
  scanOne: (fileId) => api.post(`/video/version/${fileId}/scan`),
  /** 片源两维：patch = { subtitle?, watermark? }，一次可以只改一维 */
  updateSource: (fileId, patch) => api.put(`/video/version/${fileId}/source`, patch),
  getVersion: (fileId) => api.get(`/video/version/${fileId}`),
  addVersion: (body) => api.post('/video/version', body),
  updateVersion: (fileId, body) => api.put(`/video/version/${fileId}`, body),
  deleteVersion: (fileId, params) => api.delete(`/video/version/${fileId}`, { params }),
  /** 设为影片口径：列表筛选与统计从此走这一版，界面必须先二次确认 */
  setDefaultVersion: (fileId) => api.post(`/video/version/${fileId}/default`),
  /**
   * 把这一版盘上的文件名改成它的行级番号。默认只做预检（dryRun=true），
   * 传 false 才真改名：改错一格文件名标识就想把 20GB 的文件重命名，代价太大。
   */
  alignVersionName: (fileId, dryRun = true) => api.post(`/video/version/${fileId}/align-name`, null, { params: { dryRun } }),
  /** 版本类型词表（新增版本的下拉用它；设置页那份 CRUD 走 versionTypeApi） */
  getVersionTypes: () => api.get('/video/version/types'),
  getLikeStats: (year, month) => api.get('/video/likes/stats', { params: { year, month } }),
  getDailyRecommend: (count, refresh = false) => api.get('/video/daily-recommend', { params: { count, refresh } }),
  getRecentlyLiked: (count) => api.get('/video/recently-liked', { params: { count } }),
  getTopLiked: (count) => api.get('/video/top-liked', { params: { count } }),
  setLinks: (id, links) => api.put(`/video/${id}/links`, { links }),
  /** 只改原名与发行日期；整份 PUT /video/{id} 会连封面路径一起按传入值写，不敢用它 */
  setMeta: (id, body) => api.put(`/video/${id}/meta`, body),
}

// 版本类型词表（设置里的「版本类型」分区）：解说频道这类"这一版是谁做的"
export const versionTypeApi = {
  getList: () => api.get('/versiontype'),
  add: (body) => api.post('/versiontype', body),
  update: (id, body) => api.put(`/versiontype/${id}`, body),
  remove: (id) => api.delete(`/versiontype/${id}`),
  move: (id, dir) => api.post(`/versiontype/${id}/move`, null, { params: { dir } })
}

// 抓取通道：去哪查 / 怎么抽 / 要多礼貌，全在设置页里配
export const scrapeApi = {
  channels: () => api.get('/scrape/channel'),
  saveChannel: (body) => api.put('/scrape/channel', body),
  deleteChannel: (id) => api.delete(`/scrape/channel/${id}`),
  resetChannel: (id) => api.post(`/scrape/channel/${id}/reset`),
  toggleChannel: (id) => api.post(`/scrape/channel/${id}/toggle`),
  testChannel: (id, params) => api.post(`/scrape/channel/${id}/test`, null, { params }),
  applyChannel: (id, entityId) => api.post(`/scrape/channel/${id}/apply`, null, { params: { entityId } }),
  // 批量补：起完立刻返回，进度靠 batchStatus 轮询（一次几百条要跑几分钟）
  startBatch: (id, limit) => api.post(`/scrape/channel/${id}/batch`, null, { params: { limit } }),
  batchStatus: () => api.get('/scrape/channel/batch/status'),
  stopBatch: () => api.post('/scrape/channel/batch/stop')
}

// AI 接口（MCP）：设置页只用得到查状态与换密钥，工具调用是大模型自己的事
export const mcpApi = {
  status: () => api.get('/mcp/status'),
  rotateKey: () => api.post('/mcp/key')
}

// 片商词表
export const studioApi = {
  getList: (params) => api.get('/studio', { params }),
  getDetail: (id) => api.get(`/studio/${id}`),
  getVideos: (id, params) => api.get(`/studio/${id}/videos`, { params }),
  /** 词表里实际用过的国家（筛选用；表单那份取自「地区与分类」规范清单） */
  getCountries: () => api.get('/studio/countries'),
  add: (data) => api.post('/studio', data),
  update: (id, data) => api.put(`/studio/${id}`, data),
  remove: (id) => api.delete(`/studio/${id}`)
}

// 演员相关API
export const actorApi = {
  getList: (params) => api.get('/actor', { params }),
  getDetail: (id) => api.get(`/actor/${id}`),
  getVideos: (id, params) => api.get(`/actor/${id}/videos`, { params }),
  getCountries: () => api.get('/actor/countries'),
  /** 库里出现过的出生年份（升序），生日下拉框用它 */
  getBirthYears: () => api.get('/actor/birth-years'),
  /** 可选的抓取来源：通道被停用的那个不会出现 */
  scrapeSources: () => api.get('/actor/scrape/sources'),
  /** 把艳图目录里的图片扫进 actor_images；不传 id 就是扫全部演员。清单本身由详情接口带出 */
  syncImages: (id) => api.post(id ? `/actor/${id}/images/sync` : '/actor/images/sync'),
  /** 指定列表页那张脸用哪张图 */
  setPrimaryImage: (id, fileName) => api.put(`/actor/${id}/image/primary`, { fileName }),
  /** 从她出演影片的封面截一张正方形当头像：{ videoId, x, y, zoom }，x/y 是裁切窗口位置 0~1 */
  avatarFromCover: (id, body) => api.post(`/actor/${id}/avatar/from-cover`, body),
  /** 删掉一张演员图片。默认连磁盘文件一起删（只删行的话，下次扫盘同步又长回来）；
   *  deleteFile=false 是"从库里摘掉、文件留着" */
  deleteImage: (id, fileName, deleteFile = true) =>
    api.delete(`/actor/${id}/image`, { params: { fileName, deleteFile } }),
  /**
   * 给一位演员补档：头像 + 资料一次问完（同一份档案问两遍没意义）。
   * 拿不准就什么都不做，返回里会说明原因；src 见 ACTOR_SOURCES。
   */
  fetchMeta: (id, src) => api.post(`/actor/${id}/meta/fetch`, null, { params: { src } }),
  /** 全站抓取：任务在服务端后台跑，what = avatar | profile | all，src 决定问哪个档案源 */
  startScrape: (what = 'all', src) => api.post('/actor/scrape/fetch', { what, src }),
  scrapeStatus: () => api.get('/actor/scrape/status'),
  stopScrape: () => api.delete('/actor/scrape/fetch'),
  /** 疑似重复演员候选（按线索强度排序） */
  duplicates: () => api.get('/actor/duplicates'),
  /** 把 from 并入 to，to 是留下来的名字 */
  mergeActors: (from, to) => api.post('/actor/merge', { from, to }),
  add: (data) => api.post('/actor', data),
  update: (id, data) => api.put(`/actor/${id}`, data),
  delete: (id) => api.delete(`/actor/${id}`)
}

// 艳图（照片墙）
export const highlightApi = {
  /** 清单来自 highlight_images 表，不触发扫盘 */
  getPosters: () => api.get('/highlights/posters'),
  /** 扫一次 <艳图目录>/default/ 入库 */
  syncImages: () => api.post('/highlights/images/sync')
}

// 系统设置相关API
export const settingApi = {
  getAll: () => api.get('/systemsetting'),
  save: (data) => api.post('/systemsetting', data)
}

// 运行状态与自检（设置里的「运行状态」分区）
export const systemApi = {
  /** 跑一遍不变量断言：纯 SQL，几十毫秒，进页面点一次算一次 */
  checks: () => api.get('/system/checks'),
  /** 备份概况：目录配了没有、最近一份是几点、留了多少（读目录元信息，不碰媒体卷） */
  backups: () => api.get('/system/backups'),
  /** 健康检查：库可写、配置里的目录在不在、备份多久没跑。只 stat 目录，不列内容 */
  health: () => api.get('/system/health'),
  /** 不等周期，立刻跑一轮盘上核对 + 增量扫描。后台跑，接口立刻回 */
  runScanNow: () => api.post('/system/scan/run'),
  /** 马上存一份快照（文件名带时刻）。只是加文件，不要口令 */
  backupNow: () => api.post('/system/backup/now'),
  /** 只改"以后往哪儿写"，不动已有文件；传空串是退回配置文件那份 */
  setBackupDir: (path) => api.post('/system/backup/dir', { path }),
  /** 把已有快照搬去新目录（removeSource=false 时只复制不删源）。会删文件，要口令 */
  transferBackupDir: (path, removeSource = true) =>
    api.post('/system/backup/transfer', { path, removeSource }),
  /** 删掉某一份快照。要口令 */
  deleteBackup: (name) => api.delete(`/system/backup/${encodeURIComponent(name)}`),
  /** 恢复到指定快照：先留恢复前的凭证，再把快照灌回当前库，最后自动补结构。要口令 */
  restore: (name) => api.post('/system/restore', { name })
}

// 破坏性操作的管理口令（设置里的「安全」分区）
export const securityApi = {
  status: () => api.get('/security/status'),
  /** 不传 value 就是让后端随机生成；已有口令时必须带 current */
  set: (body) => api.post('/security/token', body),
  clear: (current) => api.delete('/security/token', { params: current ? { current } : {} })
}

// 数据源（地区 / 分类）管理：清单 + 引用计数，改名带级联
export const taxonomyApi = {
  get: () => api.get('/taxonomy'),
  save: (data) => api.post('/taxonomy', data)
}

// 系列相关API
export const seriesApi = {
  getList: (params) => api.get('/series', { params }),
  getDetail: (id) => api.get(`/series/${id}`),
  getCountries: () => api.get('/series/countries'),
  add: (data) => api.post('/series', data),
  update: (id, data) => api.put(`/series/${id}`, data),
  delete: (id) => api.delete(`/series/${id}`),
  getVideos: (id, params) => api.get(`/series/${id}/videos`, { params }),
  updateSort: (id, data) => api.post(`/series/${id}/sort`, data)
}

// 文件目录相关API
export const scanDirectoryApi = {
  getList: () => api.get('/scanDirectory'),
  add: (data) => api.post('/scanDirectory', data),
  update: (id, data) => api.put(`/scanDirectory/${id}`, data),
  delete: (id) => api.delete(`/scanDirectory/${id}`),
}

export const uploadApi = {
  uploadVideo: (directory, file, onProgress) => {
    const formData = new FormData()
    formData.append('directory', directory)
    formData.append('file', file)
    return uploadAxios.post('/upload/video', formData, onProgress ? { onUploadProgress: onProgress } : {})
  },
  uploadCover: (directory, file, onProgress) => {
    const formData = new FormData()
    formData.append('directory', directory)
    formData.append('file', file)
    return uploadAxios.post('/upload/cover', formData, onProgress ? { onUploadProgress: onProgress } : {})
  }
}

export const friendLinkApi = {
  getList: () => api.get('/FriendLink'),
  add: (data) => api.post('/FriendLink', data),
  update: (id, data) => api.put(`/FriendLink/${id}`, data),
  delete: (id) => api.delete(`/FriendLink/${id}`),
  /** 整列顺序一次提交：ids 是界面上从上到下的 id 顺序，后端重排成 1..N 并回改动条数 */
  sort: (ids) => api.post('/FriendLink/sort', ids)
}

export default api
