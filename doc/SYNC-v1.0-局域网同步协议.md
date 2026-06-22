# Spanwork — 局域网同步协议（SYNC v1.0）

| 项目 | 说明 |
|------|------|
| 模式 | 无主、对等、手动触发 |
| 发现 | mDNS / DNS-SD |
| 传输 | TCP + 长度前缀 JSON 帧 |
| 合并 | cr-sqlite changeset |
| 关联 | [SCHEMA v1.0](./SCHEMA-v1.0-数据库设计.md) · [API v1.0](./API-v1.0-Tauri-Commands.md) |

---

## 1. 概述

Spanwork 同步在**同一局域网**内，于两个已安装 App 的设备之间交换 SQLite changeset，无需公网、账号或第三方服务。

| 特性 | V1 |
|------|-----|
| 发现 | mDNS 服务 `_spanwork._tcp.local` |
| 连接 | TCP |
| 安全 | 6 位配对码 + 会话 token |
| 方向 | 默认双向（push + pull） |
| 合并 | cr-sqlite 自动 CRDT；失败降级 LWW |
| 并发 | 单设备同时仅一个 sync session |

---

## 2. 服务发现（mDNS）

### 2.1 服务注册

同步页面打开 `sync_discovery_start` 后，本机注册：

| 字段 | 值 |
|------|-----|
| 服务类型 | `_spanwork._tcp.local` |
| 实例名 | `Spanwork-{device_name}` |
| 端口 | 动态分配，默认范围 `19280–19289` |
| TXT 记录 | 见下表 |

**TXT 记录**：

| Key | 说明 | 示例 |
|-----|------|------|
| `ver` | 协议版本 | `1` |
| `did` | device_id | `01932a...` |
| `name` | 设备显示名 | `Crowds-MacBook` |
| `platform` | 平台 | `macos` |
| `dbv` | 当前 db_version | `1042` |

### 2.2 浏览

- 监听同类型服务实例出现/消失
- 解析 TXT + SRV → 得到 `host:port`
- 通过 Tauri Event `sync://discovered` 推送 `PeerInfo[]`
- 超时未浏览则 UI 提示「手动输入 IP」

### 2.3 手动连接

用户输入 `192.168.1.23:19280`，跳过 mDNS，直接进入 TCP 握手（仍需配对码）。

---

## 3. 传输层

### 3.1 连接

- **Client**：发起同步的一方（用户选中 peer 后）
- **Server**：被连接方在 `sync_discovery_start` 期间监听 TCP（或同步时临时 listen）

V1 简化：**双方均可 listen**；连接方向由 Client 主动 `connect(host, port)`。

### 3.2 帧格式

长度前缀 + UTF-8 JSON：

```
┌──────────────┬─────────────────────────┐
│ uint32 BE    │ JSON payload            │
│ byte length  │ (Message envelope)      │
└──────────────┴─────────────────────────┘
```

最大帧：4 MB（changeset 过大时拆分多帧 `changes_chunk`）。

### 3.3 消息信封

```typescript
interface SyncEnvelope {
  v: 1;                    // 协议版本
  type: SyncMessageType;
  msgId: string;           // UUID v7
  ts: number;              // 发送方 Unix ms
  payload: unknown;
}

type SyncMessageType =
  | 'hello'
  | 'hello_ack'
  | 'pair_request'
  | 'pair_challenge'
  | 'pair_response'
  | 'pair_ok'
  | 'pair_fail'
  | 'meta_exchange'
  | 'changes_request'
  | 'changes_chunk'
  | 'changes_done'
  | 'apply_ack'
  | 'session_done'
  | 'error';
```

---

## 4. 会话状态机

