# DeepBook V3 订单管理工具

基于 Sui DeepBook V3 的 TypeScript 工具库，用于管理限价单和计算存储费返还。

## 功能特性

✨ **核心功能**

- 🔍 **查询未完成订单** - 获取用户在指定池子中的所有未完成限价单
- 💰 **计算存储费返还** - 精确计算取消订单可获得的 SUI 返还金额
- 🔧 **批量取消订单** - 构建可编程交易块 (PTB) 批量取消订单

🎯 **技术亮点**

- 支持实际存储押金查询和估算值计算
- 自动处理分页和大量订单
- 智能分批交易，避免超出 PTB 限制
- 完整的 TypeScript 类型支持
- 详细的错误处理和日志

## 背景

### DeepBook V3 简介

DeepBook V3 是 Sui 区块链上的去中心化订单簿协议。它使用 **BalanceManager** 对象来管理用户在不同池子中的资金和订单。

### Sui 存储费机制

Sui 网络有一个独特的特性：**删除链上对象会返还 99% 的存储费**。这意味着：

- 每个链上对象在创建时需要支付存储押金（约 0.003 SUI）
- 删除对象时，99% 的押金会自动返还
- 对于有大量未完成订单的用户，清理这些订单可以回收可观的 SUI

## 安装

```bash
npm install
```

## 快速开始

### 基础用法

```typescript
import { DeepBookService } from './src/deepbook-service';
import { NETWORK_CONFIG } from './src/constants';

// 1. 初始化服务
const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);

// 2. 获取未完成订单
const orders = await service.fetchUserOpenOrders(
  '0x用户地址...',
  '0x池子ID...'
);

console.log(`找到 ${orders.length} 个未完成订单`);

// 3. 计算存储费返还
const rebate = service.calculateRebate(orders);
console.log(`可返还: ${rebate.totalRebateSui} SUI`);

// 4. 构建清理交易
const transactions = service.buildCleanUpTransaction(orders);
console.log(`需要执行 ${transactions.length} 个交易`);
```

### 使用实际存储押金

```typescript
// 获取订单时查询实际的存储押金（更准确但更慢）
const orders = await service.fetchUserOpenOrders(
  userAddress,
  poolId,
  {
    fetchActualRebate: true,  // 启用实际值查询
    limit: 100,
  }
);

const rebate = service.calculateRebate(orders);
console.log(`实际可返还: ${rebate.totalRebateSui} SUI`);
console.log(`使用${rebate.isEstimated ? '估算值' : '实际值'}`);
```

### 批量处理多个池子

```typescript
const poolIds = ['0xpool1...', '0xpool2...', '0xpool3...'];
let totalRebateMist = 0n;

for (const poolId of poolIds) {
  const orders = await service.fetchUserOpenOrders(userAddress, poolId);
  const rebate = service.calculateRebate(orders);
  totalRebateMist += rebate.totalRebateMist;
}

const totalSui = Number(totalRebateMist) / 1_000_000_000;
console.log(`所有池子总计可返还: ${totalSui.toFixed(9)} SUI`);
```

## API 文档

### DeepBookService

主服务类，提供所有核心功能。

#### 构造函数

```typescript
constructor(rpcUrl: string)
```

**参数:**
- `rpcUrl` - Sui RPC 节点 URL（可使用 `NETWORK_CONFIG` 中的预定义值）

**示例:**
```typescript
import { NETWORK_CONFIG } from './src/constants';

const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);
```

---

#### fetchUserOpenOrders()

获取用户在指定池子中的所有未完成订单。

```typescript
async fetchUserOpenOrders(
  userAddress: string,
  poolId: string,
  options?: FetchOrdersOptions
): Promise<Order[]>
```

**参数:**
- `userAddress` - 用户的 Sui 地址
- `poolId` - DeepBook V3 池子的对象 ID
- `options` - 可选配置
  - `fetchActualRebate?: boolean` - 是否获取实际存储押金（默认: false）
  - `limit?: number` - 最大订单数（默认: 100）

**返回值:**
- `Promise<Order[]>` - 订单列表

**示例:**
```typescript
const orders = await service.fetchUserOpenOrders(
  '0x1234...',
  '0xabcd...',
  {
    fetchActualRebate: true,
    limit: 50,
  }
);
```

---

#### calculateRebate()

计算取消订单可获得的存储费返还。

```typescript
calculateRebate(orders: Order[]): RebateCalculation
```

**参数:**
- `orders` - 订单列表

**返回值:**
- `RebateCalculation` - 返还计算结果
  - `totalOrders: number` - 订单总数
  - `totalRebateMist: bigint` - 总返还金额（MIST）
  - `totalRebateSui: string` - 总返还金额（SUI）
  - `orderRebates: OrderRebate[]` - 每个订单的返还详情
  - `isEstimated: boolean` - 是否使用估算值

