//! 数据库层入口，导出连接池初始化函数 `init_db`。
//! 子模块 migrate 负责 schema 版本迁移，repos 封装各实体的 SQL 访问。

pub mod migrate;
pub mod pool;
pub mod repos;
pub mod sync_log;

pub use pool::init_db;
