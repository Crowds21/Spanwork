/**
 * 习惯任务卡片列表
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Repeat2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { HabitRuleDto, ProjectDetailDto } from '@spanwork/shared-types';

import { HabitTaskCard } from '@/components/habit/HabitTaskCard';
import { HabitTaskDialog } from '@/components/habit/HabitTaskDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, todayDateKey } from '@/lib/calendarUtils';
import { getProgressPeriod, getWeekRange, latestProgressPeriodEnd } from '@/lib/habitUtils';
import {
  deleteHabitRule,
  ensureHabitOccurrences,
  listHabitOccurrences,
  listHabitRules,
} from '@/lib/tauri/habit';
import { isTauri } from '@/lib/tauri/env';
import { attemptTimerFocus, consumeTimerFocus } from '@/lib/timer/timerFocus';
import { queryKeys } from '@/queries/keys';

interface HabitTaskListProps {
  project: ProjectDetailDto;
  readOnly?: boolean;
}

export function HabitTaskList({ project, readOnly }: HabitTaskListProps) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const today = todayDateKey();
  const weekFrom = getWeekRange(today).from;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<HabitRuleDto | undefined>();
  const [deletingRule, setDeletingRule] = useState<HabitRuleDto | undefined>();

  const rulesQuery = useQuery({
    queryKey: queryKeys.habitRules(project.id),
    queryFn: () => listHabitRules(project.id),
    enabled: inTauri,
  });

  const rules = rulesQuery.data ?? [];
  const historyFrom = addDays(today, -365);
  const progressToDate = rules.length > 0 ? latestProgressPeriodEnd(rules, today) : today;

  const occurrencesQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(project.id, historyFrom, progressToDate),
    queryFn: () =>
      listHabitOccurrences({
        projectId: project.id,
        fromDate: historyFrom,
        toDate: progressToDate,
      }),
    enabled: inTauri && rules.length > 0,
  });

  const todayQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(project.id, today, today),
    queryFn: () =>
      listHabitOccurrences({
        projectId: project.id,
        fromDate: today,
        toDate: today,
      }),
    enabled: inTauri && rules.length > 0,
  });

  useEffect(() => {
    if (!inTauri || rules.length === 0) return;
    ensureHabitOccurrences({ fromDate: weekFrom, toDate: addDays(today, 90) }).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrences(project.id) });
    });
  }, [inTauri, project.id, today, weekFrom, rules.length, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteHabitRule(ruleId),
    meta: { errorSource: '删除习惯任务' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habitRules(project.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrences(project.id) });
      queryClient.invalidateQueries({ queryKey: ['calendar-day'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    },
  });

  const allOccurrences = occurrencesQuery.data ?? [];
  const todayOccurrences = todayQuery.data ?? [];

  const periodOccurrencesByRule = useMemo(() => {
    const map = new Map<string, typeof allOccurrences>();
    for (const rule of rules) {
      const { from, to } = getProgressPeriod(rule);
      map.set(
        rule.id,
        allOccurrences.filter((o) => o.ruleId === rule.id && o.scheduledDate >= from && o.scheduledDate <= to),
      );
    }
    return map;
  }, [allOccurrences, rules]);

  useEffect(() => {
    if (rules.length === 0) return;
    const focus = consumeTimerFocus();
    if (!focus || focus.targetType !== 'habit_occurrence') return;

    const resolveRuleId = (occurrenceId: string) => {
      const occ =
        todayOccurrences.find((item) => item.id === occurrenceId) ??
        allOccurrences.find((item) => item.id === occurrenceId);
      return occ?.ruleId;
    };

    const attempt = () => attemptTimerFocus(focus, resolveRuleId);
    window.requestAnimationFrame(() => {
      if (!attempt()) {
        window.setTimeout(attempt, 200);
      }
    });
  }, [rules.length, todayOccurrences, allOccurrences]);

  if (rulesQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载习惯任务失败</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>请检查网络或数据库后重试。</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => rulesQuery.refetch()}
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (rulesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Repeat2 className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">还没有习惯任务</p>
          <p className="mt-1 text-sm text-muted-foreground">
            添加第一条习惯，例如「每日晨跑」
          </p>
          {!readOnly && (
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              添加习惯任务
            </Button>
          )}
        </div>
        <HabitTaskDialog
          projectId={project.id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultTitle={project.name}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {rules.map((rule) => (
          <HabitTaskCard
            key={rule.id}
            rule={rule}
            project={project}
            periodOccurrences={periodOccurrencesByRule.get(rule.id) ?? []}
            historyOccurrences={allOccurrences.filter((o) => o.ruleId === rule.id)}
            todayOccurrences={todayOccurrences}
            readOnly={readOnly}
            onEdit={() => {
              setEditingRule(rule);
              setDialogOpen(true);
            }}
            onDelete={() => setDeletingRule(rule)}
          />
        ))}
      </div>

      {!readOnly && (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditingRule(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          添加习惯任务
        </Button>
      )}

      <HabitTaskDialog
        projectId={project.id}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRule(undefined);
        }}
        rule={editingRule}
        defaultTitle={project.name}
      />

      <ConfirmDialog
        open={Boolean(deletingRule)}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(undefined);
        }}
        title="删除习惯任务"
        description={
          deletingRule
            ? `确定删除「${deletingRule.title}」？相关打卡记录与时间记录将一并移除，此操作不可撤销。`
            : undefined
        }
        confirmLabel="删除"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingRule) {
            deleteMutation.mutate(deletingRule.id, {
              onSuccess: () => setDeletingRule(undefined),
            });
          }
        }}
      />
    </>
  );
}
