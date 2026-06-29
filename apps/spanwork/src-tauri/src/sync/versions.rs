//! 应用启动时缓存的同步协议 / schema 版本（握手与探测共用，避免重复查库）。

use std::sync::RwLock;

use crate::sync::protocol::PROTOCOL_VERSION;

/// 与 [`HelloPayload`]、`schema_version()` 一致，使用 `i32`（非 `u32`）。
#[derive(Debug, Clone, Copy)]
pub struct SyncVersions {
    pub protocol_version: i32,
    pub schema_version: i32,
}

impl SyncVersions {
    pub fn new(schema_version: i32) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            schema_version,
        }
    }
}

#[derive(Debug, Default)]
pub struct SyncVersionCache {
    inner: RwLock<Option<SyncVersions>>,
}

impl SyncVersionCache {
    pub fn set(&self, versions: SyncVersions) {
        if let Ok(mut guard) = self.inner.write() {
            *guard = Some(versions);
        }
    }

    pub fn get(&self) -> Option<SyncVersions> {
        self.inner.read().ok().and_then(|guard| *guard)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_uses_protocol_constant_and_schema() {
        let v = SyncVersions::new(14);
        assert_eq!(v.protocol_version, PROTOCOL_VERSION);
        assert_eq!(v.schema_version, 14);
    }
}
