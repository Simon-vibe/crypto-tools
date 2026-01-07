/**
 * DeepBook V3 订单管理服务
 * 
 * 提供以下核心功能：
 * 1. 查询用户的未完成限价单
 * 2. 计算取消订单可获得的存储费返还
 * 3. 构建批量取消订单的交易
 */

import { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
    Order,
    RebateCalculation,
    OrderRebate,
    FetchOrdersOptions,
    CleanupTransactionOptions,
} from './types';
import {
    DEEPBOOK_PACKAGE_ID,
    DEEPBOOK_MODULES,
    DEEPBOOK_FUNCTIONS,
    STORAGE_COSTS,
    MIST_PER_SUI,
    OrderSide,
    OrderStatus,
    MAX_COMMANDS_PER_PTB,
} from './constants';

/**
 * DeepBook V3 服务类
 */
export class DeepBookService {
    private client: SuiClient;

    /**
     * 构造函数
     * @param rpcUrl - Sui RPC 节点 URL
     */
    constructor(rpcUrl: string) {
        this.client = new SuiClient({ url: rpcUrl });
    }

    /**
     * 获取用户在指定池子中的所有未完成订单
     * 
     * @param userAddress - 用户地址
     * @param poolId - 池子 ID
     * @param options - 查询选项
     * @returns 未完成订单列表
     * 
     * @example
     * ```typescript
     * const service = new DeepBookService('https://fullnode.mainnet.sui.io:443');
     * const orders = await service.fetchUserOpenOrders(
     *   '0x123...',
     *   '0xabc...',
     *   { fetchActualRebate: true }
     * );
     * console.log(`找到 ${orders.length} 个未完成订单`);
     * ```
     */
    async fetchUserOpenOrders(
        userAddress: string,
        poolId: string,
        options: FetchOrdersOptions = {}
    ): Promise<Order[]> {
        const { fetchActualRebate = false, limit = 100 } = options;

        try {
            // 步骤 1: 查找用户的 BalanceManager 对象
            // BalanceManager 是 DeepBook V3 中管理用户资金和订单的核心对象
            const balanceManager = await this.findBalanceManager(userAddress, poolId);

            if (!balanceManager) {
                console.log(`未找到用户 ${userAddress} 在池子 ${poolId} 的 BalanceManager`);
                return [];
            }

            // 步骤 2: 从 BalanceManager 的动态字段中获取订单
            // DeepBook V3 将订单存储在 BalanceManager 的动态字段中
            const orders = await this.fetchOrdersFromBalanceManager(
                balanceManager,
                userAddress,
                poolId,
                limit
            );

            // 步骤 3: 如果需要，获取每个订单的实际存储押金
            if (fetchActualRebate && orders.length > 0) {
                await this.enrichOrdersWithActualRebate(orders);
            }

            return orders;
        } catch (error) {
            console.error('获取订单失败:', error);
            throw new Error(`无法获取用户订单: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 计算取消订单可获得的存储费返还
     * 
     * @param orders - 订单列表
     * @returns 返还计算结果
     * 
     * @example
     * ```typescript
     * const rebate = service.calculateRebate(orders);
     * console.log(`取消 ${rebate.totalOrders} 个订单可返还 ${rebate.totalRebateSui} SUI`);
     * console.log(`使用${rebate.isEstimated ? '估算值' : '实际值'}`);
     * ```
     */
    calculateRebate(orders: Order[]): RebateCalculation {
        if (orders.length === 0) {
            return {
                totalOrders: 0,
                totalRebateMist: 0n,
                totalRebateSui: '0',
                orderRebates: [],
                isEstimated: false,
            };
        }

        // 检查是否所有订单都有实际的 storageRebate 值
        const hasActualRebate = orders.every(order => order.storageRebate !== undefined);

        let totalRebateMist = 0n;
        const orderRebates: OrderRebate[] = [];

        for (const order of orders) {
            // 使用实际值或估算值
            const rebateMist = order.storageRebate ?? STORAGE_COSTS.AVERAGE_REBATE_PER_OBJECT_MIST;

            totalRebateMist += rebateMist;

            orderRebates.push({
                orderId: order.orderId,
                rebateMist,
                rebateSui: this.mistToSui(rebateMist),
            });
        }

        return {
            totalOrders: orders.length,
            totalRebateMist,
            totalRebateSui: this.mistToSui(totalRebateMist),
            orderRebates,
            isEstimated: !hasActualRebate,
        };
    }

    /**
     * 构建批量取消订单的可编程交易块 (PTB)
     * 
     * 注意：
     * - 如果订单数量超过 maxOrdersPerTransaction，会返回多个交易
     * - 返回的交易需要用户签名后才能执行
     * - 每个 cancel_order 调用需要传入正确的类型参数和订单 ID
     * 
     * @param orders - 要取消的订单列表
     * @param options - 交易构建选项
     * @returns 可编程交易块数组
     * 
     * @example
     * ```typescript
     * const transactions = service.buildCleanUpTransaction(orders, {
     *   maxOrdersPerTransaction: 50,
     *   gasBudget: 100000000n
     * });
     * 
     * console.log(`需要执行 ${transactions.length} 个交易`);
     * 
     * // 用户需要签名并执行每个交易
     * for (const tx of transactions) {
     *   // await wallet.signAndExecuteTransaction({ transaction: tx });
     * }
     * ```
     */
    buildCleanUpTransaction(
        orders: Order[],
        options: CleanupTransactionOptions = {}
    ): Transaction[] {
        const {
            maxOrdersPerTransaction = 100,
            gasBudget = 100_000_000n, // 0.1 SUI
        } = options;

        if (orders.length === 0) {
            return [];
        }

        // 确保不超过 PTB 的命令限制
        const safeMaxOrders = Math.min(maxOrdersPerTransaction, MAX_COMMANDS_PER_PTB);

        // 将订单分组，每组创建一个交易
        const transactions: Transaction[] = [];

        for (let i = 0; i < orders.length; i += safeMaxOrders) {
            const batchOrders = orders.slice(i, i + safeMaxOrders);
            const tx = this.buildSingleCleanupTransaction(batchOrders, gasBudget);
            transactions.push(tx);
        }

        return transactions;
    }

    /**
     * 构建单个清理交易
     * @private
     */
    private buildSingleCleanupTransaction(orders: Order[], gasBudget: bigint): Transaction {
        const tx = new Transaction();

        // 设置 Gas 预算
        tx.setGasBudget(Number(gasBudget));

        // 为每个订单添加 cancel_order 调用
        for (const order of orders) {
            // DeepBook V3 的 cancel_order 函数签名 (示例):
            // public fun cancel_order<BaseAsset, QuoteAsset>(
            //     pool: &mut Pool<BaseAsset, QuoteAsset>,
            //     balance_manager: &mut BalanceManager,
            //     order_id: u128,
            //     ctx: &mut TxContext
            // )

            // 注意：实际的类型参数需要根据池子的 base/quote 资产类型确定
            // 这里使用占位符，实际使用时需要从池子对象中获取
            tx.moveCall({
                target: `${DEEPBOOK_PACKAGE_ID}::${DEEPBOOK_MODULES.POOL}::${DEEPBOOK_FUNCTIONS.CANCEL_ORDER}`,
                // typeArguments: [baseAssetType, quoteAssetType], // 需要从池子获取
                arguments: [
                    tx.object(order.poolId),           // pool 对象
                    // tx.object(balanceManagerId),    // balance_manager 对象 (需要传入)
                    tx.pure.u128(order.orderId),       // order_id
                ],
            });
        }

        return tx;
    }

    /**
     * 查找用户的 BalanceManager 对象
     * @private
     */
    private async findBalanceManager(
        userAddress: string,
        poolId: string
    ): Promise<string | null> {
        try {
            // 查询用户拥有的所有对象
            const objects = await this.client.getOwnedObjects({
                owner: userAddress,
                filter: {
                    StructType: `${DEEPBOOK_PACKAGE_ID}::${DEEPBOOK_MODULES.BALANCE_MANAGER}::BalanceManager`,
                },
                options: {
                    showContent: true,
                },
            });

            // 查找匹配指定池子的 BalanceManager
            for (const obj of objects.data) {
                if (obj.data?.content && 'fields' in obj.data.content) {
                    const fields = obj.data.content.fields as any;

                    // 检查是否匹配池子 ID
                    if (fields.pool_id === poolId || fields.poolId === poolId) {
                        return obj.data.objectId;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('查找 BalanceManager 失败:', error);
            return null;
        }
    }

    /**
     * 从 BalanceManager 的动态字段中获取订单
     * @private
     */
    private async fetchOrdersFromBalanceManager(
        balanceManagerId: string,
        userAddress: string,
        poolId: string,
        limit: number
    ): Promise<Order[]> {
        const orders: Order[] = [];

        try {
            // 获取 BalanceManager 的动态字段
            // DeepBook V3 将订单存储在动态字段中，字段名通常是订单 ID
            let hasNextPage = true;
            let cursor: string | null | undefined = null;

            while (hasNextPage && orders.length < limit) {
                const dynamicFields = await this.client.getDynamicFields({
                    parentId: balanceManagerId,
                    cursor,
                    limit: Math.min(50, limit - orders.length),
                });

                // 解析每个动态字段为订单对象
                for (const field of dynamicFields.data) {
                    try {
                        const order = await this.parseDynamicFieldToOrder(
                            field.objectId,
                            userAddress,
                            poolId
                        );

                        if (order && order.status === OrderStatus.OPEN) {
                            orders.push(order);
                        }
                    } catch (error) {
                        console.warn(`解析订单 ${field.objectId} 失败:`, error);
                        // 继续处理其他订单
                    }
                }

                hasNextPage = dynamicFields.hasNextPage;
                cursor = dynamicFields.nextCursor;
            }

            return orders;
        } catch (error) {
            console.error('获取动态字段失败:', error);
            return orders;
        }
    }

    /**
     * 将动态字段解析为订单对象
     * @private
     */
    private async parseDynamicFieldToOrder(
        objectId: string,
        userAddress: string,
        poolId: string
    ): Promise<Order | null> {
        try {
            const obj: SuiObjectResponse = await this.client.getObject({
                id: objectId,
                options: {
                    showContent: true,
                    showOwner: true,
                    showStorageRebate: true,
                },
            });

            if (!obj.data?.content || !('fields' in obj.data.content)) {
                return null;
            }

            const fields = obj.data.content.fields as any;

            // 解析订单字段
            // 注意：字段名称可能因 DeepBook V3 版本而异，需要根据实际情况调整
            const order: Order = {
                orderId: fields.order_id || fields.orderId || objectId,
                side: this.parseOrderSide(fields.is_bid ?? fields.isBid),
                price: BigInt(fields.price || 0),
                quantity: BigInt(fields.quantity || 0),
                filledQuantity: BigInt(fields.filled_quantity || fields.filledQuantity || 0),
                status: this.parseOrderStatus(fields),
                timestamp: Number(fields.timestamp || Date.now()),
                poolId,
                owner: userAddress,
                storageRebate: obj.data.storageRebate ? BigInt(obj.data.storageRebate) : undefined,
            };

            return order;
        } catch (error) {
            console.error(`解析订单对象 ${objectId} 失败:`, error);
            return null;
        }
    }

    /**
     * 为订单补充实际的存储押金信息
     * @private
     */
    private async enrichOrdersWithActualRebate(orders: Order[]): Promise<void> {
        // 批量获取对象信息以提高效率
        const objectIds = orders.map(order => order.orderId);

        try {
            const objects = await this.client.multiGetObjects({
                ids: objectIds,
                options: {
                    showStorageRebate: true,
                },
            });

            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                if (obj.data?.storageRebate) {
                    orders[i].storageRebate = BigInt(obj.data.storageRebate);
                }
            }
        } catch (error) {
            console.warn('获取实际存储押金失败，将使用估算值:', error);
        }
    }

    /**
     * 解析订单方向
     * @private
     */
    private parseOrderSide(isBid: boolean | undefined): OrderSide {
        return isBid ? OrderSide.BID : OrderSide.ASK;
    }

    /**
     * 解析订单状态
     * @private
     */
    private parseOrderStatus(fields: any): OrderStatus {
        // 根据已成交数量判断状态
        const quantity = BigInt(fields.quantity || 0);
        const filledQuantity = BigInt(fields.filled_quantity || fields.filledQuantity || 0);

        if (filledQuantity === 0n) {
            return OrderStatus.OPEN;
        } else if (filledQuantity < quantity) {
            return OrderStatus.PARTIALLY_FILLED;
        } else {
            return OrderStatus.FILLED;
        }
    }

    /**
     * 将 MIST 转换为 SUI (字符串格式，保留 9 位小数)
     * @private
     */
    private mistToSui(mist: bigint): string {
        const sui = Number(mist) / Number(MIST_PER_SUI);
        return sui.toFixed(9);
    }

    // ============================================
    // 公共清洁工功能 (Public Janitor)
    // ============================================

    /**
     * 扫描池子中的所有订单（包括其他用户的订单）
     * 
     * 注意：这是公共清洁工功能，可以扫描任何用户的订单
     * 
     * @param poolId - 池子 ID
     * @param options - 扫描选项
     * @returns 池子扫描结果
     * 
     * @example
     * ```typescript
     * const result = await service.scanPoolForExpiredOrders(poolId, {
     *   onlyExpired: true,
     *   limit: 100,
     * });
     * console.log(`找到 ${result.expiredOrders} 个过期订单`);
     * ```
     */
    async scanPoolForExpiredOrders(
        poolId: string,
        options: import('./types').PoolScanOptions = {}
    ): Promise<import('./types').PoolScanResult> {
        const {
            onlyExpired = true,
            currentTimestamp = Date.now(),
            limit = 1000,
            fetchActualRebate = false,
        } = options;

        try {
            console.log(`开始扫描池子 ${poolId}...`);

            // 1. 获取 Pool 的动态字段（ticks）
            const ticks = await this.getPoolTicks(poolId);
            console.log(`找到 ${ticks.length} 个价格层级 (ticks)`);

            // 2. 遍历 ticks 获取订单
            const allOrders: Order[] = [];
            let ticksScanned = 0;

            for (const tick of ticks) {
                try {
                    const orders = await this.getTickOrders(tick.objectId, poolId);
                    allOrders.push(...orders);
                    ticksScanned++;

                    console.log(`  扫描 tick ${ticksScanned}/${ticks.length}: 找到 ${orders.length} 个订单`);

                    if (allOrders.length >= limit) {
                        console.log(`已达到限制 ${limit}，停止扫描`);
                        break;
                    }
                } catch (error) {
                    console.warn(`扫描 tick ${tick.objectId} 失败:`, error);
                    // 继续扫描其他 ticks
                }
            }

            console.log(`总共扫描到 ${allOrders.length} 个订单`);

            // 3. 过滤过期订单
            const filteredOrders = onlyExpired
                ? allOrders.filter(order => this.isOrderExpired(order, currentTimestamp))
                : allOrders;

            console.log(`过期订单: ${filteredOrders.length}`);

            // 4. 如果需要，获取实际存储押金
            if (fetchActualRebate && filteredOrders.length > 0) {
                await this.enrichOrdersWithActualRebate(filteredOrders);
            }

            // 5. 计算预计返还
            const rebate = this.calculateRebate(filteredOrders);

            return {
                poolId,
                totalOrders: allOrders.length,
                expiredOrders: filteredOrders.length,
                orders: filteredOrders,
                estimatedRebateMist: rebate.totalRebateMist,
                estimatedRebateSui: rebate.totalRebateSui,
                ticksScanned,
            };
        } catch (error) {
            console.error('扫描池子失败:', error);
            throw new Error(`无法扫描池子: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 判断订单是否过期
     * 
     * @param order - 订单对象
     * @param currentTimestamp - 当前时间戳（毫秒），默认为 Date.now()
     * @returns 是否过期
     */
    isOrderExpired(order: Order, currentTimestamp: number = Date.now()): boolean {
        // 如果订单没有设置过期时间，则永不过期
        if (!order.expireTimestamp) {
            return false;
        }

        // 检查是否已过期
        return currentTimestamp > order.expireTimestamp;
    }

    /**
     * 构建公共清理交易（清理任何用户的过期订单）
     * 
     * 注意：
     * - 这是公共清洁工功能，可以清理任何用户的过期订单
     * - 需要 DeepBook V3 合约支持公共清理函数
     * - 返回的交易需要用户签名后才能执行
     * 
     * @param orders - 要清理的订单列表
     * @param options - 交易构建选项
     * @returns 可编程交易块数组
     * 
     * @example
     * ```typescript
     * const transactions = service.buildPublicCleanupTransaction(expiredOrders);
     * 
     * for (const tx of transactions) {
     *   const result = await wallet.signAndExecuteTransaction({ transaction: tx });
     *   console.log(`清理成功: ${result.digest}`);
     * }
     * ```
     */
    buildPublicCleanupTransaction(
        orders: Order[],
        options: import('./types').CleanupTransactionOptions = {}
    ): Transaction[] {
        const {
            maxOrdersPerTransaction = 100,
            gasBudget = 100_000_000n,
        } = options;

        if (orders.length === 0) {
            return [];
        }

        // 确保不超过 PTB 的命令限制
        const safeMaxOrders = Math.min(maxOrdersPerTransaction, MAX_COMMANDS_PER_PTB);

        // 将订单分组，每组创建一个交易
        const transactions: Transaction[] = [];

        for (let i = 0; i < orders.length; i += safeMaxOrders) {
            const batchOrders = orders.slice(i, i + safeMaxOrders);
            const tx = this.buildSinglePublicCleanupTransaction(batchOrders, gasBudget);
            transactions.push(tx);
        }

        return transactions;
    }

    /**
     * 构建单个公共清理交易
     * @private
     */
    private buildSinglePublicCleanupTransaction(orders: Order[], gasBudget: bigint): Transaction {
        const tx = new Transaction();

        // 设置 Gas 预算
        tx.setGasBudget(Number(gasBudget));

        // 为每个订单添加 clean_up_expired_order 调用
        // 注意：这是假设的函数名，实际需要根据 DeepBook V3 合约确定
        for (const order of orders) {
            // DeepBook V3 的 clean_up_expired_order 函数签名 (假设):
            // public entry fun clean_up_expired_order<BaseAsset, QuoteAsset>(
            //     pool: &mut Pool<BaseAsset, QuoteAsset>,
            //     order_id: u128,
            //     ctx: &mut TxContext
            // )

            // 注意：实际的函数名和参数需要根据合约确定
            // 这里使用占位符
            tx.moveCall({
                target: `${DEEPBOOK_PACKAGE_ID}::${DEEPBOOK_MODULES.POOL}::clean_up_expired_order`,
                // typeArguments: [baseAssetType, quoteAssetType], // 需要从池子获取
                arguments: [
                    tx.object(order.poolId),       // pool 对象
                    tx.pure.u128(order.orderId),   // order_id
                ],
            });
        }

        return tx;
    }

    /**
     * 获取 Pool 的所有 ticks（价格层级）
     * @private
     */
    private async getPoolTicks(poolId: string): Promise<import('./types').DynamicFieldInfo[]> {
        const ticks: import('./types').DynamicFieldInfo[] = [];
        let hasNextPage = true;
        let cursor: string | null | undefined = null;

        try {
            while (hasNextPage) {
                const result = await this.client.getDynamicFields({
                    parentId: poolId,
                    cursor,
                    limit: 50,
                });

                ticks.push(...result.data);
                hasNextPage = result.hasNextPage;
                cursor = result.nextCursor;
            }

            return ticks;
        } catch (error) {
            console.error('获取 Pool ticks 失败:', error);
            return ticks;
        }
    }

    /**
     * 获取指定 tick 的所有订单
     * @private
     */
    private async getTickOrders(tickObjectId: string, poolId: string): Promise<Order[]> {
        try {
            // 获取 tick 对象
            const tickObj = await this.client.getObject({
                id: tickObjectId,
                options: {
                    showContent: true,
                    showOwner: true,
                    showStorageRebate: true,
                },
            });

            if (!tickObj.data?.content || !('fields' in tickObj.data.content)) {
                return [];
            }

            const fields = tickObj.data.content.fields as any;

            // 解析 tick 中的订单列表
            // 注意：实际结构需要根据 DeepBook V3 合约确定
            // 这里假设 tick 对象有一个 orders 字段，包含订单列表

            const orders: Order[] = [];

            // 如果 tick 有订单列表字段
            if (fields.orders && Array.isArray(fields.orders)) {
                for (const orderData of fields.orders) {
                    try {
                        const order = this.parseOrderData(orderData, poolId, tickObj.data.storageRebate);
                        if (order) {
                            orders.push(order);
                        }
                    } catch (error) {
                        console.warn(`解析订单失败:`, error);
                    }
                }
            }

            // 或者，如果订单存储在动态字段中
            // 需要进一步查询动态字段
            const orderFields = await this.client.getDynamicFields({
                parentId: tickObjectId,
                limit: 50,
            });

            for (const field of orderFields.data) {
                try {
                    const order = await this.parseDynamicFieldToOrder(
                        field.objectId,
                        'unknown', // 所有者地址未知（公共扫描）
                        poolId
                    );

                    if (order) {
                        orders.push(order);
                    }
                } catch (error) {
                    console.warn(`解析订单 ${field.objectId} 失败:`, error);
                }
            }

            return orders;
        } catch (error) {
            console.error(`获取 tick ${tickObjectId} 的订单失败:`, error);
            return [];
        }
    }

    /**
     * 解析订单数据
     * @private
     */
    private parseOrderData(orderData: any, poolId: string, storageRebate?: string | null): Order | null {
        try {
            const order: Order = {
                orderId: orderData.order_id || orderData.orderId || orderData.id,
                side: this.parseOrderSide(orderData.is_bid ?? orderData.isBid),
                price: BigInt(orderData.price || 0),
                quantity: BigInt(orderData.quantity || 0),
                filledQuantity: BigInt(orderData.filled_quantity || orderData.filledQuantity || 0),
                status: this.parseOrderStatus(orderData),
                timestamp: Number(orderData.timestamp || orderData.created_at || Date.now()),
                poolId,
                owner: orderData.owner || orderData.user || 'unknown',
                expireTimestamp: orderData.expire_timestamp || orderData.expireTimestamp
                    ? Number(orderData.expire_timestamp || orderData.expireTimestamp)
                    : undefined,
                storageRebate: storageRebate ? BigInt(storageRebate) : undefined,
            };

            return order;
        } catch (error) {
            console.error('解析订单数据失败:', error);
            return null;
        }
    }

    /**
     * 获取 SuiClient 实例
     * 用于高级用户直接访问底层 API
     */
    getClient(): SuiClient {
        return this.client;
    }
}
