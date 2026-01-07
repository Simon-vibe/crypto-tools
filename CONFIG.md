# 配置说明

本项目使用 `config.json` 文件来管理私钥和其他配置信息。

## 快速开始

1. **复制示例配置文件**

```bash
cp config.example.json config.json
```

2. **编辑配置文件**

打开 `config.json` 并填入您的配置信息：

```json
{
  "network": "mainnet",
  "rpcUrl": "https://fullnode.mainnet.sui.io:443",
  "privateKey": "your_base64_private_key_here",
  "userAddress": "0x1234...",
  "poolId": "0xabcd..."
}
```

## 配置字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `network` | string | ✅ | 网络类型：`mainnet`、`testnet` 或 `devnet` |
| `rpcUrl` | string | ❌ | RPC 节点 URL（可选，默认使用对应网络的标准节点） |
| `privateKey` | string | ✅ | Base64 编码的私钥 |
| `userAddress` | string | ❌ | 用户地址（用于示例脚本） |
| `poolId` | string | ❌ | 池子 ID（用于示例脚本） |

## 获取私钥

### 从 Sui CLI 导出私钥

```bash
# 查看地址列表
sui client addresses

# 导出私钥（base64 格式）
sui keytool export --key-identity <your-address>
```

### 从助记词生成私钥

如果您有助记词，可以使用以下代码生成私钥：

```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toB64 } from '@mysten/sui/utils';

const keypair = Ed25519Keypair.deriveKeypair('your mnemonic phrase here');
const privateKey = toB64(keypair.getSecretKey());
console.log('Private Key (base64):', privateKey);
```

## 安全提示

⚠️ **重要安全提示**

- `config.json` 已添加到 `.gitignore`，不会被提交到 Git 仓库
- **切勿**将包含真实私钥的 `config.json` 提交到版本控制系统
- **切勿**在公开场合分享您的私钥
- 建议仅在开发和测试环境使用配置文件
- 生产环境建议使用钱包 SDK（如 Sui Wallet Adapter）

## 示例配置

### Mainnet 配置

```json
{
  "network": "mainnet",
  "privateKey": "ABase64EncodedPrivateKey==",
  "userAddress": "0x1234567890abcdef...",
  "poolId": "0xabcdef1234567890..."
}
```

### Testnet 配置

```json
{
  "network": "testnet",
  "privateKey": "ABase64EncodedPrivateKey==",
  "userAddress": "0x1234567890abcdef...",
  "poolId": "0xabcdef1234567890..."
}
```

## 运行示例

配置完成后，运行示例脚本：

```bash
# 运行主示例
npx ts-node examples/usage.ts

# 或运行特定示例函数
npx ts-node -e "import('./examples/usage').then(m => m.executeWithKeypair())"
```

## 故障排除

### 配置文件不存在

如果看到错误：`配置文件不存在: config.json`

**解决方案**: 复制 `config.example.json` 为 `config.json`

```bash
cp config.example.json config.json
```

### 私钥格式错误

如果看到错误：`请在 config.json 中设置有效的 privateKey`

**解决方案**: 确保私钥是 base64 编码格式，并且不是占位符 `your_base64_private_key_here`

### JSON 格式错误

如果看到错误：`配置文件格式错误`

**解决方案**: 使用 JSON 验证工具检查 `config.json` 的格式是否正确

```bash
# 使用 jq 验证 JSON 格式
cat config.json | jq .
```
