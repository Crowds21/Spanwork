//! 领域规则模块，纯业务逻辑不含 IO 框架依赖。
//! task_tree 管理任务层级，task_time 判定记时/计时器启动资格。

pub mod task_time;
pub mod task_tree;
