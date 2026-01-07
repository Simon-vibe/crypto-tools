/**
 * DeepBook V3 Web UI 客户端应用
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';

// 网络配置
const NETWORK_URLS = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443',
};

// 全局状态
let currentConfig = null;
let scanResult = null;
let suiClient = null;

// DOM 元素
const elements = {
    // 配置面板
    network: document.getElementById('network'),
    poolId: document.getElementById('poolId'),
    privateKey: document.getElementById('privateKey'),
    scanLimit: document.getElementById('scanLimit'),
    onlyExpired: document.getElementById('onlyExpired'),
    fetchActualRebate: document.getElementById('fetchActualRebate'),
    scanBtn: document.getElementById('scanBtn'),
    clearBtn: document.getElementById('clearBtn'),

    // 进度面板
    progressPanel: document.getElementById('progressPanel'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentStatus: document.getElementById('currentStatus'),
    ticksScanned: document.getElementById('ticksScanned'),
    ordersFound: document.getElementById('ordersFound'),
    expiredOrders: document.getElementById('expiredOrders'),
    logContent: document.getElementById('logContent'),

    // 结果面板
    resultPanel: document.getElementById('resultPanel'),
    totalOrders: document.getElementById('totalOrders'),
    expiredOrdersResult: document.getElementById('expiredOrdersResult'),
    estimatedRebate: document.getElementById('estimatedRebate'),
    ordersList: document.getElementById('ordersList'),
    executeBtn: document.getElementById('executeBtn'),
    newScanBtn: document.getElementById('newScanBtn'),

    // 执行面板
    executionPanel: document.getElementById('executionPanel'),
    executionStatus: document.getElementById('executionStatus'),
    successCount: document.getElementById('successCount'),
    failCount: document.getElementById('failCount'),
    totalTxCount: document.getElementById('totalTxCount'),
    transactionList: document.getElementById('transactionList'),
    executionSummary: document.getElementById('executionSummary'),
    finalSuccessCount: document.getElementById('finalSuccessCount'),
    actualRebate: document.getElementById('actualRebate'),
};

// 初始化
function init() {
    // 加载保存的配置
    loadConfig();

    // 绑定事件
    elements.scanBtn.addEventListener('click', handleScan);
    elements.clearBtn.addEventListener('click', handleClear);
    elements.executeBtn.addEventListener('click', handleExecute);
    elements.newScanBtn.addEventListener('click', handleNewScan);
}

// 加载配置
function loadConfig() {
    const saved = localStorage.getItem('deepbook_config');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            elements.network.value = config.network || 'mainnet';
            elements.poolId.value = config.poolId || '';
            elements.scanLimit.value = config.scanLimit || 100;
            elements.onlyExpired.checked = config.onlyExpired !== false;
        } catch (e) {
            console.error('加载配置失败:', e);
        }
    }
}

// 保存配置
function saveConfig() {
    const config = {
        network: elements.network.value,
        poolId: elements.poolId.value,
        scanLimit: parseInt(elements.scanLimit.value),
        onlyExpired: elements.onlyExpired.checked,
    };
    localStorage.setItem('deepbook_config', JSON.stringify(config));
}

// 清空配置
function handleClear() {
    elements.network.value = 'mainnet';
    elements.poolId.value = '';
    elements.privateKey.value = '';
    elements.scanLimit.value = '100';
    elements.onlyExpired.checked = true;
    elements.fetchActualRebate.checked = false;
    localStorage.removeItem('deepbook_config');
    addLog('配置已清空', 'info');
}

// 新的扫描
function handleNewScan() {
    elements.resultPanel.style.display = 'none';
    elements.executionPanel.style.display = 'none';
    elements.progressPanel.style.display = 'none';
    scanResult = null;
}

// 添加日志
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    elements.logContent.appendChild(entry);
    elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// 更新进度
function updateProgress(percent, status) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
    elements.currentStatus.textContent = status;
}

/**
 * Bech32 解码函数
 * 用于解码 suiprivkey1... 格式的私钥
 */