```
        ┌─────────┐
        │  IDLE   │
        └────┬────┘
             │ TCP connect
             ▼
        ┌─────────┐     invalid
        │ HELLO   │──────────────► ERROR
        └────┬────┘
             │ hello_ack (协议版本匹配)
             ▼
        ┌─────────┐
        │  PAIR   │◄── pair_challenge / pair_response
        └────┬────┘
             │ pair_ok + sessionToken
             ▼
        ┌─────────┐
        │  META   │ 交换 device_id, db_version, site_id
        └────┬────┘
             ▼
   ┌─────────────────────┐
   │ PUSH local changes  │──► changes_chunk × N ──► apply_ack
   └──────────┬──────────┘
              ▼
   ┌─────────────────────┐
   │ PULL remote changes │◄── changes_request
   └──────────┬──────────┘
              ▼
        ┌─────────┐
        │  DONE   │ session_done
        └─────────┘
```

---

## 5. 消息详解

### 5.1 hello / hello_ack

**hello**（Client → Server）:

```json
{
  "deviceId": "01932a-...",
  "deviceName": "Crowds-iPhone",
  "platform": "ios",
  "protocolVersion": 1,
  "appVersion": "0.1.0"
}
```

**hello_ack**:

```json
{
  "deviceId": "...",
  "deviceName": "...",
  "platform": "macos",
  "protocolVersion": 1,
  "accepted": true,
  "rejectReason": null
}
```

拒绝原因：`version_mismatch` | `busy`（已有 session）

### 5.2 配对（pair_*）

**流程 A — 发起方已知配对码**（用户在 UI 输入对端展示的码）：

1. Client → `pair_request { code: "482913" }`
2. Server 校验 → `pair_ok { sessionToken, expiresAt }` 或 `pair_fail { reason }`

**流程 B — 被连接方展示码**：

1. Server → `pair_challenge { displayCode: "482913", expiresAt }`
2. Client 用户输入 → `pair_response { code: "482913" }`
3. Server → `pair_ok`

| 规则 | 值 |
|------|-----|
| 码长度 | 6 位数字 |
| 有效期 | 5 分钟 |
| sessionToken | UUID，会话内有效 |
| 失败次数 | 5 次锁定 60 秒 |

### 5.3 meta_exchange

双方互发：

```json
{
  "deviceId": "...",
  "siteId": "...",           // crsql_site_id()
  "dbVersion": 1042,
  "peerCursor": 980,         // 本机记录的「对该 peer 已同步到的 version」
  "syncableTables": [
    "projects", "tasks", "habit_rules", "habit_occurrences",
    "milestones", "milestone_links", "time_entries"
  ]
}
```

### 5.4 changes_request

请求对方发送 `sinceVersion` 之后的 changes：

```json
{
  "sinceVersion": 980,
  "requestId": "msg-uuid"
}
```

### 5.5 changes_chunk

```json
{
  "requestId": "msg-uuid",
  "chunkIndex": 0,
  "chunkTotal": 3,
  "rows": [
    {
      "table": "tasks",
      "pk": "01932b-...",
      "cid": "title",
      "val": "实现同步模块",
      "colVersion": 2,
      "dbVersion": 1043,
      "siteId": "...",
      "cl": 1,
      "seq": 0
    }
  ]
}
```

`rows` 结构与 `crsql_changes` 查询结果一致。

### 5.6 changes_done

```json
{
  "requestId": "msg-uuid",
  "lastDbVersion": 1050,
  "rowCount": 128
}
```

### 5.7 apply_ack

接收方应用完一个 chunk 后：

```json
{
  "requestId": "msg-uuid",
  "chunkIndex": 0,
  "applied": 42,
  "failed": 0,
  "errors": []
}
```

### 5.8 session_done

```json
{
  "status": "success",
  "recordsSent": 128,
  "recordsReceived": 95,
  "conflicts": 0,
  "finalDbVersion": 1055
}
```

### 5.9 error

```json
{
  "code": "APPLY_FAILED",
  "message": "constraint violation on tasks.project_id"
}
```

---

## 6. 双向同步算法

