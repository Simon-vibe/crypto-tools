export interface TargetAsset {
    symbol: string;
    coinType: string;
    deepbookPoolId: string; // V3 Pool
    cetusPoolId: string;    // CLMM Pool
}

// WATCH_LIST: Long-tail Assets (High Volatility, Low Liquidity)
export const WATCH_LIST: TargetAsset[] = [
    {
        symbol: "FUD",
        coinType: "0x76cb819b01abed502bee8a702b4c2d547532c12f25b01cb74b9d433dc249d014::fud::FUD",
        deepbookPoolId: "0x_FILL_ME_IN_WITH_REAL_V3_POOL_ID_FOR_FUD_SUI",
        cetusPoolId: "0x_FILL_ME_IN_WITH_REAL_CETUS_POOL_ID_FOR_FUD_SUI"
    },
    {
        symbol: "BLUB",
        coinType: "0xfa7ac3951fdca92c5200d468d31a365eb03b2be9936fde615e69f0c1274ad3a0::blub::BLUB",
        deepbookPoolId: "0x_FILL_ME_IN",
        cetusPoolId: "0x_FILL_ME_IN"
    },
    {
        symbol: "HIPPO",
        coinType: "0x8993129d72e733985f7f1a00396cbd055bad6f817fee36576ce483c8c830534f::hippo::HIPPO",
        deepbookPoolId: "0x_FILL_ME_IN",
        cetusPoolId: "0x_FILL_ME_IN"
    }
];

export const SUI_COIN_TYPE = "0x2::sui::SUI";
export const MIN_PROFIT_THRESHOLD = 0.5; // 0.5 SUI (High threshold for memes)