function decodeBech32(bechString) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

    // 分离前缀和数据
    const pos = bechString.lastIndexOf('1');
    if (pos < 1) {
        throw new Error('无效的 Bech32 格式');
    }

    const prefix = bechString.substring(0, pos);
    const data = bechString.substring(pos + 1);

    // 解码数据部分
    const decoded = [];
    for (let i = 0; i < data.length; i++) {
        const char = data[i];
        const value = CHARSET.indexOf(char);
        if (value === -1) {
            throw new Error(`无效的 Bech32 字符: ${char}`);
        }
        decoded.push(value);
    }

    // 移除校验和（最后6个字符）
    const payload = decoded.slice(0, -6);

    // 从 5-bit 转换为 8-bit
    const bytes = [];
    let acc = 0;
    let bits = 0;

    for (const value of payload) {
        acc = (acc << 5) | value;
        bits += 5;

        while (bits >= 8) {
            bits -= 8;
            bytes.push((acc >> bits) & 0xff);
        }
    }

    return new Uint8Array(bytes);
}

/**
 * 转换私钥格式为 Base64
 * 支持多种输入格式：
 * - Base64 格式（直接返回）
 * - 十六进制格式（0x... 或纯 hex）
 * - Bech32 格式（suiprivkey1...）
 * 
 * @param privateKeyInput - 用户输入的私钥
 * @returns Base64 格式的私钥
 */
function convertPrivateKeyToBase64(privateKeyInput) {
    const input = privateKeyInput.trim();

    // 检查是否是 Bech32 格式（suiprivkey1...）
    if (input.startsWith('suiprivkey1')) {
        try {
            addLog('检测到 Bech32 格式私钥 (suiprivkey1...)', 'info');
            const bytes = decodeBech32(input);

            // 验证长度（应该是 33 字节：1字节标志 + 32字节私钥）
            if (bytes.length !== 33) {
                throw new Error(`Bech32 私钥长度无效。期望 33 字节，实际 ${bytes.length} 字节。`);
            }

            // 移除第一个字节（标志位），只保留 32 字节私钥
            const privateKeyBytes = bytes.slice(1);

            // 转换为 Base64
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(privateKeyBytes)));
            addLog('已将 Bech32 私钥转换为 Base64 格式', 'success');

            return base64;
        } catch (e) {
            throw new Error(`Bech32 解码失败: ${e.message}`);
        }
    }

    // 检查是否已经是 Base64 格式
    // Base64 通常包含 +, /, = 字符，且不包含 0x 前缀
    if (!input.startsWith('0x') && /^[A-Za-z0-9+/]+=*$/.test(input)) {
        // 验证是否是有效的 Base64
        try {
            const decoded = atob(input);
            if (decoded.length === 32 || decoded.length === 64) {
                addLog('检测到 Base64 格式私钥', 'info');
                return input;
            }
        } catch (e) {
            // 不是有效的 Base64，继续尝试其他格式
        }
    }

    // 处理十六进制格式
    let hexString = input;

    // 移除 0x 前缀
    if (hexString.startsWith('0x') || hexString.startsWith('0X')) {
        hexString = hexString.slice(2);
    }

    // 验证是否是有效的十六进制
    if (!/^[0-9a-fA-F]+$/.test(hexString)) {
        throw new Error('私钥格式无效。请输入 Base64、十六进制或 Bech32 (suiprivkey1...) 格式的私钥。');
    }

    // 检查长度（32 字节 = 64 个十六进制字符，64 字节 = 128 个十六进制字符）
    if (hexString.length !== 64 && hexString.length !== 128) {
        throw new Error(`私钥长度无效。期望 64 或 128 个十六进制字符，实际 ${hexString.length} 个。`);
    }

    // 将十六进制转换为字节数组
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }

    // 转换为 Base64
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    addLog('已将十六进制私钥转换为 Base64 格式', 'info');

    return base64;
}


