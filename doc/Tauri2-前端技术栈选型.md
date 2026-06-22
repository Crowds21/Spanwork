# Spanwork — Tauri 2 前端技术栈选型说明

| 项目 | 说明 |
|------|------|
| 关联文档 | PRD v1.1 |
| 创建日期 | 2026-06-22 |

---

## 1. Tauri 2 的前端模型

Tauri 2 将应用分为两层：

```
┌──────────────────────────────────────┐
│  前端（WebView 中运行的 UI）           │  ← 任意 Web 技术
│  HTML / CSS / JS / WASM              │
├──────────────────────────────────────┤
│  Rust 后端（src-tauri）               │  ← SQLite、LAN 同步、系统 API
│  Tauri Commands / Plugins            │
└──────────────────────────────────────┘
```

Tauri **不绑定**具体前端框架，本质是「静态资源 + WebView」。官方文档要求：

- 使用 **SSG / SPA / MPA**，不支持 SSR 服务端渲染
- 移动端开发时需 dev server 绑定内网 IP（`TAURI_DEV_HOST`）
- 推荐 **Vite** 作为构建工具（React / Vue / Svelte / Solid 等）

初始化命令：

```bash
npm create tauri-app@latest
```

官方 `create-tauri-app` 模板包含：Vanilla、Vue、Svelte、React、Solid、Angular、Preact，以及 Rust 侧 UI 框架 Yew / Leptos / Sycamore。

---

## 2. 前端技术栈选项一览

### 2.1 TypeScript / JavaScript 框架（主流）

| 框架 | 构建方式 | AI 辅助友好度 | 生态 | 移动端 WebView | 推荐场景 |
|------|----------|---------------|------|----------------|----------|
| **React + Vite + TS** | SPA | ⭐⭐⭐⭐⭐ | npm 最大 | ✅ 成熟 | **个人项目首选** |
| **Vue 3 + Vite + TS** | SPA | ⭐⭐⭐⭐ | 国内资料多 | ✅ 成熟 | 熟悉 Vue 时 |
| **Svelte 5 + Vite** | SPA | ⭐⭐⭐ | 轻量 | ✅ | 追求小 bundle |
| **SolidJS + Vite** | SPA | ⭐⭐⭐ | 中等 | ✅ | 细粒度响应式 |
| **Preact + Vite** | SPA | ⭐⭐⭐⭐ | 兼容 React | ✅ | 极致体积 |
| **Angular** | SPA | ⭐⭐ | 重型 | ✅ | 不推荐个人小项目 |
| **Vanilla TS** | Vite | ⭐⭐⭐ | 无框架负担 | ✅ | 极简单页 |

### 2.2 Meta 框架（需额外配置）

| 框架 | Tauri 适配要点 | 适合 Spanwork？ |
|------|----------------|-----------------|
| **Next.js** | `output: 'export'`，`images.unoptimized: true` | ⚠️ 可用但无 SSR 优势，不如 Vite 直接 |
| **Nuxt** | 静态/SPA 模式 | ⚠️ 同上 |
| **SvelteKit** | `@sveltejs/adapter-static` + 关闭 SSR | ✅ Svelte 爱好者可选 |
| **Qwik** | 官方有配置指南 | ⚠️ 生态较新 |

> **结论**：Spanwork 这类工具型 App 不需要 SSR，直接用 **Vite + SPA 框架** 最简单，构建链更短。

### 2.3 Rust 原生 UI（前端也用 Rust）

| 框架 | 说明 | 适合 Spanwork？ |
|------|------|-----------------|
| **Leptos** | 类 React 的 Rust WASM UI | ❌ 与 TS 前端二选一，AI 资料少 |
| **Yew** | Rust WASM 组件 | ❌ 同上 |
| **Sycamore** | Rust 响应式 UI | ❌ 同上 |

> Rust UI 与「AI 辅助 + 个人维护」目标冲突：LLM 对 Rust UI 代码生成质量远低于 TS/React。**Spanwork 建议 UI 用 TS，Rust 只做后端能力。**

---

## 3. 配套技术选型（React 路线示例）

若选 **React + Vite + TypeScript**（推荐），常见搭配：

