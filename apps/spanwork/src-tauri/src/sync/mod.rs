//! 局域网 FLM 同步：协议、会话、发现、merge。
//!
//! 业务同步约定与开发指南见本目录 [`README.md`](README.md)。
//! 团队术语（FLM、FK、骨架等）见 [`../../GLOSSARY.md`](../../GLOSSARY.md)。

pub mod backfill;
pub mod discovery;
pub mod log;
pub mod net_addr;
pub mod listener;
pub mod merge;
pub mod pairing;
pub mod protocol;
pub mod probe;
pub mod registry;
pub mod session;
pub mod triggers;
pub mod versions;
