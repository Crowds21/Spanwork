/**
 * 侧栏内容：主导航 + 按类型分组的项目列表（桌面侧栏与移动 drawer 共用）
 */
import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Home,
  ListFilter,
  ListTodo,
  Repeat2,
  Settings,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ProjectDto, ProjectType } from '@spanwork/shared-types';

import { SidebarProjectFilterDialog } from '@/components/layout/SidebarProjectFilterDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { projectTypeLabelI18n } from '@/lib/i18n/projectType';
import { useT } from '@/lib/i18n/useT';
import { isTauri } from '@/lib/tauri/env';
import { listProjects } from '@/lib/tauri/project';
import {
  applySidebarProjectFilter,
  isSidebarFilterActive,
  readSidebarGroupCollapsed,
  readSidebarProjectFilter,
  storeSidebarGroupCollapsed,
  storeSidebarProjectFilter,
  type SidebarProjectFilter,
} from '@/lib/sidebarPreferences';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface SidebarContentProps {
  onNavigate?: () => void;
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight className="size-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ProjectNavItem({
  project,
  onNavigate,
}: {
  project: ProjectDto;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === `/projects/${project.id}`;
  const Icon = project.projectType === 'habit' ? Repeat2 : ListTodo;
  const color = project.color ?? undefined;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      onClick={onNavigate}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      )}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-sidebar-border bg-background"
        style={color ? { borderColor: color, color } : undefined}
      >
        <Icon className="size-3" />
      </span>
      <span className="flex-1 truncate">{project.name}</span>
    </Link>
  );
}

function ProjectGroup({
  label,
  icon: Icon,
  projectType,
  projects,
  emptyHint,
  onNavigate,
}: {
  label: string;
  icon: LucideIcon;
  projectType: ProjectType;
  projects: ProjectDto[];
  emptyHint: string;
  onNavigate?: () => void;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(() => readSidebarGroupCollapsed(projectType));
  const [filter, setFilter] = useState<SidebarProjectFilter>(() =>
    readSidebarProjectFilter(projectType),
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredProjects = applySidebarProjectFilter(projects, filter);
  const filterActive = isSidebarFilterActive(filter);

  function handleCollapsedChange(next: boolean) {
    setCollapsed(next);
    storeSidebarGroupCollapsed(projectType, next);
  }

  function handleFilterSave(next: SidebarProjectFilter) {
    setFilter(next);
    storeSidebarProjectFilter(projectType, next);
  }

  return (
    <>
      <Collapsible open={!collapsed} onOpenChange={(open) => handleCollapsedChange(!open)}>
        <div className="flex items-center gap-0.5">
          <CollapsibleTrigger
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="flex-1 truncate text-left">{label}</span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 opacity-60 transition-transform',
                collapsed && '-rotate-90',
              )}
            />
          </CollapsibleTrigger>
          <button
            type="button"
            className={cn(
              'relative flex size-7 shrink-0 items-center justify-center rounded-md outline-none transition-colors',
              'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              filterActive && 'text-primary',
            )}
            aria-label={t('nav.filterProjects', { type: label })}
            onClick={() => setFilterOpen(true)}
          >
            <ListFilter className="size-3.5" />
            {filterActive && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
            )}
          </button>
        </div>
        <CollapsibleContent className="space-y-0.5 pt-1">
          {filteredProjects.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground/80">
              {projects.length === 0 ? emptyHint : t('nav.noMatchingProjects')}
            </p>
          ) : (
            filteredProjects.map((project) => (
              <ProjectNavItem key={project.id} project={project} onNavigate={onNavigate} />
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      <SidebarProjectFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        groupLabel={label}
        projectType={projectType}
        filter={filter}
        onSave={handleFilterSave}
      />
    </>
  );
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const t = useT();
  const inTauri = isTauri();

  const mainNav = useMemo(
    () =>
      [
        { to: '/', label: t('nav.today'), icon: Home, exact: true },
        { to: '/projects', label: t('nav.projects'), icon: FolderKanban, exact: false },
        { to: '/calendar', label: t('nav.globalCalendar'), icon: CalendarClock, exact: false },
        { to: '/settings', label: t('nav.settings'), icon: Settings, exact: false },
      ] as const,
    [t],
  );

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects({ status: 'active', sortBy: 'updated', sortOrder: 'desc' }),
    queryFn: () =>
      listProjects({ status: 'active', sortBy: 'updated', sortOrder: 'desc' }),
    enabled: inTauri,
  });

  const projects = projectsQuery.data ?? [];
  const aimProjects = projects.filter((p) => p.projectType === 'aim');
  const habitProjects = projects.filter((p) => p.projectType === 'habit');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pt-safe pb-safe">
      <nav className="space-y-0.5">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="space-y-4">
        {projectsQuery.isLoading && inTauri ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <>
            <ProjectGroup
              label={projectTypeLabelI18n('aim', t)}
              icon={ListTodo}
              projectType="aim"
              projects={aimProjects}
              emptyHint={t('nav.emptyAimProjects')}
              onNavigate={onNavigate}
            />
            <ProjectGroup
              label={projectTypeLabelI18n('habit', t)}
              icon={Repeat2}
              projectType="habit"
              projects={habitProjects}
              emptyHint={t('nav.emptyHabitProjects')}
              onNavigate={onNavigate}
            />
          </>
        )}
      </div>
    </div>
  );
}
