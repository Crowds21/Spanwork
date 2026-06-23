/**
 * 桌面侧栏：shadcn Sidebar 风格 — 主导航 + 按类型分组的项目列表
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
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ProjectDto, ProjectType } from '@spanwork/shared-types';

import { SidebarProjectFilterDialog } from '@/components/layout/SidebarProjectFilterDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
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

const mainNav = [
  { to: '/', label: '今日', icon: Home, exact: true },
  { to: '/projects', label: '项目', icon: FolderKanban, exact: false },
  { to: '/calendar', label: '全局日历', icon: CalendarClock, exact: false },
  { to: '/settings', label: '设置', icon: Settings, exact: false },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
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

function ProjectNavItem({ project }: { project: ProjectDto }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === `/projects/${project.id}`;
  const Icon = project.projectType === 'habit' ? Repeat2 : ListTodo;
  const color = project.color ?? undefined;

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
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
}: {
  label: string;
  icon: LucideIcon;
  projectType: ProjectType;
  projects: ProjectDto[];
  emptyHint: string;
}) {
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
            aria-label={`筛选${label}项目`}
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
              {projects.length === 0 ? emptyHint : '无符合筛选条件的项目'}
            </p>
          ) : (
            filteredProjects.map((project) => (
              <ProjectNavItem key={project.id} project={project} />
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

export function AppSidebar() {
  const inTauri = isTauri();
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects({ status: 'active', sortBy: 'updated', sortOrder: 'desc' }),
    queryFn: () =>
      listProjects({ status: 'active', sortBy: 'updated', sortOrder: 'desc' }),
    enabled: inTauri,
  });

  const projects = projectsQuery.data ?? [];
  const taskProjects = projects.filter((p) => p.projectType === 'task');
  const habitProjects = projects.filter((p) => p.projectType === 'habit');

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <nav className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItem key={item.to} {...item} />
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
                label="任务式"
                icon={ListTodo}
                projectType="task"
                projects={taskProjects}
                emptyHint="暂无任务式项目"
              />
              <ProjectGroup
                label="习惯式"
                icon={Repeat2}
                projectType="habit"
                projects={habitProjects}
                emptyHint="暂无习惯式项目"
              />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
