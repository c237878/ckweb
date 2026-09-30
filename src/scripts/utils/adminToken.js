/**
 * 破坏性操作的管理口令，只存在这台设备的浏览器里。
 *
 * 服务端只存哈希前的原值、也只在这一次生成时回显（之后接口只给掩码），
 * 所以换设备/清缓存后要重新粘一次——这是有意的：口令的意义就是"不是这台设备默认就能删"。
 */
const KEY = '***'

export function getAdminToken() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    // 隐私模式或存储被禁用：当成"没配口令"，让请求不带头，由服务端的 401 提示人
    return ''
  }
}

export function setAdminToken(value) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    /* 存不进去也不影响本页面继续用内存里的值 */
  }
}
