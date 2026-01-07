export const DEEPBOOK_PACKAGE_ID = '0x00c1a56ec8c4c623a848b2ed2f03d23a25d17570b670c22106f336eb933785cc';

export interface PoolConfig {
    name: string;
    id: string;
    baseType: string;
    quoteType: string;
}

// Extracted from @mysten/deepbook-v3/dist/esm/utils/constants.js
const mainnetCoins: Record<string, { type: string }> = {
    DEEP: { type: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP' },
    SUI: { type: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI' },
    USDC: { type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC' },
    WUSDC: { type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' },
    WETH: { type: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN' },
    BETH: { type: '0xd0e89b2af5e4910726fbcd8b8dd37bb79b29e5f83f7491bca830e94f7f226d29::eth::ETH' },
    WBTC: { type: '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN' },
    WUSDT: { type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN' },
    NS: { type: '0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS' },
    TYPUS: { type: '0xf82dc05634970553615eef6112a1ac4fb7bf10272bf6cbe0f80ef44a6c489385::typus::TYPUS' },
    AUSD: { type: '0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD' },
    DRF: { type: '0x294de7579d55c110a00a7c4946e09a1b5cbeca2592fbb83fd7bfacba3cfeaf0e::drf::DRF' },
    SEND: { type: '0xb45fcfcc2cc07ce0702cc2d229621e046c906ef14d9b25e8e4d25f6e8763fef7::send::SEND' },
    WAL: { type: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL' },
    XBTC: { type: '0x876a4b7bce8aeaef60464c11f4026903e9afacab79b9b142686158aa86560b50::xbtc::XBTC' },
    IKA: { type: '0x7262fb2f7a3a14c888c438a3cd9b912469a58cf60f367352c46584262e8299aa::ika::IKA' },
    ALKIMI: { type: '0x1a8f4bc33f8ef7fbc851f156857aa65d397a6a6fd27a7ac2ca717b51f2fd9489::alkimi::ALKIMI' },
    LZWBTC: { type: '0x0041f9f9344cac094454cd574e333c4fdb132d7bcc9379bcd4aab485b2a63942::wbtc::WBTC' },
    WGIGA: { type: '0xec32640add6d02a1d5f0425d72705eb76d9de7edfd4f34e0dba68e62ecceb05b::coin::COIN' }
};

const mainnetPools: Record<string, { address: string; baseCoin: string; quoteCoin: string }> = {
    DEEP_SUI: { address: '0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22', baseCoin: 'DEEP', quoteCoin: 'SUI' },
    SUI_USDC: { address: '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407', baseCoin: 'SUI', quoteCoin: 'USDC' },
    DEEP_USDC: { address: '0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce', baseCoin: 'DEEP', quoteCoin: 'USDC' },
    WUSDT_USDC: { address: '0x4e2ca3988246e1d50b9bf209abb9c1cbfec65bd95afdacc620a36c67bdb8452f', baseCoin: 'WUSDT', quoteCoin: 'USDC' },
    WUSDC_USDC: { address: '0xa0b9ebefb38c963fd115f52d71fa64501b79d1adcb5270563f92ce0442376545', baseCoin: 'WUSDC', quoteCoin: 'USDC' },
    BETH_USDC: { address: '0x1109352b9112717bd2a7c3eb9a416fff1ba6951760f5bdd5424cf5e4e5b3e65c', baseCoin: 'BETH', quoteCoin: 'USDC' },
    NS_USDC: { address: '0x0c0fdd4008740d81a8a7d4281322aee71a1b62c449eb5b142656753d89ebc060', baseCoin: 'NS', quoteCoin: 'USDC' },
    NS_SUI: { address: '0x27c4fdb3b846aa3ae4a65ef5127a309aa3c1f466671471a806d8912a18b253e8', baseCoin: 'NS', quoteCoin: 'SUI' },
    TYPUS_SUI: { address: '0xe8e56f377ab5a261449b92ac42c8ddaacd5671e9fec2179d7933dd1a91200eec', baseCoin: 'TYPUS', quoteCoin: 'SUI' },
    SUI_AUSD: { address: '0x183df694ebc852a5f90a959f0f563b82ac9691e42357e9a9fe961d71a1b809c8', baseCoin: 'SUI', quoteCoin: 'AUSD' },
    AUSD_USDC: { address: '0x5661fc7f88fbeb8cb881150a810758cf13700bb4e1f31274a244581b37c303c3', baseCoin: 'AUSD', quoteCoin: 'USDC' },
    DRF_SUI: { address: '0x126865a0197d6ab44bfd15fd052da6db92fd2eb831ff9663451bbfa1219e2af2', baseCoin: 'DRF', quoteCoin: 'SUI' },
    SEND_USDC: { address: '0x1fe7b99c28ded39774f37327b509d58e2be7fff94899c06d22b407496a6fa990', baseCoin: 'SEND', quoteCoin: 'USDC' },
    WAL_USDC: { address: '0x56a1c985c1f1123181d6b881714793689321ba24301b3585eec427436eb1c76d', baseCoin: 'WAL', quoteCoin: 'USDC' },
    WAL_SUI: { address: '0x81f5339934c83ea19dd6bcc75c52e83509629a5f71d3257428c2ce47cc94d08b', baseCoin: 'WAL', quoteCoin: 'SUI' },
    XBTC_USDC: { address: '0x20b9a3ec7a02d4f344aa1ebc5774b7b0ccafa9a5d76230662fdc0300bb215307', baseCoin: 'XBTC', quoteCoin: 'USDC' },
    IKA_USDC: { address: '0xfa732993af2b60d04d7049511f801e79426b2b6a5103e22769c0cead982b0f47', baseCoin: 'IKA', quoteCoin: 'USDC' },
    ALKIMI_SUI: { address: '0x84752993c6dc6fce70e25ddeb4daddb6592d6b9b0912a0a91c07cfff5a721d89', baseCoin: 'ALKIMI', quoteCoin: 'SUI' },
    LZWBTC_USDC: { address: '0xf5142aafa24866107df628bf92d0358c7da6acc46c2f10951690fd2b8570f117', baseCoin: 'LZWBTC', quoteCoin: 'USDC' }
};

// Generate Global Target Pools
export const TARGET_POOLS: PoolConfig[] = Object.entries(mainnetPools).map(([name, config]) => {
    const base = mainnetCoins[config.baseCoin];
    const quote = mainnetCoins[config.quoteCoin];

    if (!base || !quote) {
        console.warn(`Skipping pool ${name} due to missing coin config.`);
        return null;
    }

    return {
        name,
        id: config.address,
        baseType: base.type,
        quoteType: quote.type
    };
}).filter((p): p is PoolConfig => p !== null);
