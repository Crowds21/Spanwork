/**
 * 项目列表卡片：分类色图标、进度与类型差异化指标
 */
import { Link } from '@tanstack/react-router';
import { Flag, ListTodo, Repeat2 } from 'lucide-react';
import type { ProjectListItemDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import { projectTypeLabelI18n } from '@/lib/i18n/projectType';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: ProjectListItemDto;
}

function projectAccentColor(project: ProjectListItemDto): string | undefined {
  return project.color ?? project.categoryColor ?? undefined;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useT();
  const accent = projectAccentColor(project);
  const Icon = project.projectType === 'habit' ? Repeat2 : ListTodo;
  const isArchived = project.status === 'archived';

  const taskCount = project.taskCount ?? 0;
  const doneCount = project.doneTaskCount ?? 0;
  const progressPct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const totalTime = project.totalTimeSeconds ?? 0;
  const openMilestones = project.openMilestoneCount ?? 0;
  const habitRules = project.habitRuleCount ?? 0;

  const metaParts: string[] = [];
  if (project.categoryName) metaParts.push(project.categoryName);
  metaParts.push(
    t('projects.updatedRelative', { time: formatRelativeTime(project.updatedAt) }),
  );

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className={cn('block h-full', isArchived && 'opacity-75')}
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background"
              style={accent ? { color: accent } : undefined}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate font-semibold leading-tight" title={project.name}>
                  {project.name}
                </h3>
                <Badge
                  variant={project.projectType === 'aim' ? 'default' : 'habit'}
                  className="shrink-0 text-[10px]"
                >
                  {projectTypeLabelI18n(project.projectType, t)}
                </Badge>
              </div>
              <p
                className="truncate text-xs text-muted-foreground"
                title={formatRelativeTime(project.updatedAt)}
              >
                {metaParts.join(' · ')}
                {isArchived && (
                  <>
                    {' · '}
                    <span>{t('projectStatus.archived')}</span>
                  </>
                )}
              </p>
              {project.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>

          <div className="border-t pt-3">
            {project.projectType === 'aim' ? (
              <div className="space-y-2">
                {taskCount > 0 ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('projects.cardProgress', { done: doneCount, total: taskCount })}
                      {totalTime > 0 && (
                        <>
                          {' · '}
                          {formatDuration(totalTime)}
                        </>
                      )}
                      {openMilestones > 0 && (
                        <>
                          {' · '}
                          <span className="inline-flex items-center gap-0.5">
                            <Flag className="size-3" />
                            {t('projects.cardOpenMilestones', { count: openMilestones })}
                          </span>
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('projects.cardNoTasks')}
                    {totalTime > 0 && (
                      <>
                        {' · '}
                        {formatDuration(totalTime)}
                      </>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('projects.rulesCount', { count: habitRules })}
                {totalTime > 0 && (
                  <>
                    {' · '}
                    {t('projects.cardTotalTime', { time: formatDuration(totalTime) })}
                  </>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
