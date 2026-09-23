/**
 * 规范列表（地区、分类）转成 SelectList 的选项。
 *
 * currentValue 不在列表里时并入：管理员可能把某个仍被历史记录使用的值从规范列表里删掉，
 * 若直接不给选项，编辑那条记录保存后就会悄悄丢字段。
 */
export function toOptions(list, currentValue) {
  const values = [...(list || [])]
  if (currentValue && !values.includes(currentValue)) values.push(currentValue)
  return values.map((v) => ({ value: v, label: v }))
}
