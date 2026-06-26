/**
 * 任务时间记录列表：桌面表格 + 移动端卡片栈
 */
import type { ActiveTimerDto, TimeEntryDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import {
  formatDateTime,
  formatDuration,
  formatDurationLive,
  timeEntrySourceLabels,
} from '@/lib/format';

interface TimeEntryListProps {
  entries: TimeEntryDto[];
  activeTimer?: ActiveTimerDto | null;
  activeElapsed: number;
  showActiveOnPage: boolean;
}

export function TimeEntryList({
  entries,
  activeTimer,
  activeElapsed,
  showActiveOnPage,
}: TimeEntryListProps) {
  const isEmpty = !showActiveOnPage && entries.length === 0 && !activeTimer;

  if (isEmpty) {
    return (
      <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
        暂无时间记录。点击「计时」或「补录」开始记录。
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">开始时间</th>
              <th className="px-3 py-2 font-medium">结束时间</th>
              <th className="px-3 py-2 font-medium">时长</th>
              <th className="px-3 py-2 font-medium">来源</th>
              <th className="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {showActiveOnPage && activeTimer && (
              <tr className="border-b bg-primary/5">
                <td className="px-3 py-2 tabular-nums">
                  {formatDateTime(activeTimer.sessionStartedAt)}
                </td>
                <td className="px-3 py-2 text-primary">
                  {activeTimer.isPaused ? '已暂停' : '计时中…'}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {formatDurationLive(activeElapsed)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">计时</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 tabular-nums">{formatDateTime(entry.startAt)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {entry.endAt != null ? formatDateTime(entry.endAt) : '—'}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {formatDuration(entry.durationSeconds)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">
                    {timeEntrySourceLabels[entry.source] ?? entry.source}
                  </Badge>
                </td>
                <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">
                  {entry.note ?? '—'}
                </td>
              </tr>
            ))}
            {!showActiveOnPage && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  本页暂无记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {showActiveOnPage && activeTimer && (
          <TimeEntryCard
            start={formatDateTime(activeTimer.sessionStartedAt)}
            end={activeTimer.isPaused ? '已暂停' : '计时中…'}
            duration={formatDurationLive(activeElapsed)}
            source="计时"
            note="—"
            highlight
          />
        )}
        {entries.map((entry) => (
          <TimeEntryCard
            key={entry.id}
            start={formatDateTime(entry.startAt)}
            end={entry.endAt != null ? formatDateTime(entry.endAt) : '—'}
            duration={formatDuration(entry.durationSeconds)}
            source={timeEntrySourceLabels[entry.source] ?? entry.source}
            note={entry.note ?? '—'}
          />
        ))}
        {!showActiveOnPage && entries.length === 0 && (
          <p className="rounded-lg border px-4 py-4 text-center text-sm text-muted-foreground">
            本页暂无记录
          </p>
        )}
      </div>
    </>
  );
}

function TimeEntryCard({
  start,
  end,
  duration,
  source,
  note,
  highlight,
}: {
  start: string;
  end: string;
  duration: string;
  source: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${highlight ? 'border-primary/30 bg-primary/5' : 'bg-card'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="tabular-nums text-muted-foreground">
            <span className="text-xs">开始</span> {start}
          </p>
          <p className={highlight ? 'text-primary' : 'tabular-nums text-muted-foreground'}>
            <span className="text-xs">结束</span> {end}
          </p>
        </div>
        <span className="shrink-0 font-mono text-base font-semibold tabular-nums">{duration}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{source}</Badge>
        {note !== '—' && <span className="min-w-0 truncate text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}