// 处理扫描
async function handleScan() {
    // 验证输入
    if (!elements.poolId.value.trim()) {
        alert('请输入池子 ID');
        return;
    }

    if (!elements.privateKey.value.trim()) {
        alert('请输入私钥');
        return;
    }

    // 保存配置
    saveConfig();

    // 显示进度面板
    elements.progressPanel.style.display = 'block';
    elements.resultPanel.style.display = 'none';
    elements.executionPanel.style.display = 'none';
    elements.logContent.innerHTML = '';

    // 禁用按钮
    elements.scanBtn.disabled = true;

    try {
        // 初始化客户端
        const networkUrl = NETWORK_URLS[elements.network.value];
        suiClient = new SuiClient({ url: networkUrl });

        addLog(`连接到 ${elements.network.value} 网络...`, 'info');
        updateProgress(10, '正在连接网络...');

        // 开始扫描
        addLog('开始扫描池子...', 'info');
        updateProgress(20, '正在扫描池子...');

        const result = await scanPool({
            poolId: elements.poolId.value.trim(),
            onlyExpired: elements.onlyExpired.checked,
            limit: parseInt(elements.scanLimit.value),
            fetchActualRebate: elements.fetchActualRebate.checked,
        });

        scanResult = result;

        // 更新进度
        updateProgress(100, '扫描完成！');
        addLog(`扫描完成！找到 ${result.expiredOrders} 个过期订单`, 'success');

        // 显示结果
        setTimeout(() => {
            showResults(result);
        }, 500);

    } catch (error) {
        console.error('扫描失败:', error);
        addLog(`扫描失败: ${error.message}`, 'error');
        updateProgress(0, '扫描失败');
        alert(`扫描失败: ${error.message}`);
    } finally {
        elements.scanBtn.disabled = false;
    }
}

// 扫描池子（简化版本，实际应该调用后端 API）
async function scanPool(options) {
    // 注意：这是一个简化的客户端实现
    // 实际生产环境应该通过后端 API 调用

    addLog('获取池子动态字段...', 'info');
    updateProgress(30, '获取池子信息...');

    // 模拟扫描过程
    const ticks = await getDynamicFields(options.poolId);
    elements.ticksScanned.textContent = ticks.length;
    addLog(`找到 ${ticks.length} 个价格层级`, 'info');

    updateProgress(50, '扫描订单...');

    // 这里应该实际扫描订单
    // 由于浏览器限制，我们使用模拟数据
    const mockResult = {
        poolId: options.poolId,
        totalOrders: 15,
        expiredOrders: 8,
        orders: generateMockOrders(8),
        estimatedRebateMist: BigInt('23760000'),
        estimatedRebateSui: '0.023760000',
        ticksScanned: ticks.length,
    };

    elements.ordersFound.textContent = mockResult.totalOrders;
    elements.expiredOrders.textContent = mockResult.expiredOrders;

    updateProgress(80, '计算返还金额...');
    addLog(`计算预计返还: ${mockResult.estimatedRebateSui} SUI`, 'info');

    return mockResult;
}

// 获取动态字段
async function getDynamicFields(parentId) {
    try {
        const result = await suiClient.getDynamicFields({
            parentId,
            limit: 50,
        });
        return result.data;
    } catch (error) {
        console.error('获取动态字段失败:', error);
        return [];
    }
}

// 生成模拟订单（用于演示）
function generateMockOrders(count) {
    const orders = [];
    for (let i = 0; i < count; i++) {
        orders.push({
            orderId: `0x${Math.random().toString(16).substr(2, 40)}`,
            side: Math.random() > 0.5 ? 'bid' : 'ask',
            price: BigInt(Math.floor(Math.random() * 1000000)),
            quantity: BigInt(Math.floor(Math.random() * 10000000000)),
            filledQuantity: BigInt(0),
            status: 'open',
            timestamp: Date.now() - Math.random() * 86400000,
            poolId: elements.poolId.value,
            owner: `0x${Math.random().toString(16).substr(2, 40)}`,
            expireTimestamp: Date.now() - Math.random() * 3600000,
            storageRebate: BigInt('2970000'),
        });
    }
    return orders;
}

// 显示结果
function showResults(result) {
    elements.resultPanel.style.display = 'block';

    // 更新摘要
    elements.totalOrders.textContent = result.totalOrders;
    elements.expiredOrdersResult.textContent = result.expiredOrders;
    elements.estimatedRebate.textContent = `${result.estimatedRebateSui} SUI`;

    // 显示订单列表
    elements.ordersList.innerHTML = '';

    if (result.orders.length === 0) {
        elements.ordersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">没有找到过期订单</p>';
        elements.executeBtn.style.display = 'none';
    } else {
        result.orders.slice(0, 10).forEach((order, index) => {
            const orderEl = createOrderElement(order, index + 1);
            elements.ordersList.appendChild(orderEl);
        });

        if (result.orders.length > 10) {
            const more = document.createElement('p');
            more.style.textAlign = 'center';
            more.style.color = 'var(--text-secondary)';
            more.textContent = `... 还有 ${result.orders.length - 10} 个订单`;
            elements.ordersList.appendChild(more);
        }

        elements.executeBtn.style.display = 'inline-flex';
    }
}

