import { Logger } from '../../core/utils/Logger.js';
export class CosmosClient {
    logger;
    rpcUrl;
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl || 'https://rpc.cosmos.network';
        this.logger = new Logger('CosmosClient');
    }
    async rest(endpoint) {
        const response = await fetch(`${this.rpcUrl.replace('/rpc', '')}${endpoint}`);
        return await response.json();
    }
    async getBalance(address, denom = 'uatom') {
        return await this.rest(`/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${denom}`);
    }
    async getAllBalances(address) {
        return await this.rest(`/cosmos/bank/v1beta1/balances/${address}`);
    }
    async getAccount(address) {
        return await this.rest(`/cosmos/auth/v1beta1/accounts/${address}`);
    }
    async getLatestBlock() {
        return await this.rest('/cosmos/base/tendermint/v1beta1/blocks/latest');
    }
    async getBlockByHeight(height) {
        return await this.rest(`/cosmos/base/tendermint/v1beta1/blocks/${height}`);
    }
    async getValidators() {
        return await this.rest('/cosmos/staking/v1beta1/validators');
    }
    async getDelegations(delegator) {
        return await this.rest(`/cosmos/staking/v1beta1/delegations/${delegator}`);
    }
    async getUnbondingDelegations(delegator) {
        return await this.rest(`/cosmos/staking/v1beta1/delegators/${delegator}/unbonding_delegations`);
    }
    async getProposals() {
        return await this.rest('/cosmos/gov/v1beta1/proposals');
    }
    async getProposal(id) {
        return await this.rest(`/cosmos/gov/v1beta1/proposals/${id}`);
    }
    async getVotes(proposalId) {
        return await this.rest(`/cosmos/gov/v1beta1/proposals/${proposalId}/votes`);
    }
    async getInflation() {
        return await this.rest('/cosmos/mint/v1beta1/inflation');
    }
    async getSupply() {
        return await this.rest('/cosmos/bank/v1beta1/supply');
    }
    async getStakingPool() {
        return await this.rest('/cosmos/staking/v1beta1/pool');
    }
    async getNodeInfo() {
        return await this.rest('/cosmos/base/tendermint/v1beta1/node_info');
    }
    async getTx(hash) {
        return await this.rest(`/cosmos/tx/v1beta1/txs/${hash}`);
    }
    async getTxsByEvent(event, limit = 50) {
        return await this.rest(`/cosmos/tx/v1beta1/txs?events=${event}&pagination.limit=${limit}`);
    }
    async getIbcDenoms() {
        return await this.rest('/ibc/apps/transfer/v1/denom_traces');
    }
    async getValidatorsDelegations() {
        return await this.rest('/cosmos/staking/v1beta1/delegations');
    }
}
//# sourceMappingURL=CosmosClient.js.map