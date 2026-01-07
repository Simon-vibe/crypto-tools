import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import 'dotenv/config';
import { DeepBookService } from './deepbook-service.js'; // Use .js for ES Module
import { TARGET_POOLS } from './constants.js';

const MAINNET_RPC = process.env.SUI_RPC_URL || getFullnodeUrl('mainnet');
const SLEEP_MS = 600000; // Run every 10 minutes

// Setup
const client = new SuiClient({ url: MAINNET_RPC });
const service = new DeepBookService(client);

function getKeypair() {
    const privKey = process.env.SUI_PRIVATE_KEY;
    if (!privKey) throw new Error('Missing SUI_PRIVATE_KEY in .env');

    if (privKey.startsWith('suiprivkey')) {
        const { secretKey } = decodeSuiPrivateKey(privKey);
        return Ed25519Keypair.fromSecretKey(secretKey);
    }
    return Ed25519Keypair.fromSecretKey(fromB64(privKey));
}

async function processPool(keypair: Ed25519Keypair, poolConfig: any) {
    console.log(`\n🔍 Checking Pool: ${poolConfig.name}`);

    // 1. Scan for Expired Orders
    const expiredOrders = await service.scanPoolForExpiredOrders(poolConfig);

    if (expiredOrders.length === 0) {
        console.log(`   No expired orders found.`);
        return;
    }

    console.log(`   Found ${expiredOrders.length} EXPIRED orders.`);

    // 2. Profitability Check (Pre-calculation)
    // Estimate: Gas ~0.005 SUI, Rebate ~0.003 * Count
    // Each order rebate is roughly 2,970,000 MIST (0.00297 SUI)
    const ESTIMATED_REBATE_PER_ORDER = 0.00297;
    const ESTIMATED_GAS_COST = 0.005; // Conservative upper bound

    const potentialRebate = expiredOrders.length * ESTIMATED_REBATE_PER_ORDER;

    if (potentialRebate < ESTIMATED_GAS_COST) {
        console.log(`   ⚠️ Skipping cleanup. Potential Rebate (${potentialRebate.toFixed(5)}) < Gas Cost (${ESTIMATED_GAS_COST}). Not profitable.`);
        return;
    }

    console.log(`   💰 Profitable! Est. Rebate: ${potentialRebate.toFixed(5)} SUI > Gas: ${ESTIMATED_GAS_COST} SUI`);

    // 3. Build & Execute Transaction
    try {
        const tx = service.buildCleanupTransaction(poolConfig, expiredOrders);

        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
            options: {
                showEffects: true,
                showBalanceChanges: true
            }
        });

        // 4. Parse Actual Results
        const effects = result.effects!;
        if (effects.status.status !== 'success') {
            console.error(`   ❌ Cleanup Transaction Failed: ${effects.status.error}`);
            return;
        }

        const gasUsed = BigInt(effects.gasUsed.computationCost) +
            BigInt(effects.gasUsed.storageCost) -
            BigInt(effects.gasUsed.storageRebate);
        const storageRebate = BigInt(effects.gasUsed.storageRebate);
        const netProfit = (Number(storageRebate) - Number(gasUsed)) / 1e9;

        console.log(`   ✅ Cleanup Successful!`);
        console.log(`      Digest: ${result.digest}`);
        console.log(`      Gas Cost:       ${(Number(gasUsed) / 1e9).toFixed(9)} SUI`);
        console.log(`      Storage Rebate: ${(Number(storageRebate) / 1e9).toFixed(9)} SUI`);
        console.log(`      📈 NET PROFIT:  ${netProfit.toFixed(9)} SUI`);

    } catch (e) {
        console.error(`   ❌ Error executing cleanup:`, e);
    }
}

async function main() {
    const keypair = getKeypair();
    const address = keypair.toSuiAddress();
    console.log(`🤖 DeepBook Global Janitor Bot started.`);
    console.log(`   Janitor Address: ${address}`);
    console.log(`   Monitoring ${TARGET_POOLS.length} pools...`);

    // Infinite Loop (or single run for now)
    // For this demo, we run once. To loop, uncomment while(true).

    // while(true) {
    for (const pool of TARGET_POOLS) {
        await processPool(keypair, pool);
    }

    //    console.log(`Sleeping for ${SLEEP_MS/1000}s...`);
    //    await new Promise(r => setTimeout(r, SLEEP_MS));
    // }
}

main();
