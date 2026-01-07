/**
 * DeepBook V3 常量配置
 * 包含 Package ID、模块名称、存储费用等常量
 */

/**
 * DeepBook V3 Package ID (Mainnet)
 * 注意：这是一个示例 ID，请根据实际部署的 DeepBook V3 合约地址更新
 */
export const DEEPBOOK_PACKAGE_ID = '0x00c1a56ec8c4c623a848b2ed2f03d23a25d17570b670c22106f336eb933785cc';

/**
 * DeepBook V3 模块和函数名称
 */
export const DEEPBOOK_MODULES = {
    POOL: 'pool',
    BALANCE_MANAGER: 'balance_manager',
} as const;

/**
 * DeepBook V3 函数名称
 */
export const DEEPBOOK_FUNCTIONS = {
    CANCEL_ORDER: 'cancel_order',
    PLACE_LIMIT_ORDER: 'place_limit_order',
    GET_OPEN_ORDERS: 'get_open_orders',
} as const;

/**
 * Sui 存储费用常量
 * 
 * 根据 Sui 文档：
 * - 删除对象可以返还 99% 的存储押金
 * - 平均每个对象的存储费用约为 0.003 SUI (3,000,000 MIST)
 * - 实际费用取决于对象大小
 */
export const STORAGE_COSTS = {
    /**
     * 平均每个对象的存储押金 (MIST)
     * 1 SUI = 1,000,000,000 MIST
     */
    AVERAGE_STORAGE_DEPOSIT_MIST: 3_000_000n, // 0.003 SUI

    /**
     * 删除对象时的返还比例
     */
    REBATE_PERCENTAGE: 0.99,

    /**
     * 平均每个对象可返还的存储费 (MIST)
     */
    AVERAGE_REBATE_PER_OBJECT_MIST: 2_970_000n, // 0.00297 SUI (99% of 0.003)
} as const;

/**
 * MIST 到 SUI 的转换常量
 */
export const MIST_PER_SUI = 1_000_000_000n;

/**
 * 网络配置
 */
export const NETWORK_CONFIG = {
    MAINNET: {
        url: 'https://fullnode.mainnet.sui.io:443',
        name: 'mainnet',
    },
    TESTNET: {
        url: 'https://fullnode.testnet.sui.io:443',
        name: 'testnet',
    },
    DEVNET: {
        url: 'https://fullnode.devnet.sui.io:443',
        name: 'devnet',
    },
} as const;

/**
 * 订单类型
 */
export enum OrderSide {
    BID = 'bid',  // 买单
    ASK = 'ask',  // 卖单
}

/**
 * 订单状态
 */
export enum OrderStatus {
    OPEN = 'open',
    FILLED = 'filled',
    CANCELLED = 'cancelled',
    PARTIALLY_FILLED = 'partially_filled',
}

/**
 * 每个 PTB 的最大命令数
 * Sui 对单个交易块的命令数有限制
 */
export const MAX_COMMANDS_PER_PTB = 1024;
