//! 跨设备确定性 ID（同步用）。

use uuid::{uuid, Uuid};

/// Spanwork 习惯实例命名空间 UUID。
const HABIT_OCCURRENCE_NS: Uuid = uuid!("6ba7b810-9dad-11d1-80b4-00c04fd430c8");

/// 同一 `(project_id, rule_id, scheduled_date)` 在任意设备生成相同 id。
pub fn deterministic_occurrence_id(project_id: &str, rule_id: &str, scheduled_date: &str) -> String {
    let name = format!("{project_id}:{rule_id}:{scheduled_date}");
    Uuid::new_v5(&HABIT_OCCURRENCE_NS, name.as_bytes()).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_occurrence_id_is_stable() {
        let a = deterministic_occurrence_id("p1", "r1", "2026-06-24");
        let b = deterministic_occurrence_id("p1", "r1", "2026-06-24");
        let c = deterministic_occurrence_id("p1", "r1", "2026-06-25");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
