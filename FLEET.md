# Odyssey Fleet 传播与发布

Odyssey 的内部 Rust 发行线采用“一个 canonical bundle，多个受控 consumer”的传播模型。当前 [`distribution.toml`](distribution.toml) 登记 **27 个 consumer repository**，合计承载 **47 个 UI surface**。

这两个数字不能混用：

- **consumer** 是接收 `crates/odyssey` vendored crate 的 Git repository；
- **surface** 是该 consumer 对外呈现的逻辑 UI，例如一个聚合 deployable 可以同时承载多个域名或控制台；
- surface 数量不是公网 host 数量，也不表示访问边界或实时健康状态；
- `profile` 只用于 rollout 分组和风险判断。所有 Rust consumer 收到相同的 byte-identical payload，不能按 profile 维护 Odyssey fork。

当前 profile 分布如下，权威值始终以 `distribution.toml` 和 `odysseyctl manifest` 为准：

| Profile | Consumer | Surface |
|---|---:|---:|
| `public` | 1 | 1 |
| `portal` | 1 | 1 |
| `identity` | 2 | 2 |
| `security` | 5 | 8 |
| `control` | 6 | 7 |
| `observability` | 2 | 5 |
| `productivity` | 1 | 4 |
| `content` | 2 | 9 |
| `developer` | 1 | 3 |
| `ai` | 2 | 2 |
| `data`、`knowledge`、`communication`、`networking` | 4 | 5 |
| **合计** | **27** | **47** |

## 受控传播模型

`distribution.toml` 是 fleet membership 的唯一来源。每个 `[[consumer]]` 必须声明：

- `path`：仅允许 `../<repo>`；
- `deployable`：部署单元名称；
- `channel`：当前只能是 `internal-rust`；
- `profile`：rollout 元数据；
- `surfaces`：该 repository 承载的逻辑 surface 数量，必须大于 0。

Consumer 必须按 repository 名排序且不能重复。`odysseyctl` 还会扫描 estate：如果某个 sibling repository 已有 `crates/odyssey/Cargo.toml` 却未登记，所有 fleet 操作都会失败，避免形成无人管理的隐式 consumer。

每次同步会把以下 canonical 内容写入 consumer 的 `crates/odyssey`：

- 根 `Cargo.toml`；
- `css/`；
- `js/`；
- `src/`。

生成文件带有 `GENERATED FROM odyssey — DO NOT EDIT` 标记。`.odyssey-vendor` 记录 `schema`、release、channel、FNV-1a bundle fingerprint 和文件数。该 fingerprint 用于 drift identity，不是密码学签名。

本工具只修改 vendored tree；它不会自动修改业务接线、运行 consumer test、创建 Git commit、push、重建镜像或部署服务。这些步骤必须在每个 rollout batch 中显式完成。

## 使用 `odysseyctl`

在 Odyssey repository 根目录执行。首次使用可以直接通过 Cargo 运行：

```bash
cargo run --locked --manifest-path tools/odysseyctl/Cargo.toml -- manifest
```

频繁操作时可先构建 release binary：

```bash
cargo build --locked --release --manifest-path tools/odysseyctl/Cargo.toml
ODYSSEYCTL=./tools/odysseyctl/target/release/odysseyctl
```

### `manifest`

```bash
$ODYSSEYCTL manifest
```

输出 canonical bundle 的机器可读摘要：

```text
release=1.2.0-canary.1
channel=internal-rust
fingerprint=fnv1a64:20ae76d5c2ada57d
files=24
consumers=27
surfaces=47
```

`manifest` 不检查 consumer 是否 stale；它回答的是“当前准备传播什么”。

### `plan`

```bash
$ODYSSEYCTL plan --all
$ODYSSEYCTL plan --repo beacon,relay
```

`plan` 比较 canonical bundle、生成标记和 `.odyssey-vendor`，逐项打印 `clean`、`stale`、`missing`、`diff` 或 `extra`。它用于人工预览：consumer stale 本身不会让命令返回非零，但 manifest 无效、consumer 未登记或 repository 缺少 `Cargo.toml` 仍会报错。

因此 CI gate 必须使用 `check`，不能用 `plan` 代替。

### `check`

```bash
$ODYSSEYCTL check --all
$ODYSSEYCTL check --repo beacon,relay
```

