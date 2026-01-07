import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { TARGET_POOLS } from './constants.js';
import 'dotenv/config';

const MAINNET_RPC = process.env.SUI_RPC_URL || getFullnodeUrl('mainnet');
const client = new SuiClient({ url: MAINNET_RPC });

async function debugPool() {
    // 1. Find Pool
    const poolConfig = TARGET_POOLS.find(p => p.name === 'SUI_USDC' || p.name === 'SUI/USDC');
    if (!poolConfig) {
        console.error('Pool SUI/USDC not found in constants. Available:', TARGET_POOLS.map(p => p.name));
        return;
    }

    console.log(`\n🐛 Debugging Pool: ${poolConfig.name} (${poolConfig.id})`);
    console.log('------------------------------------------------');

    try {
        // 2. Traversal
        // Pool -> Versioned -> Inner -> Book -> Bids/Asks IDs
        const poolObject = await client.getObject({ id: poolConfig.id, options: { showContent: true } });
        if (!poolObject.data?.content || poolObject.data.content.dataType !== 'moveObject') throw new Error('Invalid Pool');
        const poolFields = (poolObject.data.content as any).fields;
        const versionedId = poolFields.inner?.fields?.id?.id || poolFields.id?.id;

        const dynamicFields = await client.getDynamicFields({ parentId: versionedId });
        const v1Field = dynamicFields.data.find(f => f.name.type === 'u64' && f.name.value === '1');
        if (!v1Field) throw new Error('No Version 1 data');

        const v1Object = await client.getObject({ id: v1Field.objectId, options: { showContent: true } });
        const v1Fields = (v1Object.data?.content as any).fields.value.fields;
        const book = v1Fields.book;

        const bidsId = book.fields.bids.fields.id.id;
        const asksId = book.fields.asks.fields.id.id;

        console.log(`   -> Bids ID: ${bidsId}`);
        console.log(`   -> Asks ID: ${asksId}`);

        // 3. Deep Scan
        const scan = async (vectorId: string, label: string) => {
            console.log(`\n🔎 Scanning ${label} (${vectorId})...`);
            let cursor = null;
            let hasNextPage = true;
            let count = 0;
            let orders = 0;

            while (hasNextPage) {
                const res = await client.getDynamicFields({ parentId: vectorId, cursor, limit: 10 });
                const ids = res.data.map(d => d.objectId);

                if (ids.length > 0) {
                    const objects = await client.multiGetObjects({ ids, options: { showContent: true } });

                    for (const obj of objects) {
                        count++;
                        // Log first few items fully
                        if (count <= 3) {
                            const fieldInfo = res.data.find(f => f.objectId === obj.data?.objectId);
                            console.log(`\n   [ITEM #${count} DEBUG]`);
                            console.log(`   Type: ${obj.data?.type}`);
                            console.log(`   DF Name:`, fieldInfo?.name);
                            console.log(`   Content:`);
                            console.dir(obj.data?.content, { depth: null });
                        }

                        // Code logic inspection
                        if (obj.data?.content?.dataType === 'moveObject') {
                            const fields = (obj.data.content as any).fields;
                            // Check content
                            let val = fields.value;
                            if (val && val.fields) val = val.fields;

                            if (val && val.order_id) {
                                orders++;
                            }
                        }
                    }
                }

                cursor = res.nextCursor;
                hasNextPage = res.hasNextPage;
                if (count > 20) break; // Limit debug run length
            }
            console.log(`   -> Found ${orders} recognized orders in first batch.`);
        };

        await scan(bidsId, 'Bids');
        await scan(asksId, 'Asks');

    } catch (e) {
        console.error(e);
    }
}

debugPool();
