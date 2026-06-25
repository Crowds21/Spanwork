//! 6 位配对码与会话 token。

use std::sync::Mutex;

use crate::error::{new_id, now_ms, AppError, AppResult};

const PAIRING_TTL_MS: i64 = 300_000;
const MAX_FAILS: u32 = 5;
const LOCKOUT_MS: i64 = 60_000;

pub struct PairingState {
    pub display_code: Option<String>,
    pub expires_at: i64,
    pub session_token: Option<String>,
    pub session_expires_at: i64,
    fail_count: u32,
    locked_until: i64,
}

impl Default for PairingState {
    fn default() -> Self {
        Self {
            display_code: None,
            expires_at: 0,
            session_token: None,
            session_expires_at: 0,
            fail_count: 0,
            locked_until: 0,
        }
    }
}

pub struct PairingManager {
    inner: Mutex<PairingState>,
}

impl PairingManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(PairingState::default()),
        }
    }

    pub fn generate_display_code(&self) -> AppResult<String> {
        let mut g = self.inner.lock().map_err(|_| AppError::Internal("pair lock".into()))?;
        let code = format!("{:06}", rand::random::<u32>() % 1_000_000);
        g.display_code = Some(code.clone());
        g.expires_at = now_ms() + PAIRING_TTL_MS;
        g.fail_count = 0;
        Ok(code)
    }

    pub fn current_display_code(&self) -> Option<String> {
        let g = self.inner.lock().ok()?;
        if now_ms() <= g.expires_at {
            g.display_code.clone()
        } else {
            None
        }
    }

    pub fn verify_and_issue_token(&self, code: &str) -> AppResult<(String, i64)> {
        let mut g = self.inner.lock().map_err(|_| AppError::Internal("pair lock".into()))?;
        let now = now_ms();
        if now < g.locked_until {
            return Err(AppError::Sync {
                code: "PAIRING_LOCKED".into(),
                message: "配对失败次数过多，请稍后再试".into(),
            });
        }
        let Some(expected) = g.display_code.as_ref() else {
            return Err(AppError::Sync {
                code: "PAIRING_NO_CODE".into(),
                message: "本机未展示配对码".into(),
            });
        };
        if now > g.expires_at {
            return Err(AppError::Sync {
                code: "PAIRING_EXPIRED".into(),
                message: "配对码已过期".into(),
            });
        }
        if expected != code {
            g.fail_count += 1;
            if g.fail_count >= MAX_FAILS {
                g.locked_until = now + LOCKOUT_MS;
            }
            return Err(AppError::Sync {
                code: "PAIRING_FAILED".into(),
                message: "配对码错误".into(),
            });
        }
        let token = new_id();
        let exp = now + PAIRING_TTL_MS;
        g.session_token = Some(token.clone());
        g.session_expires_at = exp;
        g.display_code = None;
        g.fail_count = 0;
        Ok((token, exp))
    }

    pub fn validate_session_token(&self, token: &str) -> AppResult<()> {
        let g = self.inner.lock().map_err(|_| AppError::Internal("pair lock".into()))?;
        if now_ms() > g.session_expires_at {
            return Err(AppError::Sync {
                code: "SESSION_EXPIRED".into(),
                message: "会话已过期".into(),
            });
        }
        if g.session_token.as_deref() != Some(token) {
            return Err(AppError::Sync {
                code: "SESSION_INVALID".into(),
                message: "会话无效".into(),
            });
        }
        Ok(())
    }
}

// 轻量随机，避免额外 crate；若冲突可换 rand crate
mod rand {
    use std::cell::Cell;
    use std::time::{SystemTime, UNIX_EPOCH};

    thread_local! {
        static SEED: Cell<u64> = Cell::new(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos() as u64,
        );
    }

    pub fn random<T: From<u32>>() -> T {
        SEED.with(|s| {
            let mut x = s.get();
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            s.set(x);
            T::from((x % 1_000_000) as u32)
        })
    }
}