`check` 执行与 `plan` 相同的精确比较，并在任意选中 consumer stale 时返回非零。推荐用于：

- Odyssey 发布前确认已选 batch；
- consumer CI 检查 vendored crate 是否与 canonical release 一致；
- rollout 完成后执行 fleet-wide 收口。

### `sync`

```bash
$ODYSSEYCTL sync --repo beacon
$ODYSSEYCTL sync --repo cortex,familiar,relay
$ODYSSEYCTL sync --all
```

`sync` 先为所有选中 consumer 做结构与 dirty preflight，然后逐个执行：

1. 在 `crates/.odyssey-stage-<pid>` 写入新 tree；
2. 对 staged tree 做完整校验；
3. 将旧 tree 暂存为 backup，再以 rename 激活新 tree；
4. 校验最终 destination；
5. 删除 backup。

单个 consumer 的替换有 staging 和恢复保护，但一次多 repository 的 `sync` **不是跨仓事务**：如果后面的 consumer 失败，前面已经成功同步的 repository 不会自动回滚。因此首次 rollout 不应直接从 `sync --all` 开始。

`--repo` 接受 `distribution.toml` 中 path 的 repository basename，以逗号分隔；它不是 deployable 或 profile 选择器。

## Dirty guard 与 `--force`

默认 `sync` 会运行等价于以下范围的检查：

```bash
git -C <consumer> status --porcelain --untracked-files=all -- crates/odyssey
```

只要 `crates/odyssey` 内存在 tracked 或 untracked 改动，`sync` 就会拒绝覆盖。Consumer 其他目录的业务改动不会触发此 guard。

正确处理方式是先检查并处理本地 vendor 改动：

```bash
git -C ../beacon diff -- crates/odyssey
git -C ../beacon status --short -- crates/odyssey
```

如果改动应该成为全 fleet 行为，应先回收到 canonical Odyssey，再重新 `plan`。不要在生成目录里长期维护补丁。

只有在确认要丢弃 vendor-local 改动时才使用：

```bash
$ODYSSEYCTL sync --repo beacon --force
```

`--force` 只对 `sync` 有效，也只绕过 dirty guard；它不会绕过 manifest 校验、未登记 consumer 检查、staged verification 或最终 `check`。同步会保留 vendored `target/` 和 `Cargo.lock`，但其他额外文件会被删除。使用 `--force` 前应先保存需要的工作；该选项不是 merge 工具。

## 分批 rollout

一次受控发布建议遵循以下顺序：

1. 更新 canonical Odyssey，执行 root test、`odysseyctl` test，并在 `distribution.toml` 中更新 release；
2. 运行 `manifest`，记录 release、fingerprint、27 consumer / 47 surface 基线；
3. 运行 `plan --all`，审阅全 fleet drift；
4. 对一个小 batch 执行 `sync --repo ...`；
5. 在每个 consumer 中审阅 diff，运行其 format、test、build 和必要的页面验收；
6. 单独 commit、push、deploy 该 batch，观察后再进入下一批；
7. 最后运行 `check --all`，确保没有遗漏或半更新 consumer。

建议按 blast radius 而不是目录顺序展开：

| Batch | Consumer | Consumer / Surface | 目的 |
|---|---|---:|---|
| 首批 pilot | `beacon,portal,sanctum` | 3 / 3 | 同时验证公共状态页、门户与内部安全控制台 |
| 单 surface 应用切片 | `cistern,cortex,familiar,relay` | 4 / 4 | 验证 data、knowledge 与 AI 接线差异 |
| 其余单 surface | `anvil,ark,census,corvid,crucible,estuary,lodestar,pulse,sigil,skiff,verdict` | 11 / 11 | 按 control、identity、security 再拆小批处理 |
| 聚合 deployable | `bastion,concourse,forge,ledger,reader,scriptoria,sentinel,telemetry,verge` | 9 / 29 | 最后处理多 surface 和更大视觉回归面 |

示例 batch 流程：

```bash
$ODYSSEYCTL plan  --repo cortex,familiar,relay
$ODYSSEYCTL sync  --repo cortex,familiar,relay

# 分别进入三个 consumer，执行各自 test/build/视觉验收和 Git 流程。

$ODYSSEYCTL check --repo cortex,familiar,relay
```

