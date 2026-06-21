import { Logger } from '../../core/utils/Logger.js';
export class SolanaClient {
    logger;
    rpcUrl;
    commitment;
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        this.commitment = 'confirmed';
        this.logger = new Logger('SolanaClient');
    }
    setRpcUrl(url) { this.rpcUrl = url; }
    async rpc(method, params = []) {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const data = await response.json();
        if (data.error)
            throw new Error(data.error.message);
        return data.result;
    }
    async getBalance(address) {
        return await this.rpc('getBalance', [address]);
    }
    async getTokenAccountBalance(tokenAccount) {
        return await this.rpc('getTokenAccountBalance', [tokenAccount]);
    }
    async getTokenAccountsByOwner(owner, mint) {
        const filter = mint
            ? { mint }
            : { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };
        return await this.rpc('getTokenAccountsByOwner', [owner, filter]);
    }
    async getRecentBlockhash() {
        const result = await this.rpc('getRecentBlockhash');
        return result.blockhash;
    }
    async getBlock(blockNumber) {
        return await this.rpc('getBlock', [blockNumber]);
    }
    async getTransaction(txSignature) {
        return await this.rpc('getTransaction', [txSignature]);
    }
    async getSignaturesForAddress(address, limit = 100) {
        return await this.rpc('getSignaturesForAddress', [address, { limit }]);
    }
    async sendTransaction(tx) {
        return await this.rpc('sendTransaction', [tx]);
    }
    async simulateTransaction(tx) {
        return await this.rpc('simulateTransaction', [tx]);
    }
    async getAccountInfo(address) {
        return await this.rpc('getAccountInfo', [address]);
    }
    async getProgramAccounts(programId) {
        return await this.rpc('getProgramAccounts', [programId]);
    }
    async getMultipleAccounts(addresses) {
        return await this.rpc('getMultipleAccounts', [addresses]);
    }
    async getSlot() {
        return await this.rpc('getSlot');
    }
    async getEpochInfo() {
        return await this.rpc('getEpochInfo');
    }
    async getSupply() {
        return await this.rpc('getSupply');
    }
    async getInflationRate() {
        return await this.rpc('getInflationRate');
    }
    async requestAirdrop(address, lamports) {
        return await this.rpc('requestAirdrop', [address, lamports]);
    }
    async getMinimumBalanceForRentExemption(dataLength) {
        return await this.rpc('getMinimumBalanceForRentExemption', [dataLength]);
    }
    async getLatestBlockhash() {
        return await this.rpc('getLatestBlockhash', [{ commitment: this.commitment }]);
    }
}
//# sourceMappingURL=SolanaClient.js.map