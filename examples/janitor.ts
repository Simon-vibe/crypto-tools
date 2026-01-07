/**
 * DeepBook V3 公共清洁工示例
 * 
 * 演示如何扫描池子中的过期订单并清理（不限于自己的订单）
 */

import { DeepBookService } from '../src/deepbook-service';
import { loadConfig } from '../src/config-loader';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';

/**
 * 主函数 - 公共清洁工流程
 */
async function main() {
    console.log('='.repeat(80));
    console.log('DeepBook V3 公共清洁工 (Public Janitor)');
    console.log('='.repeat(80));
    console.log('');

    // ============================================
    // 步骤 1: 加载配置
    // ============================================

    console.log('步骤 1: 加载配置...');
    const config = loadConfig();
    const service = new DeepBookService(config.rpcUrl || 'https://fullnode.mainnet.sui.io:443');

    console.log(`✓ 网络: ${config.network}`);
    console.log(`✓ 池子 ID: ${config.poolId || '未配置'}`);
    console.log('');

    if (!config.poolId) {
        console.error('❌ 错误: 请在 config.json 中配置 poolId');
        return;
    }

    // ============================================
    // 步骤 2: 扫描池子中的过期订单
    // ============================================

    console.log('步骤 2: 扫描池子中的过期订单...');
    console.log('─'.repeat(80));

    try {
        const result = await service.scanPoolForExpiredOrders(config.poolId, {
            onlyExpired: true,      // 只扫描过期订单
            limit: 100,             // 最多扫描 100 个订单
            fetchActualRebate: false, // 使用估算值（更快）
        });

        console.log('');
        console.log('扫描结果:');
        console.log('─'.repeat(80));
        console.log(`✓ 扫描的 Ticks: ${result.ticksScanned}`);
        console.log(`✓ 总订单数: ${result.totalOrders}`);
        console.log(`✓ 过期订单数: ${result.expiredOrders}`);
        console.log(`✓ 预计可获得: ${result.estimatedRebateSui} SUI (${result.estimatedRebateMist} MIST)`);
        console.log('');

        if (result.expiredOrders === 0) {
            console.log('没有找到过期订单，无需清理。');
            return;
        }

        // 显示前 5 个过期订单的详情
        console.log('过期订单详情（前 5 个）:');
        console.log('─'.repeat(80));
        result.orders.slice(0, 5).forEach((order, index) => {
            console.log(`订单 #${index + 1}:`);
            console.log(`  ID: ${order.orderId}`);
            console.log(`  所有者: ${order.owner}`);
            console.log(`  方向: ${order.side === 'bid' ? '买单' : '卖单'}`);
            console.log(`  价格: ${order.price}`);
            console.log(`  数量: ${order.quantity}`);
            console.log(`  过期时间: ${order.expireTimestamp ? new Date(order.expireTimestamp).toISOString() : '未设置'}`);
            console.log('');
        });

        // ============================================
        // 步骤 3: 构建清理交易
        // ============================================

        console.log('步骤 3: 构建清理交易...');
        console.log('─'.repeat(80));

        const transactions = service.buildPublicCleanupTransaction(result.orders, {
            maxOrdersPerTransaction: 50,
            gasBudget: 100_000_000n, // 0.1 SUI
        });

        console.log(`✓ 创建了 ${transactions.length} 个交易`);
        console.log(`✓ 每个交易最多清理 50 个订单`);
        console.log('');

        // ============================================
        // 步骤 4: 执行清理交易
        // ============================================

        console.log('步骤 4: 执行清理交易...');
        console.log('─'.repeat(80));

        const keypair = Ed25519Keypair.fromSecretKey(fromB64(config.privateKey));
        const signerAddress = keypair.toSuiAddress();

        console.log(`✓ 使用地址: ${signerAddress}`);
        console.log(`✓ 准备执行 ${transactions.length} 个交易\n`);

        let totalActualRebate = 0;
        let successCount = 0;

        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            console.log(`执行交易 ${i + 1}/${transactions.length}...`);

            try {
                const txResult = await service.getClient().signAndExecuteTransaction({
                    signer: keypair,
                    transaction: tx,
                    options: {
                        showEffects: true,
                        showBalanceChanges: true,
                    },
                });

                console.log(`  ✅ 交易成功! Digest: ${txResult.digest}`);

                // 显示余额变化
                if (txResult.balanceChanges) {
                    const rebateChange = txResult.balanceChanges.find(
                        (bc) =>
                            'owner' in bc &&
                            typeof bc.owner === 'object' &&
                            bc.owner !== null &&
                            'AddressOwner' in bc.owner &&
                            bc.owner.AddressOwner === signerAddress &&
                            Number(bc.amount) > 0
                    );

                    if (rebateChange) {
                        const rebateAmount = Number(rebateChange.amount) / 1e9;
                        totalActualRebate += rebateAmount;
                        console.log(`  💰 实际收到回扣: ${rebateAmount.toFixed(9)} SUI`);
                    }
                }

                successCount++;
                console.log('');
            } catch (error) {
                console.error(`  ❌ 交易失败:`, error);
                if (error instanceof Error) {
                    console.error(`  错误信息: ${error.message}`);
                }
                console.log('');
            }
        }

        // ============================================
        // 总结
        // ============================================

        console.log('执行总结:');
        console.log('='.repeat(80));
        console.log(`✓ 成功执行: ${successCount}/${transactions.length} 个交易`);
        console.log(`✓ 清理订单数: ${result.expiredOrders}`);
        console.log(`✓ 实际收到回扣: ${totalActualRebate.toFixed(9)} SUI`);
        console.log(`✓ 预计回扣: ${result.estimatedRebateSui} SUI`);
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
 * 简化示例 - 仅扫描不执行
 */
async function scanOnly() {
    const config = loadConfig();
    const service = new DeepBookService(config.rpcUrl || 'https://fullnode.mainnet.sui.io:443');

    if (!config.poolId) {
        console.error('请在 config.json 中配置 poolId');
        return;
    }

    const result = await service.scanPoolForExpiredOrders(config.poolId, {
        onlyExpired: true,
        limit: 50,
    });

    console.log(`找到 ${result.expiredOrders} 个过期订单`);
    console.log(`预计可获得: ${result.estimatedRebateSui} SUI`);
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

// 导出示例函数
export {
    main,
    scanOnly,
};