上述分组是推荐顺序，不是 `odysseyctl` 内建 policy。遇到高风险业务发布窗口、schema 迁移或 consumer 自身 dirty 状态时，应继续缩小 batch。

## 非 Rust 接入边界

`distribution.toml` 当前只接受 `channel = "internal-rust"`。非 Rust 应用不属于 27 consumer / 47 surface 统计，也不能通过伪造 channel 接入 `odysseyctl`。

非 Rust 页面应使用公开、framework-agnostic 的 versioned assets。`1.1` 是冻结的 stable snapshot：

```html
<link rel="stylesheet" href="https://odyssey.w33d.xyz/1.1/odyssey.css">
<link rel="stylesheet" href="https://odyssey.w33d.xyz/1.1/odyssey-font.css">
<script src="https://odyssey.w33d.xyz/1.1/odyssey.js"></script>
```

`1.2.0-canary.1` 通过固定的 `/1.2` path 提供，供显式 canary 页面接入：

```html
<link rel="stylesheet" href="https://odyssey.w33d.xyz/1.2/odyssey.css">
<link rel="stylesheet" href="https://odyssey.w33d.xyz/1.2/odyssey-font.css">
<script src="https://odyssey.w33d.xyz/1.2/odyssey.js"></script>
```

仓库中的 `releases/1.1/` 与 `releases/1.2/` 都是 immutable snapshot；其文件不可被后续 release 覆盖。`dist/` 保存当前 `1.2` canary 的 byte-identical 物理发行文件，供短缓存 `/dist` 路由与 self-host pipeline 使用；`tools/build-public-dist.sh` 从 `1.1` 组件基线加 canonical `css/profile.css`、`js/canary.js` 确定性生成它，并拒绝静默改写已存在的 `1.2` snapshot。无论 CDN 还是 self-host，都必须 pin release；不要指向内部 `crates/odyssey`，也不要复制未版本化的 canonical source。

公开 `/1.1/odyssey.js` 只提供 `data-ody-*` 组件行为，不包含 Wire、Spark、Motion，也不负责应用 fetch、router、cache 或 offline state。非 Rust SSR/SPA 的数据请求和状态管理仍由宿主框架负责。若未来需要把内部 runtime 提供给非 Rust consumer，应新增独立、版本化且经过安全审计的 distribution channel，而不是扩大现有 `internal-rust` manifest 的含义。

`/1.2/odyssey.js` 在同一安全边界内增加 network-free 的 shell/profile enhancer，不包含 Wire、Spark、Motion，也不发起应用数据请求。

## Odyssey 1.2 profile root contract

`data-ody-profile` 是跨产品可复用的显式 root contract。未标记页面完全沿用 `1.1` 默认视觉；产品只有在 canary vertical slice 中主动标记后，才启用 profile signal、HOLDFAST shell、48 px mineral grid、导航坐标和统一状态语言。

```html
<html data-ody-profile="public">
<body data-ody-shell="1.2" class="ody-shell">
  <nav data-ody-shell-nav>…</nav>
  <main class="ody-shell__stage" data-ody-coordinate="PUBLIC / STATUS">
    <span class="ody-signal" data-ody-status="operational">Operational</span>
  </main>
</body>
</html>
```

允许值与 `distribution.toml` 的 rollout metadata 保持同一词汇：`ai`、`communication`、`content`、`control`、`data`、`developer`、`identity`、`knowledge`、`networking`、`observability`、`portal`、`productivity`、`public`、`security`。Beacon 使用 `public`，Portal 使用 `portal`；profile 只协调 presentation semantics，不改变服务访问边界或业务权限。

## 修改 fleet membership

新增或移除 consumer 时：

1. 按 repository basename 排序修改 `distribution.toml`；
2. 核实 `deployable`、`profile` 和逻辑 `surfaces`，不要用 host 或 route 数量代替；
3. 运行 `cargo test --locked --manifest-path tools/odysseyctl/Cargo.toml`；
4. 运行 `manifest`，确认 consumer/surface 合计符合预期；
5. 对新增 consumer 先 `plan --repo <name>`，再进入正常 canary 流程。

删除 consumer 前应先确认其不再从 `crates/odyssey` 构建；否则 estate 扫描会把它报告为 unregistered consumer。
