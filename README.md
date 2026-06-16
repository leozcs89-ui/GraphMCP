# graphMCP

> 基于 MCP 协议的可视化 AI 辅助开发工具，专为 Vibe Coding 设计。

## 功能

- **可视化项目蓝图** — 在画布上用节点和连线构建项目模块结构
- **MCP 协议集成** — AI Agent 可直接读取项目结构、模块逻辑、更新进度
- **SNL（结构化自然语言）编译** — 将画布中的图形自动编译为可读的任务链路
- **实时双向通信** — 通过 WebSocket 在 GUI 和 AI Agent 之间同步状态
- **自动生成 CONTEXT.MD** — 项目进度文档始终保持最新

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TailwindCSS + @xyflow/react |
| 后端 | Express + WebSocket + MCP SDK |
| 语言 | TypeScript |

## 快速开始

```bash
# 安装依赖（包含 gui 和 server 两个 workspace）
npm install

# 同时启动前端和后端
npm run dev

# 或分别启动
npm run dev:gui     # 前端 → http://localhost:5173
npm run dev:server  # 后端 → http://localhost:3001
```

## 目录结构

```
graphMCP/
├── gui/              # 前端（React + Vite）
│   └── src/
│       ├── App.tsx           # 主画布组件
│       ├── components/       # 节点、菜单、SNL 面板等
│       └── hooks/            # 数据管理 hooks
├── server/           # 后端（Express + MCP）
│   └── src/
│       ├── index.ts          # 服务入口
│       ├── mcp/tools.ts      # MCP 工具注册
│       ├── routes/graph.ts   # 画布 API
│       ├── store.ts          # 数据持久化
│       └── compiler/         # SNL 编译器
└── graph_logic.json  # 图形数据文件
```

## MCP 工具列表

| 工具名 | 功能 |
|--------|------|
| `inspect_project_structure` | 读取全局模块关系和整体进度 |
| `fetch_module_logic` | 获取指定模块的微观 SNL 控制流 |
| `update_node_progress` | 更新节点状态（todo/in_progress/completed） |
| `check_pending_events` | 读取从 Web UI 发送给 Agent 的消息 |

## 使用方式

1. 启动项目后打开画布界面
2. 双击画布创建节点（structure / workflow）
3. 拖拽节点连接线建立模块依赖关系
4. 点击 "Compile SNL" 查看项目结构概览
5. AI Agent 通过 MCP 协议读取画布数据并执行编码任务
