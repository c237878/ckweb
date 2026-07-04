// 筛选条件持久化工具

const PREFIX = 'ck_filter_'

/**
 * 从 localStorage 恢复筛选状态
 * @param {string} key - 页面标识（如 'video-list'）
 * @returns {object|null} 恢复的状态，或 null（首次访问）
 */
export function loadFilterState(key) {
    try {
        const raw = localStorage.getItem(PREFIX + key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

/**
 * 将筛选状态保存到 localStorage
 * @param {string} key - 页面标识
 * @param {object} state - 要保存的状态（会与旧状态深度合并）
 */
export function saveFilterState(key, state) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(state))
    } catch (e) {
        console.warn('saveFilterState failed:', e)
    }
}