| 层级 | 推荐 | 备选 |
|------|------|------|
| **语言** | TypeScript 5.x | — |
| **构建** | Vite 6.x | — |
| **路由** | TanStack Router 或 React Router | wouter（更轻） |
| **状态** | Zustand | Jotai / Redux Toolkit |
| **服务端状态** | TanStack Query | — |
| **UI 组件** | shadcn/ui + Radix | Mantine / Ant Design |
| **样式** | Tailwind CSS 4 | UnoCSS |
| **表单** | React Hook Form + Zod | — |
| **日期** | date-fns | dayjs |
| **Markdown** | react-markdown | marked（V2 报告用） |
| **图表** | Recharts | Chart.js（V2 报告用） |
| **本地 DB 访问** | 通过 Tauri Command 调用 Rust | tauri-plugin-sql（实验性） |
| **测试** | Vitest + Testing Library | — |

### 3.1 为何推荐 React + Vite + TS

1. **AI 辅助开发效率最高**：Cursor / Copilot 对 React + TS 生成质量最好
2. **与 Tauri Command 边界清晰**：UI 层 TS，持久化与 LAN 同步放 Rust
3. **shadcn/ui** 可复制粘贴组件，适合快速搭桌面/移动一致的管理界面
4. **社区案例多**：Tauri 2 + React 文档、模板、插件最丰富

### 3.2 Vue 3 路线（备选）

若更熟悉 Vue：

```
Vue 3 + Vite + TS + Pinia + Vue Router + Naive UI / Element Plus + Tailwind
```

AI 辅助略逊于 React，但完全可用于 Spanwork 体量。

### 3.3 Svelte 路线（备选）

```
Svelte 5 + Vite + TS + svelte-spa-router + shadcn-svelte
```

bundle 更小，语法简洁；Tauri 需 SvelteKit adapter-static 或纯 Svelte SPA。

---

## 4. Rust 后端层（与前端协作）

前端不直接操作 SQLite 与网络同步，统一经 **Tauri Commands**：

```
React UI
   │ invoke('create_project', ...)
   │ invoke('start_sync', ...)
   ▼
Rust (src-tauri)
   ├── db/          rusqlite + cr-sqlite 扩展
   ├── sync/        mDNS 发现 + QUIC/TCP 对等同步
   ├── timer/       计时器状态
   └── siyuan/      思源 HTTP 客户端（可选）
```

| Rust  crate / 能力 | 用途 |
|--------------------|------|
| `tauri` 2.x | 应用壳、IPC、插件 |
| `rusqlite` | SQLite 访问 |
| `cr-sqlite` / 自研 changeset | 多设备无主合并 |
| `mdns-sd` | 局域网设备发现 |
| `tokio` | 异步网络 |
| `serde` | 前后端 JSON 序列化 |
| `uuid` (v7) | 时间有序 ID，减少冲突 |
| `tauri-plugin-notification` | 本地通知 |
| `tauri-plugin-store` | 轻量 KV 配置 |

---

## 5. 各平台构建注意

| 平台 | 前端 | 备注 |
|------|------|------|
| **Windows** | 同一套 React build | WebView2 系统自带 |
| **macOS** | 同一套 React build | WKWebView |
| **iOS** | 同一套 React build | `tauri ios dev/build`，dev 需内网 IP |
| **Android** | 同一套 React build | `tauri android dev/build` |

响应式布局建议：

- **桌面**：侧边栏 + 主内容（≥1024px）
- **移动**：底部 Tab + 全屏列表（<768px）
- 可用 Tailwind 断点 + 同一套路由，无需两套前端工程

---

## 6. Spanwork 推荐栈（综合 PRD 决策）

```
┌─────────────────────────────────────────┐
│  React 19 + Vite + TypeScript            │
│  shadcn/ui + Tailwind + Zustand          │
│  TanStack Router + React Hook Form + Zod │
├─────────────────────────────────────────┤
│  Tauri 2 Commands (IPC)                  │
├─────────────────────────────────────────┤
│  Rust: rusqlite + cr-sqlite + mdns-sd    │
│  LAN 手动同步 · 计时器 · 思源客户端       │
├─────────────────────────────────────────┤
│  Win / macOS / iOS / Android             │
│  （鸿蒙 V2+ 另议）                        │
└─────────────────────────────────────────┘
```

**不选 Next/Nuxt 的原因**：无 SEO 需求，静态 export 反而增加配置复杂度。

**不选 Rust UI 的原因**：牺牲 AI 辅助效率，与项目目标不符。

---

## 7. 参考链接

- [Tauri 2 — Frontend Configuration](https://v2.tauri.app/start/frontend/)
- [Tauri 2 — Create a Project](https://v2.tauri.app/start/create-project/)
- [Tauri 2 — Next.js 适配](https://v2.tauri.app/start/frontend/nextjs/)
- [Tauri 2 — SvelteKit 适配](https://v2.tauri.app/start/frontend/sveltekit/)
- [cr-sqlite](https://github.com/vlcn-io/cr-sqlite)
