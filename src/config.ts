/**
 * 配置文件类型定义
 */

/**
 * 应用配置接口
 */
export interface AppConfig {
    /**
     * 网络类型
     */
    network: 'mainnet' | 'testnet' | 'devnet';

    /**
     * RPC 节点 URL（可选，如果不提供则使用默认值）
     */
    rpcUrl?: string;

    /**
     * 私钥（base64 格式）
     */
    privateKey: string;

    /**
     * 用户地址（可选，用于示例）
     */
    userAddress?: string;

    /**
     * 池子 ID（可选，用于示例）
     */
    poolId?: string;
}
