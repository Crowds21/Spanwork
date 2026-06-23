/**
 * 全局计时顶栏入口
 *
 * - TimerBarProvider：共享计时状态与 UI 模式
 * - TimerBarExpanded：展开浮层（fixed，iOS 需 safe area 内边距）
 * - TimerBarStatusStrip：收缩顶栏（全宽文档流；移动端禁止横向滚动溢出）
 */
export { TimerBarProvider, useTimerBar } from '@/components/timer/TimerBarContext';
export { TimerBarExpanded } from '@/components/timer/TimerBarExpanded';
export { TimerBarStatusStrip } from '@/components/timer/TimerBarStatusStrip';
export { TimerButton, TaskTimerControls } from '@/components/timer/TaskTimerControls';