```
输入: local L, remote R, meta_L, meta_R

1. since_L = sync_peer_cursor[R.device_id] ?? 0
2. since_R = R.peerCursor for L.device_id ?? 0

3. L 发送 changes where db_version > since_R  → R apply
4. R 发送 changes where db_version > since_L  → L apply

5. 更新 cursor:
   sync_peer_cursor[R] = max(merged db_version)
6. 写 sync_session_log
```

**过滤规则（发送前）**：

- 排除 `time_entries` 中 `end_at IS NULL` 的行
- 排除本地表

**apply 后**：

- 刷新 materialized 视图（若有）
- 触发前端 cache invalidate（App 内 Event）

---

## 7. 冲突处理

### 7.1 cr-sqlite 自动合并

- 不同列并发修改 → 按 CRDT 规则合并
- 同行同列 → Last-Write-Wins（`db_version` + `site_id`）

### 7.2 应用层兜底

若 apply 返回 constraint 错误（如 UNIQUE habit occurrence）：

1. 记录到 `sync_session_log.conflicts`
2. V1：日志 + toast 提示数量
3. V1.1：`sync_conflicts` 表供用户选择版本

### 7.3 删除冲突

- 一端软删、一端修改 → 以 `deleted_at` 较大者为准（视为删除胜出）
- 双端均删 → 幂等

### 7.4 计时器

- **不同步** `active_timer`
- 双端同时编辑同一 `task.title` → cr-sqlite 合并；UI 以合并后为准

---

## 8. 时序图

```
User(A)                App(A)                 App(B)                User(B)
  │                      │                      │                      │
  │──打开同步页──────────►│ discovery_start      │                      │
  │                      │◄──── mDNS ──────────►│ discovery_start      │
  │                      │                      │◄──打开同步页─────────│
  │──选 B，输入配对码────►│                      │                      │
  │                      │──── TCP connect ────►│                      │
  │                      │◄─── hello_ack ───────│                      │
  │                      │──── pair_ok ────────►│                      │
  │                      │◄══ meta/changes ════►│                      │
  │◄── progress ─────────│                      │                      │
  │◄── 完成 ─────────────│                      │── toast 完成 ───────►│
```

---

## 9. Rust 模块映射

| 文件 | 职责 |
|------|------|
| `sync/discovery.rs` | mdns-sd register/browse |
| `sync/listener.rs` | TCP accept loop |
| `sync/protocol.rs` | 帧编解码、消息类型 |
| `sync/session.rs` | 状态机、会话生命周期 |
| `sync/merge.rs` | 读/写 crsql_changes、apply |
| `sync/pairing.rs` | 配对码生成与校验 |

---

## 10. 配置常量

| 常量 | 值 |
|------|-----|
| `PROTOCOL_VERSION` | `1` |
| `DEFAULT_PORT_BASE` | `19280` |
| `MDNS_SERVICE` | `_spanwork._tcp.local` |
| `PAIRING_CODE_TTL_MS` | `300_000` |
| `SESSION_TIMEOUT_MS` | `120_000` |
| `MAX_FRAME_BYTES` | `4_194_304` |
| `CHUNK_ROW_LIMIT` | `500` |

---

## 11. 失败与重试

| 场景 | 行为 |
|------|------|
| TCP 超时 | 提示检查防火墙 / 同网段 |
| 配对失败 | 允许重试，不 partial apply |
| apply 中途失败 | 回滚当前 chunk（事务）；已 apply chunk 保留 |
| 对端 busy | 提示稍后重试 |
| db_version 回退 | 拒绝 session（防降级攻击） |

---

## 12. V2 扩展（非 V1）

- TLS（自签名 cert 交换）
- 固定设备密钥，免配对码
- 公网中继（仍无主，optional）
- 后台定时 LAN 同步

---

## 13. 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-22 | 初稿：mDNS、TCP 帧、消息、合并流程 |
