/**
 * DeepBook V3 类型定义
 */

import { OrderSide, OrderStatus } from './constants';

/**
 * 订单信息
 */
export interface Order {
    /**
     * 订单 ID (对象 ID)
     */
    orderId: string;

    /**
     * 订单方向：买单或卖单
     */
    side: OrderSide;

    /**
     * 订单价格 (以 base token 计价)
     */
    price: bigint;

    /**
     * 订单数量
     */
    quantity: bigint;

    /**
     * 已成交数量
     */
    filledQuantity: bigint;

    /**
     * 订单状态
     */
    status: OrderStatus;

    /**
     * 订单创建时间戳 (毫秒)
     */
    timestamp: number;

    /**
     * 池子 ID
     */
    poolId: string;

    /**
     * 用户地址
     */
    owner: string;

    /**
     * 实际存储押金 (MIST)
     * 如果从链上获取到了实际值，使用实际值；否则为 undefined
     */
    storageRebate?: bigint;
}

/**
 * 存储费返还计算结果
 */
export interface RebateCalculation {
    /**
     * 订单总数
     */
    totalOrders: number;

    /**
     * 总返还金额 (MIST)
     */
    totalRebateMist: bigint;

    /**
     * 总返还金额 (SUI)
     */
    totalRebateSui: string;

    /**
     * 每个订单的详细返还信息
     */
    orderRebates: OrderRebate[];

    /**
     * 是否使用了估算值
     * true: 使用平均值估算
     * false: 使用链上实际值
     */
    isEstimated: boolean;
}

/**
 * 单个订单的返还信息
 */
export interface OrderRebate {
    /**
     * 订单 ID
     */
    orderId: string;

    /**
     * 返还金额 (MIST)
     */
    rebateMist: bigint;

    /**
     * 返还金额 (SUI)
     */
    rebateSui: string;
}

/**
 * BalanceManager 对象结构
 * 用于管理用户在 DeepBook V3 中的资金和订单
 */
export interface BalanceManager {
    /**
     * BalanceManager 对象 ID
     */
    id: string;

    /**
     * 所有者地址
     */
    owner: string;

    /**
     * 关联的池子 ID
     */
    poolId: string;
}

/**
 * 动态字段查询结果
 */
export interface DynamicFieldInfo {
    /**
     * 字段名称
     */
    name: {
        type: string;
        value: any;
    };

    /**
     * 字段值的对象 ID
     */
    objectId: string;
}

/**
 * 查询选项
 */
export interface FetchOrdersOptions {
    /**
     * 是否获取实际的存储押金
     * 如果为 true，会为每个订单查询实际的 storageRebate 字段
     * 如果为 false，使用平均值估算（更快）
     * 
     * 默认: false
     */
    fetchActualRebate?: boolean;

    /**
     * 分页限制
     * 每次查询的最大订单数
     * 
     * 默认: 100
     */
    limit?: number;
}

/**
 * 清理交易构建选项
 */
export interface CleanupTransactionOptions {
    /**
     * 每个交易块的最大订单数
     * 如果订单数超过此值，会分成多个交易
     * 
     * 默认: 100
     */
    maxOrdersPerTransaction?: number;

    /**
     * Gas 预算 (MIST)
     * 
     * 默认: 100000000 (0.1 SUI)
     */
    gasBudget?: bigint;
}
