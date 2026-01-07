import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { DEEPBOOK_PACKAGE_ID } from './constants.js';
import type { PoolConfig } from './constants.js';
import type { Order } from './types.js';

export class DeepBookService {
    constructor(private client: SuiClient) { }

    /**
     * Scan a public pool for all expired orders.
     * Traverses the V3 object hierarchy: Pool -> Versioned -> V1(Inner) -> Book -> Bids/Asks -> BigVector -> Slices -> Orders
     */
    async scanPoolForExpiredOrders(poolConfig: PoolConfig): Promise<Order[]> {
        try {
            console.log(`Scanning pool ${poolConfig.name} (${poolConfig.id})...`);

            // 1. Get Pool Object (Versioned Wrapper)
            const poolObject = await this.client.getObject({
                id: poolConfig.id,
                options: { showContent: true }
            });

            if (!poolObject.data?.content || poolObject.data.content.dataType !== 'moveObject') {
                throw new Error('Invalid Pool Object');
            }

            const poolFields = (poolObject.data.content as any).fields;
            const versionedId = poolFields.inner?.fields?.id?.id || poolFields.id?.id;

            // 2. Find Inner V1 Object via Dynamic Field
            const dynamicFields = await this.client.getDynamicFields({
                parentId: versionedId,
            });

            const v1Field = dynamicFields.data.find(f => f.name.type === 'u64' && f.name.value === '1');
            if (!v1Field) {
                // If the pool is really empty/uninitialized, this might be missing.
                console.warn(`Could not find Version 1 data for pool ${poolConfig.name}. functionality limited.`);
                return [];
            }

            // 3. Get Actual Pool Data (Book)
            const v1Object = await this.client.getObject({
                id: v1Field.objectId,
                options: { showContent: true }
            });

            if (!v1Object.data?.content || v1Object.data.content.dataType !== 'moveObject') {
                throw new Error('Invalid V1 Object');
            }

            const v1Fields = (v1Object.data.content as any).fields.value.fields;
            const book = v1Fields.book;
            if (!book) throw new Error('No Order Book found in pool');

            // 4. Get Bids and Asks Vectors
            const bidsId = book.fields.bids.fields.id.id;
            const asksId = book.fields.asks.fields.id.id;

            // 5. Scan Side Function
            const scanSide = async (parentId: string, side: 'bid' | 'ask'): Promise<Order[]> => {
                const fields = await this.client.getDynamicFields({ parentId });
                const orders: Order[] = [];
                const now = BigInt(Date.now());

                // Batch fetch objects for performance
                const objectIds = fields.data.map(f => f.objectId);
                const chunks = [];
                for (let i = 0; i < objectIds.length; i += 50) {
                    chunks.push(objectIds.slice(i, i + 50));
                }

                for (const chunk of chunks) {
                    const objects = await this.client.multiGetObjects({
                        ids: chunk,
                        options: { showContent: true }
                    });

                    for (const obj of objects) {
                        if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
                            const wrapper = (obj.data.content as any).fields;

                            // BigVector Slice logic:
                            // wrapper.value is the Slice struct.
                            if (wrapper.value) {
                                let slice = wrapper.value;
                                if (slice.fields) slice = slice.fields;

                                // Slice contains "values" array of Orders
                                if (Array.isArray(slice.values)) {
                                    for (let item of slice.values) {
                                        if (item.fields) item = item.fields;

                                        if (item.order_id) {
                                            const expireTimestamp = BigInt(item.expire_timestamp);

                                            // Expired if > 0 and < now
                                            // u64::MAX (GTC) is > now, so it won't be expired. Correct.
                                            if (expireTimestamp > 0n && expireTimestamp < now) {
                                                orders.push({
                                                    orderId: item.order_id,
                                                    owner: item.owner,
                                                    side,
                                                    price: BigInt(item.price),
                                                    quantity: BigInt(item.quantity),
                                                    expireTimestamp: Number(expireTimestamp), // Conversion might lose precision but only for logging
                                                    isExpired: true,
                                                    objectId: obj.data.objectId // We use Slice object ID (or pool ID for cleanup)
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return orders;
            };

            const [bids, asks] = await Promise.all([
                scanSide(bidsId, 'bid'),
                scanSide(asksId, 'ask')
            ]);

            return [...bids, ...asks];

        } catch (error) {
            console.error(`Error scanning pool ${poolConfig.name}:`, error);
            return [];
        }
    }

    /**
     * Build the transaction to clean up expired orders.
     * Uses raw Move Call: deepbook::deepbook::clean_up_expired_orders
     */
    buildCleanupTransaction(poolConfig: PoolConfig, orders: Order[]): Transaction {
        const tx = new Transaction();
        const MAX_PER_TX = 50;

        // Chunk orders
        const chunk = orders.slice(0, MAX_PER_TX);
        const orderIds = chunk.map(o => o.orderId);

        console.log(`Building cleanup tx for ${chunk.length} orders in ${poolConfig.name}...`);

        tx.moveCall({
            target: `${DEEPBOOK_PACKAGE_ID}::deepbook::clean_up_expired_orders`,
            typeArguments: [poolConfig.baseType, poolConfig.quoteType],
            arguments: [
                tx.object(poolConfig.id),
                tx.pure.vector('u128', orderIds)
            ]
        });

        // Set generous gas budget
        tx.setGasBudget(100000000); // 0.1 SUI
        return tx;
    }
}