**示例:**
```typescript
const rebate = service.calculateRebate(orders);

console.log(`订单数: ${rebate.totalOrders}`);
console.log(`总返还: ${rebate.totalRebateSui} SUI`);
console.log(`计算方式: ${rebate.isEstimated ? '估算' : '实际'}`);
```

---

#### buildCleanUpTransaction()

构建批量取消订单的可编程交易块 (PTB)。

```typescript
buildCleanUpTransaction(
  orders: Order[],
  options?: CleanupTransactionOptions
): Transaction[]
```

**参数:**
- `orders` - 要取消的订单列表
- `options` - 可选配置
  - `maxOrdersPerTransaction?: number` - 每个交易的最大订单数（默认: 100）
  - `gasBudget?: bigint` - Gas 预算（默认: 100000000 = 0.1 SUI）

**返回值:**
- `Transaction[]` - 可编程交易块数组

**注意事项:**
- 返回的交易需要用户签名后才能执行
- 如果订单数超过 `maxOrdersPerTransaction`，会返回多个交易
- 每个交易都需要单独签名和执行

**示例:**
```typescript
const transactions = service.buildCleanUpTransaction(orders, {
  maxOrdersPerTransaction: 50,
  gasBudget: 100_000_000n,
});

// 使用钱包签名并执行
for (const tx of transactions) {
  const result = await wallet.signAndExecuteTransaction({
    transaction: tx,
  });
  console.log(`交易已执行: ${result.digest}`);
}
```

## 类型定义

### Order

```typescript
interface Order {
  orderId: string;           // 订单 ID
  side: OrderSide;           // 买单或卖单
  price: bigint;             // 价格
  quantity: bigint;          // 数量
  filledQuantity: bigint;    // 已成交数量
  status: OrderStatus;       // 状态
  timestamp: number;         // 创建时间
  poolId: string;            // 池子 ID
  owner: string;             // 所有者地址
  storageRebate?: bigint;    // 实际存储押金（可选）
}
```

### OrderSide

```typescript
enum OrderSide {
  BID = 'bid',  // 买单
  ASK = 'ask',  // 卖单
}
```

### OrderStatus

```typescript
enum OrderStatus {
  OPEN = 'open',                          // 未成交
  FILLED = 'filled',                      // 已成交
  CANCELLED = 'cancelled',                // 已取消
  PARTIALLY_FILLED = 'partially_filled',  // 部分成交
}
```

## 项目结构

```
crypto-tools/
├── src/
│   ├── constants.ts          # 常量配置
│   ├── types.ts              # 类型定义
│   ├── deepbook-service.ts   # 核心服务类
│   └── index.ts              # 主入口
├── examples/
│   └── usage.ts              # 使用示例
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

### 构建

```bash
npm run build
```

### 类型检查

```bash
npm run typecheck
```

### 开发模式（监听文件变化）

```bash
npm run dev
```

## 重要提示

### DeepBook V3 集成

⚠️ **注意**: 本实现基于 DeepBook V3 的公开文档和标准 Sui 模式。实际使用时可能需要根据具体部署调整：

1. **Package ID**: 更新 `src/constants.ts` 中的 `DEEPBOOK_PACKAGE_ID`
2. **对象结构**: 根据实际的 BalanceManager 和 Order 对象结构调整字段名
3. **类型参数**: 在 `buildCleanUpTransaction` 中添加正确的资产类型参数

### 存储费计算

- **估算值**: 默认使用 0.003 SUI/对象的保守估计
- **实际值**: 设置 `fetchActualRebate: true` 可获取精确值，但会增加 RPC 调用次数
- **返还比例**: Sui 返还 99% 的存储押金

### Gas 费用

- 取消订单需要支付 Gas 费用
- 建议每个交易的 Gas 预算设置为 0.1 SUI
- 实际 Gas 消耗取决于订单数量和网络状况

## 示例输出

运行 `examples/usage.ts` 的示例输出：

```
初始化 DeepBook V3 服务...

用户地址: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
池子 ID: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

正在查询未完成订单...
✓ 找到 15 个未完成订单

订单详情:
────────────────────────────────────────────────────────────────────────────────
订单 #1:
  ID: 0xorder1...
  方向: 买单
  价格: 1000000
  数量: 5000000000
  已成交: 0
  状态: open
  存储押金: 2970000 MIST

...

返还计算结果:
────────────────────────────────────────────────────────────────────────────────
订单总数: 15
总返还金额: 0.044550000 SUI (44550000 MIST)
计算方式: 实际值

各订单返还详情:
  订单 #1: 0.002970000 SUI
  订单 #2: 0.002970000 SUI
  ...

构建清理交易...

✓ 创建了 1 个交易

总结:
────────────────────────────────────────────────────────────────────────────────
✓ 找到 15 个未完成订单
✓ 预计可返还 0.044550000 SUI
✓ 需要执行 1 个交易
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关资源

- [Sui 文档](https://docs.sui.io/)
- [DeepBook V3 文档](https://docs.deepbook.tech/)
- [@mysten/sui SDK](https://sdk.mystenlabs.com/typescript)
