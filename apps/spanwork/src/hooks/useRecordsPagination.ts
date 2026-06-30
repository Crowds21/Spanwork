/**
 * 可折叠记录列表的分页状态管理（纯 UI 逻辑，无 IPC）
 *
 * 用于 Dialog 内「打卡记录 / 时间记录」等表格：在数据条数变化时自动钳制页码，
 * 避免删除最后一页最后一条后仍停留在空页。
 *
 * @example
 * ```tsx
 * const { pagedItems, safePage, totalPages, ...pagination } = useRecordsPagination(
 *   sortedOccurrences,
 *   { pageSize: 10, resetWhen: [open, ruleId] },
 * );
 * ```
 */
import { useEffect, useMemo, useState } from 'react';

export interface UseRecordsPaginationOptions {
  /** 每页条数 */
  pageSize: number;
  /**
   * 当这些依赖变化时，将页码重置为 0 并展开列表。
   * 典型值：`[open, entityId]` — 弹窗重新打开或切换实体时回到第一页。
   */
  resetWhen: readonly unknown[];
}

export function useRecordsPagination<T>(
  items: readonly T[],
  { pageSize, resetWhen }: UseRecordsPaginationOptions,
) {
  const [recordsOpen, setRecordsOpen] = useState(true);
  const [recordsPage, setRecordsPage] = useState(0);

  // 弹窗开关 / 实体切换时回到第一页，避免沿用上一实体的页码
  useEffect(() => {
    setRecordsPage(0);
    setRecordsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetWhen 由调用方显式传入
  }, resetWhen);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(recordsPage, totalPages - 1);

  const pagedItems = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize],
  );

  // 数据缩短后（如删除记录）钳制当前页，防止 safePage 指向空切片
  useEffect(() => {
    if (recordsPage > totalPages - 1) {
      setRecordsPage(Math.max(0, totalPages - 1));
    }
  }, [recordsPage, totalPages]);

  return {
    /** 折叠区是否展开 */
    recordsOpen,
    setRecordsOpen,
    /** 原始页码（可能超出范围，展示时请用 safePage） */
    recordsPage,
    setRecordsPage,
    /** 钳制后的安全页码，用于分页 UI 与切片 */
    safePage,
    totalPages,
    /** 当前页数据切片 */
    pagedItems,
    /** 全量条数，用于 Badge 展示 */
    totalCount: items.length,
  };
}
