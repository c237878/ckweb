/**
 * 全站输入行为，两件事：
 *
 * 1. 点 label 不再把焦点（或点击）转给控件——只有点到控件本身才算数。
 *    下拉框是按钮实现的，原先点标题等于点按钮，会把列表展开出来，很意外。
 *    复选框/单选/文件选择保留"点标题即选中"，那是它们的常规用法。
 *
 * 2. 关掉浏览器的一聚焦就弹历史输入的下拉。
 *
 * 两处都收在这里而不是逐个元素写属性：全站四十多个输入框、三十多个 label，
 * 以后还会继续加字段，写在标记里一定会漏。
 */

/** 点 label 的行为要保留的控件类型 */
const KEEP_LABEL_ACTIVATION = new Set(['checkbox', 'radio', 'file'])

/** 浏览器会给出历史建议的类型，其余（date/color/checkbox…）不用打标 */
const AUTOFILLABLE = new Set(['text', 'search', 'tel', 'url', 'email', 'password', 'number'])

const isField = (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement

const disableAutofillOn = (root) => {
  const nodes = isField(root) ? [root] : [...root.querySelectorAll('input, textarea')]
  nodes.forEach((el) => {
    // 已经显式声明的（如 datalist 那个输入框）不覆盖
    if (el.hasAttribute('autocomplete')) return
    if (el.tagName === 'TEXTAREA' || AUTOFILLABLE.has(el.type)) el.setAttribute('autocomplete', 'off')
  })
}

const onClick = (event) => {
  if (!(event.target instanceof Element)) return

  const label = event.target.closest('label')
  if (!label) return

  const control = label.control
  if (!control || KEEP_LABEL_ACTIVATION.has(control.type)) return
  // 点的就是控件自己（或控件内部），照常响应
  if (control === event.target || control.contains(event.target)) return

  event.preventDefault()
}

export function setupInputBehavior() {
  disableAutofillOn(document.body)

  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) disableAutofillOn(node)
      })
    })
  }).observe(document.body, { childList: true, subtree: true })

  document.addEventListener('click', onClick)
}
