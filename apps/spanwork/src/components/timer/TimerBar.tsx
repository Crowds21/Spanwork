/**
 * 全局计时顶栏入口
 *
 * - TimerBarProvider：共享计时状态与 UI 模式
 * - TimerBarExpanded：展开浮层（fixed，遮挡内容）
 * - TimerBarStatusStrip：收缩顶栏（全宽文档流，推开侧边栏与主内容）
 */
export { TimerBarProvider, useTimerBar } from '@/components/timer/TimerBarContext';
export { TimerBarExpanded } from '@/components/timer/TimerBarExpanded';
export { TimerBarStatusStrip } from '@/components/timer/TimerBarStatusStrip';
export { TimerButton, TaskTimerControls } from '@/components/timer/TaskTimerControls';
