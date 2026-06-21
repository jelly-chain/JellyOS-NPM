import { Logger } from '../../core/utils/Logger.js';
import { isAlchemySupported } from '../../core/ChainConfig.js';
export class AlchemyClient {
    logger;
    config;
    baseUrl;
    constructor(config) {
        this.config = {
            apiKey: process.env.ALCHEMY_KEY || '',
            network: 'eth-mainnet',
            maxRetries: 3,
            batchSize: 100,
            ...config,
        };
        this.logger = new Logger('AlchemyClient');
        this.baseUrl = `https://${this.config.network}.g.alchemy.com/v2/${this.config.apiKey}`;
    }
    getUrl(path = '') {
        return `${this.baseUrl}${path}`;
    }
    async rpc(method, params = []) {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const response = await fetch(this.getUrl(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                });
                const data = await response.json();
                if (data.error)
                    throw new Error(data.error.message);
                return data.result;
            }
            catch (error) {
                if (attempt === this.config.maxRetries - 1)
                    throw error;
                await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
            }
        }
    }
    async getBlockNumber() {
        const result = await this.rpc('eth_blockNumber');
        return parseInt(result, 16);
    }
    async getBalance(address) {
        return await this.rpc('eth_getBalance', [address, 'latest']);
    }
    async getTransactionReceipt(txHash) {
        return await this.rpc('eth_getTransactionReceipt', [txHash]);
    }
    async getTransaction(txHash) {
        return await this.rpc('eth_getTransactionByHash', [txHash]);
    }
    async getTokenBalances(address, contractAddresses) {
        return await this.rpc('alchemy_getTokenBalances', [address, contractAddresses]);
    }
    async getTokenMetadata(contractAddress) {
        return await this.rpc('alchemy_getTokenMetadata', [contractAddress]);
    }
    async getLogs(params) {
        return await this.rpc('eth_getLogs', [params]);
    }
    async getAssetTransfers(params) {
        return await this.rpc('alchemy_getAssetTransfers', [params]);
    }
    async getTokenAllowance(params) {
        return await this.rpc('alchemy_getTokenAllowance', [params]);
    }
    async simulateAssetChanges(params) {
        return await this.rpc('alchemy_simulateAssetChanges', [params]);
    }
    async estimateGas(tx) {
        return await this.rpc('eth_estimateGas', [tx]);
    }
    async getGasPrice() {
        return await this.rpc('eth_gasPrice');
    }
    async getFeeHistory(blockCount, newestBlock, rewardPercentiles) {
        return await this.rpc('eth_feeHistory', [blockCount, newestBlock, rewardPercentiles]);
    }
    async getBlockByNumber(blockNumber, fullTx = false) {
        return await this.rpc('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, fullTx]);
    }
    async traceTransaction(txHash) {
        return await this.rpc('trace_transaction', [txHash]);
    }
    async getContractLogs(address, fromBlock, toBlock) {
        return await this.getLogs({
            address,
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${toBlock.toString(16)}`,
        });
    }
    async getNftMetadata(contractAddress, tokenId) {
        return await this.rpc('alchemy_getNftMetadata', [contractAddress, tokenId]);
    }
    async getOwnedNfts(address) {
        return await this.rpc('alchemy_getNfts', [address]);
    }
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
        this.baseUrl = `https://${this.config.network}.g.alchemy.com/v2/${apiKey}`;
    }
    supportsChain(networkName) {
        return isAlchemySupported(networkName.toLowerCase());
    }
}
//# sourceMappingURL=AlchemyClient.js.map