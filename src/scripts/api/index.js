import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 0, // 无超时限制
  headers: {
    'Content-Type': 'application/json'
  }
})

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

// 响应拦截器：与 api 实例保持一致
uploadAxios.interceptors.response.use(
  response => response.data,
  error => {
    console.error('Upload API Error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
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
  getStreamUrl: (id) => `/api/video/stream/${id}`,
  getCoverUrl: (id) => `/api/video/cover/${id}`,
  checkSubtitle: (code) => api.get(`/video/${code}/subtitle/check`),
  getMeta: () => api.get('/video/meta'),
  /** 首页分类板块：一次请求取代按分类各发一次 list */
  getHomeSections: () => api.get('/video/home-sections'),
  getAutoCode: () => api.get('/video/autocode'),
  like: (id) => api.post(`/video/${id}/like`),
  resetFileSize: (id) => api.post(`/video/${id}/reset-file-size`),
  /** 片源两维：dim = 'subtitle' | 'watermark'，一次只改一维 */
  updateSource: (id, patch) => api.put(`/video/${id}/source`, patch),
  /** 读这条影片的文件头量分辨率（字幕与广告水印不参与扫描，由人工标） */
  scanOne: (id) => api.post(`/video/${id}/scan`),
  /** 全站扫描：任务在服务端后台跑，force=true 连量过的一起重扫 */
  startScanAll: (force = false) => api.post('/video/scan/all', null, { params: { force } }),
  scanStatus: () => api.get('/video/scan/status'),
  stopScanAll: () => api.delete('/video/scan/all'),  deleteVideoFile: (id) => api.delete(`/video/${id}/file`),
  updateFileInfo: (id, data) => api.put(`/video/${id}/file-info`, data),
  getLikeStats: (year, month) => api.get('/video/likes/stats', { params: { year, month } }),
  getDailyRecommend: (count, refresh = false) => api.get('/video/daily-recommend', { params: { count, refresh } }),
  getRecentlyLiked: (count) => api.get('/video/recently-liked', { params: { count } }),
  getTopLiked: (count) => api.get('/video/top-liked', { params: { count } }),
  renameToCode: () => api.post('/video/rename-to-code'),
  setLinks: (id, links) => api.put(`/video/${id}/links`, { links }),
  /** 只改原名与发行日期；整份 PUT /video/{id} 会连封面路径一起按传入值写，不敢用它 */
  setMeta: (id, body) => api.put(`/video/${id}/meta`, body),
}

// 抓取通道：去哪查 / 怎么抽 / 要多礼貌，全在设置页里配
export const scrapeApi = {
  channels: () => api.get('/scrape/channel'),
  saveChannel: (body) => api.put('/scrape/channel', body),
  deleteChannel: (id) => api.delete(`/scrape/channel/${id}`),
  resetChannel: (id) => api.post(`/scrape/channel/${id}/reset`),
  testChannel: (id, params) => api.post(`/scrape/channel/${id}/test`, null, { params }),
  applyChannel: (id, entityId) => api.post(`/scrape/channel/${id}/apply`, null, { params: { entityId } })
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
  /** 把艳图目录里的图片扫进 actor_images；不传 id 就是扫全部演员。清单本身由详情接口带出 */
  syncImages: (id) => api.post(id ? `/actor/${id}/images/sync` : '/actor/images/sync'),
  /** 指定列表页那张脸用哪张图 */
  setPrimaryImage: (id, fileName) => api.put(`/actor/${id}/image/primary`, { fileName }),
  /** 给一位演员抓头像（只补头像，拿不准就什么都不做，返回里会说明原因）；src 见 ACTOR_SOURCES */
  fetchAvatar: (id, src) => api.post(`/actor/${id}/avatar/fetch`, null, { params: { src } }),
  /** 给一位演员抓资料：av-wiki 是生日与简介，老师图鉴是生日与别名，都只填当前空着的字段 */
  fetchProfile: (id, src) => api.post(`/actor/${id}/profile/fetch`, null, { params: { src } }),
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
  delete: (id) => api.delete(`/FriendLink/${id}`)
}

export default api
