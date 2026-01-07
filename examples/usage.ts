/**
 * DeepBook V3 使用示例
 * 
 * 演示如何使用 DeepBookService 来：
 * 1. 查询用户的未完成订单
 * 2. 计算存储费返还
 * 3. 构建并执行清理交易
 */

import { DeepBookService } from '../src/deepbook-service';
import { NETWORK_CONFIG } from '../src/constants';

/**
 * 主函数 - 完整的使用流程
 */
async function main() {
    // ============================================
    // 步骤 1: 初始化服务
    // ============================================

    console.log('初始化 DeepBook V3 服务...\n');

    const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);

    // ============================================
    // 步骤 2: 配置参数
    // ============================================

    // 用户地址 (示例)
    const userAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // 池子 ID (示例 - SUI/USDC 池子)
    const poolId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    console.log(`用户地址: ${userAddress}`);
    console.log(`池子 ID: ${poolId}\n`);

    // ============================================
    // 步骤 3: 获取未完成订单
    // ============================================

    console.log('正在查询未完成订单...');

    try {
        const orders = await service.fetchUserOpenOrders(userAddress, poolId, {
            // 设置为 true 以获取实际的存储押金（更准确但更慢）
            // 设置为 false 使用估算值（更快）
            fetchActualRebate: true,
            limit: 100,
        });

        console.log(`✓ 找到 ${orders.length} 个未完成订单\n`);

        if (orders.length === 0) {
            console.log('没有未完成的订单，无需清理。');
            return;
        }

        // 显示订单详情
        console.log('订单详情:');
        console.log('─'.repeat(80));

        orders.forEach((order, index) => {
            console.log(`订单 #${index + 1}:`);
            console.log(`  ID: ${order.orderId}`);
            console.log(`  方向: ${order.side === 'bid' ? '买单' : '卖单'}`);
            console.log(`  价格: ${order.price}`);
            console.log(`  数量: ${order.quantity}`);
            console.log(`  已成交: ${order.filledQuantity}`);
            console.log(`  状态: ${order.status}`);
            if (order.storageRebate) {
                console.log(`  存储押金: ${order.storageRebate} MIST`);
            }
            console.log('');
        });

        // ============================================
        // 步骤 4: 计算存储费返还
        // ============================================

        console.log('计算存储费返还...\n');

        const rebateCalc = service.calculateRebate(orders);

        console.log('返还计算结果:');
        console.log('─'.repeat(80));
        console.log(`订单总数: ${rebateCalc.totalOrders}`);
        console.log(`总返还金额: ${rebateCalc.totalRebateSui} SUI (${rebateCalc.totalRebateMist} MIST)`);
        console.log(`计算方式: ${rebateCalc.isEstimated ? '估算值' : '实际值'}`);
        console.log('');

        // 显示每个订单的返还详情
        console.log('各订单返还详情:');
        rebateCalc.orderRebates.forEach((rebate, index) => {
            console.log(`  订单 #${index + 1}: ${rebate.rebateSui} SUI`);
        });
        console.log('');

        // ============================================
        // 步骤 5: 构建清理交易
        // ============================================

        console.log('构建清理交易...\n');

        const transactions = service.buildCleanUpTransaction(orders, {
            // 每个交易最多取消 50 个订单
            maxOrdersPerTransaction: 50,
            // Gas 预算: 0.1 SUI
            gasBudget: 100_000_000n,
        });

        console.log(`✓ 创建了 ${transactions.length} 个交易\n`);

        // 显示交易信息
        transactions.forEach((tx, index) => {
            console.log(`交易 #${index + 1}:`);
            console.log(`  类型: Programmable Transaction Block`);
            console.log(`  包含订单数: ${Math.min(50, orders.length - index * 50)}`);
            console.log('');
        });

        // ============================================
        // 步骤 6: 执行交易（需要钱包签名）
        // ============================================

        console.log('注意事项:');
        console.log('─'.repeat(80));
        console.log('1. 上述交易需要用户使用钱包签名后才能执行');
        console.log('2. 每个交易都需要单独签名和执行');
        console.log('3. 执行交易需要支付 Gas 费用');
        console.log('4. 成功取消订单后，存储费将自动返还到用户账户');
        console.log('');

        console.log('示例代码（需要集成钱包）:');
        console.log('```typescript');
        console.log('// 使用 Sui Wallet Adapter 或其他钱包 SDK');
        console.log('for (const tx of transactions) {');
        console.log('  const result = await wallet.signAndExecuteTransaction({');
        console.log('    transaction: tx,');
        console.log('  });');
        console.log('  console.log(`交易已执行: ${result.digest}`);');
        console.log('}');
        console.log('```');
        console.log('');

        // ============================================
        // 总结
        // ============================================

        console.log('总结:');
        console.log('─'.repeat(80));
        console.log(`✓ 找到 ${orders.length} 个未完成订单`);
        console.log(`✓ 预计可返还 ${rebateCalc.totalRebateSui} SUI`);
        console.log(`✓ 需要执行 ${transactions.length} 个交易`);
        console.log('');

    } catch (error) {
        console.error('❌ 发生错误:', error);

        if (error instanceof Error) {
            console.error('错误详情:', error.message);
            console.error('堆栈跟踪:', error.stack);
        }
    }
}

/**
 * 简化示例 - 仅查询和计算
 */
async function simpleExample() {
    const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);

    const userAddress = '0x...';
    const poolId = '0x...';

    // 获取订单
    const orders = await service.fetchUserOpenOrders(userAddress, poolId);

    // 计算返还
    const rebate = service.calculateRebate(orders);

    console.log(`可返还: ${rebate.totalRebateSui} SUI`);
}

/**
 * 高级示例 - 使用实际存储押金
 */
async function advancedExample() {
    const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);

    const userAddress = '0x...';
    const poolId = '0x...';

    // 获取订单（包含实际存储押金）
    const orders = await service.fetchUserOpenOrders(userAddress, poolId, {
        fetchActualRebate: true, // 获取实际值，更准确
    });

    // 计算返还（使用实际值）
    const rebate = service.calculateRebate(orders);

    console.log(`实际可返还: ${rebate.totalRebateSui} SUI`);
    console.log(`使用实际值: ${!rebate.isEstimated}`);
}

/**
 * 批量处理示例 - 处理多个池子
 */
async function batchExample() {
    const service = new DeepBookService(NETWORK_CONFIG.MAINNET.url);

    const userAddress = '0x...';
    const poolIds = [
        '0xpool1...',
        '0xpool2...',
        '0xpool3...',
    ];

    let totalRebateMist = 0n;

    for (const poolId of poolIds) {
        const orders = await service.fetchUserOpenOrders(userAddress, poolId);
        const rebate = service.calculateRebate(orders);

        totalRebateMist += rebate.totalRebateMist;

        console.log(`池子 ${poolId}: ${rebate.totalRebateSui} SUI`);
    }

    const totalSui = Number(totalRebateMist) / 1_000_000_000;
    console.log(`\n所有池子总计: ${totalSui.toFixed(9)} SUI`);
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

// 导出示例函数供其他模块使用
export {
    main,
    simpleExample,
    advancedExample,
    batchExample,
};
