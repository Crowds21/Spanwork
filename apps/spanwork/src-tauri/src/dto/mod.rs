//! 前后端共享数据结构，serde 序列化/反序列化，字段统一 camelCase。
//! 包含各实体的 DTO、Input/Params 类型与 ProjectType、TaskStatus 等枚举。
//! 枚举与术语说明见 `apps/spanwork/GLOSSARY.md`。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDto {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoDto {
    pub version: String,
    pub schema_version: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectType {
    Aim,
    Habit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Active,
    Archived,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub project_type: ProjectType,
    pub status: ProjectStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_end_date: Option<String>,
    pub sort_order: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_color: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHabitRuleInput {
    pub title: Option<String>,
    pub sort_order: Option<i64>,
    pub frequency: Option<HabitFrequency>,
    pub days_of_week: Option<Vec<i32>>,
    pub day_of_month: Option<i32>,
    pub days_of_month: Option<Vec<i32>>,
    pub month_and_day: Option<String>,
    pub yearly_dates: Option<Vec<String>>,
    pub why: Option<String>,
    pub celebration_messages: Option<Vec<String>>,
    pub target_duration_seconds: Option<i64>,
    pub minimum_duration_seconds: Option<i64>,
    pub ability_tips: Option<String>,
    pub anchor_time: Option<String>,
    pub anchor_habit: Option<String>,
    pub behavior_design_enabled: Option<bool>,
    pub celebration_on_complete: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub project_type: ProjectType,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub start_date: Option<String>,
    pub target_end_date: Option<String>,
    pub category_id: Option<String>,
    pub habit_rule: Option<CreateHabitRuleInput>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListParams {
    pub status: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub category_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetailDto {
    #[serde(flatten)]
    pub project: ProjectDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_time_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_milestone_count: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<ProjectStatus>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub start_date: Option<String>,
    pub target_end_date: Option<String>,
    pub sort_order: Option<i64>,
    pub category_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUpdateParams {
    pub id: String,
    pub patch: UpdateProjectInput,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectReorderParams {
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCategoryDto {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub sort_order: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_count: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectCategoryInput {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectCategoryInput {
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCategoryUpdateParams {
    pub id: String,
    pub patch: UpdateProjectCategoryInput,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCategoryReorderParams {
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: String,
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub milestone_id: Option<String>,
    pub is_milestone: bool,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    pub tags: Vec<String>,
    pub sort_order: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub child_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_child_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_time_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_trackable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timer_startable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    pub behavior_design_enabled: bool,
    pub celebration_on_complete: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskListParams {
    pub project_id: String,
    pub parent_id: Option<Option<String>>,
    #[serde(default)]
    pub include_subtasks: bool,
    pub milestone_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub milestone_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i64>,
    pub due_date: Option<String>,
    pub start_date: Option<String>,
    pub tags: Option<Vec<String>>,
    pub sort_order: Option<i64>,
    #[serde(default)]
    pub is_milestone: bool,
    pub behavior_design_enabled: Option<bool>,
    pub celebration_on_complete: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub priority: Option<i64>,
    pub due_date: Option<String>,
    pub start_date: Option<String>,
    pub tags: Option<Vec<String>>,
    pub parent_id: Option<String>,
    pub milestone_id: Option<Option<String>>,
    pub sort_order: Option<i64>,
    pub is_milestone: Option<bool>,
    pub behavior_design_enabled: Option<bool>,
    pub celebration_on_complete: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdateParams {
    pub id: String,
    pub patch: UpdateTaskInput,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskReorderParams {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub ordered_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskBatchCompleteParams {
    pub ids: Vec<String>,
    pub status: TaskBatchStatus,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskBatchStatus {
    Done,
    Todo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskBatchCompleteResult {
    pub updated: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MilestoneStatus {
    NotStarted,
    InProgress,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneDto {
    pub id: String,
    pub project_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_date: Option<String>,
    pub status: MilestoneStatus,
    pub sort_order: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_count: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneListParams {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMilestoneInput {
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub target_date: Option<String>,
    pub status: Option<MilestoneStatus>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMilestoneInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub target_date: Option<String>,
    pub status: Option<MilestoneStatus>,
    pub sort_order: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneUpdateParams {
    pub id: String,
    pub patch: UpdateMilestoneInput,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MilestoneLinkType {
    Task,
    #[serde(rename = "habit_occurrence")]
    HabitOccurrence,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneLinkInput {
    pub link_type: MilestoneLinkType,
    pub link_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneLinkSetParams {
    pub milestone_id: String,
    pub links: Vec<MilestoneLinkInput>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimeTargetType {
    Task,
    #[serde(rename = "habit_occurrence")]
    HabitOccurrence,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimeEntrySource {
    Timer,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntryDto {
    pub id: String,
    pub project_id: String,
    pub target_type: TimeTargetType,
    pub target_id: String,
    pub start_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_at: Option<i64>,
    pub duration_seconds: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub source: TimeEntrySource,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntryListParams {
    pub project_id: Option<String>,
    pub target_type: Option<TimeTargetType>,
    pub target_id: Option<String>,
    pub from_ms: Option<i64>,
    pub to_ms: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeEntryInput {
    pub project_id: String,
    pub target_type: TimeTargetType,
    pub target_id: String,
    pub start_at: Option<i64>,
    pub end_at: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimeEntryInput {
    pub start_at: Option<i64>,
    pub end_at: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntryUpdateParams {
    pub id: String,
    pub patch: UpdateTimeEntryInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTimerDto {
    pub project_id: String,
    pub target_type: TimeTargetType,
    pub target_id: String,
    pub session_started_at: i64,
    pub started_at: i64,
    pub accumulated_seconds: i64,
    pub is_paused: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub elapsed_seconds: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTimerInput {
    pub project_id: String,
    pub target_type: TimeTargetType,
    pub target_id: String,
    pub note: Option<String>,
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HabitOccurrenceStatus {
    Pending,
    Done,
    Skipped,
    Missed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitOccurrenceDto {
    pub id: String,
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_color: Option<String>,
    pub rule_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_title: Option<String>,
    pub scheduled_date: String,
    pub status: HabitOccurrenceStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rescheduled_from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_time_seconds: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayDashboardDto {
    pub active_timer: Option<ActiveTimerDto>,
    pub habit_occurrences_today: Vec<HabitOccurrenceDto>,
    pub recent_tasks: Vec<TaskDto>,
    pub total_time_today_seconds: i64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HabitFrequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitRuleDto {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub sort_order: i64,
    pub frequency: HabitFrequency,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_of_week: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub day_of_month: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_of_month: Option<Vec<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub month_and_day: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yearly_dates: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub why: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub celebration_messages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_duration_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimum_duration_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ability_tips: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_habit: Option<String>,
    pub behavior_design_enabled: bool,
    pub celebration_on_complete: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHabitRuleInput {
    pub title: Option<String>,
    pub sort_order: Option<i64>,
    pub frequency: Option<HabitFrequency>,
    pub days_of_week: Option<Vec<i32>>,
    pub day_of_month: Option<i32>,
    pub days_of_month: Option<Vec<i32>>,
    pub month_and_day: Option<String>,
    pub yearly_dates: Option<Vec<String>>,
    pub why: Option<String>,
    pub celebration_messages: Option<Vec<String>>,
    pub target_duration_seconds: Option<i64>,
    pub minimum_duration_seconds: Option<i64>,
    pub ability_tips: Option<String>,
    pub anchor_time: Option<String>,
    pub anchor_habit: Option<String>,
    pub behavior_design_enabled: Option<bool>,
    pub celebration_on_complete: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitRuleUpdateParams {
    pub rule_id: String,
    pub patch: UpdateHabitRuleInput,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitRuleCreateParams {
    pub project_id: String,
    pub input: CreateHabitRuleInput,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HabitOccurrenceListParams {
    pub project_id: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitOccurrenceEnsureParams {
    pub from_date: String,
    pub to_date: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHabitOccurrenceInput {
    pub status: Option<HabitOccurrenceStatus>,
    pub scheduled_date: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitOccurrenceUpdateParams {
    pub id: String,
    pub patch: UpdateHabitOccurrenceInput,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TimeBlockDisplayMode {
    Interval,
    Marker,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDayParams {
    pub date: String,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarRangeParams {
    pub from_date: String,
    pub to_date: String,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarTimeBlockDto {
    pub id: String,
    pub project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    pub target_type: TimeTargetType,
    pub target_id: String,
    pub title: String,
    pub start_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_at: Option<i64>,
    pub duration_seconds: i64,
    pub source: TimeEntrySource,
    pub display_mode: TimeBlockDisplayMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDayDto {
    pub date: String,
    pub occurrences: Vec<HabitOccurrenceDto>,
    pub time_blocks: Vec<CalendarTimeBlockDto>,
    pub active_timer: Option<ActiveTimerDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDaySummaryDto {
    pub date: String,
    pub pending_count: i64,
    pub done_count: i64,
    pub total_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarRangeDto {
    pub days: Vec<CalendarDaySummaryDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitStreakDto {
    pub rule_id: String,
    pub current_streak: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteLogInput {
    pub level: String,
    pub target: String,
    pub message: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerInfoDto {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub host: String,
    pub port: u16,
    pub last_seen_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_change_seq: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<i64>,
}

impl From<crate::sync::discovery::DiscoveredPeer> for PeerInfoDto {
    fn from(peer: crate::sync::discovery::DiscoveredPeer) -> Self {
        Self {
            device_id: peer.device_id,
            device_name: peer.device_name,
            platform: peer.platform,
            host: peer.host,
            port: peer.port,
            last_seen_at: peer.last_seen_at,
            last_change_seq: None,
            last_sync_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDiscoveryStatusDto {
    pub active: bool,
    pub port: u16,
    pub peers: Vec<PeerInfoDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_sync_hosts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_peer_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_hotspot: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPairingDto {
    pub code: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgressDto {
    pub phase: String,
    pub percent: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResultDto {
    pub peer_device_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peer_device_name: Option<String>,
    pub records_sent: i32,
    pub records_received: i32,
    pub acked_change_seq: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

impl SyncResultDto {
    pub fn success(
        peer_device_id: String,
        peer_device_name: Option<String>,
        records_sent: i32,
        records_received: i32,
        acked_change_seq: i64,
    ) -> Self {
        Self {
            peer_device_id,
            peer_device_name,
            records_sent,
            records_received,
            acked_change_seq,
            status: Some("success".into()),
            error_message: None,
        }
    }

    pub fn failed(
        peer_device_id: String,
        peer_device_name: Option<String>,
        message: String,
    ) -> Self {
        Self {
            peer_device_id,
            peer_device_name,
            records_sent: 0,
            records_received: 0,
            acked_change_seq: 0,
            status: Some("failed".into()),
            error_message: Some(message),
        }
    }

    pub fn cancelled(peer_device_id: String, peer_device_name: Option<String>) -> Self {
        Self {
            peer_device_id,
            peer_device_name,
            records_sent: 0,
            records_received: 0,
            acked_change_seq: 0,
            status: Some("cancelled".into()),
            error_message: None,
        }
    }
}

pub type SyncSessionLogDto = crate::db::repos::sync_session::SyncSessionLogDto;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStartParams {
    pub peer_device_id: String,
    #[serde(default)]
    pub peer_device_name: Option<String>,
    pub host: String,
    pub port: u16,
    pub pairing_code: String,
}