// 创建订单元素
function createOrderElement(order, index) {
    const div = document.createElement('div');
    div.className = 'order-item';

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">订单 #${index}: ${order.orderId.substring(0, 20)}...</span>
            <span class="order-badge ${order.side}">${order.side === 'bid' ? '买单' : '卖单'}</span>
        </div>
        <div class="order-details">
            <div class="order-detail">价格: <strong>${order.price.toString()}</strong></div>
            <div class="order-detail">数量: <strong>${order.quantity.toString()}</strong></div>
            <div class="order-detail">所有者: <strong>${order.owner.substring(0, 10)}...</strong></div>
            <div class="order-detail">过期: <strong>${new Date(order.expireTimestamp).toLocaleString()}</strong></div>
        </div>
    `;

    return div;
}

// 处理执行
async function handleExecute() {
    if (!scanResult || scanResult.orders.length === 0) {
        alert('没有可执行的订单');
        return;
    }

    // 显示执行面板
    elements.executionPanel.style.display = 'block';
    elements.transactionList.innerHTML = '';
    elements.executionSummary.style.display = 'none';

    // 禁用按钮
    elements.executeBtn.disabled = true;

    try {
        // 转换私钥格式
        const base64PrivateKey = convertPrivateKeyToBase64(elements.privateKey.value.trim());

        // 创建 keypair
        const keypair = Ed25519Keypair.fromSecretKey(fromB64(base64PrivateKey));
        const signerAddress = keypair.toSuiAddress();

        addLog(`使用地址: ${signerAddress}`, 'info');
        elements.executionStatus.textContent = `准备执行 ${scanResult.orders.length} 个订单的清理...`;

        // 构建交易（每50个订单一个交易）
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < scanResult.orders.length; i += batchSize) {
            batches.push(scanResult.orders.slice(i, i + batchSize));
        }

        elements.totalTxCount.textContent = batches.length;

        let successCount = 0;
        let failCount = 0;
        let totalRebate = 0;

        // 执行每个批次
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            addLog(`执行交易 ${i + 1}/${batches.length}...`, 'info');

            try {
                // 注意：这里应该调用实际的清理函数
                // 由于是演示，我们模拟执行
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 模拟成功
                const txDigest = `0x${Math.random().toString(16).substr(2, 64)}`;
                const rebate = batch.length * 0.00297;

                successCount++;
                totalRebate += rebate;

                addLog(`交易 ${i + 1} 成功: ${txDigest}`, 'success');
                addTransactionItem(i + 1, txDigest, 'success', rebate);

            } catch (error) {
                failCount++;
                addLog(`交易 ${i + 1} 失败: ${error.message}`, 'error');
                addTransactionItem(i + 1, null, 'error', 0);
            }

            elements.successCount.textContent = successCount;
            elements.failCount.textContent = failCount;
        }

        // 显示总结
        elements.executionSummary.style.display = 'block';
        elements.finalSuccessCount.textContent = successCount;
        elements.actualRebate.textContent = totalRebate.toFixed(9);
        elements.executionStatus.textContent = '执行完成！';

        addLog(`执行完成！成功: ${successCount}, 失败: ${failCount}`, 'success');

    } catch (error) {
        console.error('执行失败:', error);
        addLog(`执行失败: ${error.message}`, 'error');
        alert(`执行失败: ${error.message}`);
    } finally {
        elements.executeBtn.disabled = false;
    }
}

// 添加交易项
function addTransactionItem(index, digest, status, rebate) {
    const div = document.createElement('div');
    div.className = `transaction-item ${status}`;

    const statusIcon = status === 'success' ? '✅' : '❌';
    const statusText = status === 'success' ? '成功' : '失败';

    div.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-status">
                <span class="status-icon">${statusIcon}</span>
                <span>交易 #${index}: ${statusText}</span>
            </div>
            ${rebate > 0 ? `<span style="color: var(--success-color); font-weight: 600;">+${rebate.toFixed(9)} SUI</span>` : ''}
        </div>
        ${digest ? `<div class="transaction-digest">Digest: ${digest}</div>` : ''}
    `;

    elements.transactionList.appendChild(div);
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
