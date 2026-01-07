export interface Order {
    orderId: string; // u128 as string
    owner: string;   // address
    side: 'bid' | 'ask';
    price: bigint;
    quantity: bigint;
    expireTimestamp: number;
    isExpired: boolean;
    objectId?: string; // Dynamic Field Object ID
}

export interface CleanupStats {
    poolName: string;
    ordersCleaned: number;
    estimatedRebate: number;
    gasUsed: number;
    netProfit: number;
}
