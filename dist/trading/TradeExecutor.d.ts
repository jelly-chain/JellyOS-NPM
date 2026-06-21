import { Metrics } from '../core/utils/Metrics.js';
import { ContextStore } from '../context/ContextStore.js';
export interface TradeOrder {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stopLimit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    slippage: number;
    strategy: string;
    timestamp: number;
    status: TradeStatus;
    fills: Fill[];
}
export interface Fill {
    price: number;
    quantity: number;
    timestamp: number;
    fee: number;
    feeAsset: string;
}
export declare enum TradeStatus {
    PENDING = "pending",
    SUBMITTED = "submitted",
    PARTIAL = "partial",
    FILLED = "filled",
    CANCELLED = "cancelled",
    REJECTED = "rejected",
    EXPIRED = "expired"
}
export interface ExecutionConfig {
    maxSlippage: number;
    orderTimeout: number;
    retryAttempts: number;
    allowPartial: boolean;
    smartRouting: boolean;
}
export declare class TradeExecutor {
    private logger;
    private metrics;
    private context;
    private config;
    private orders;
    private activeOrders;
    constructor(context: ContextStore, metrics: Metrics, config?: Partial<ExecutionConfig>);
    executeOrder(order: TradeOrder): Promise<TradeOrder>;
    private routeAndExecute;
    private smartRouteExecution;
    private findBestRoutes;
    private executeViaRoute;
    private directExecution;
    private executeMarketOrder;
    private executeLimitOrder;
    private executeStopOrder;
    private handleExecutionError;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrder(orderId: string): TradeOrder | undefined;
    getActiveOrders(): TradeOrder[];
    getAllOrders(): TradeOrder[];
    getStats(): {
        totalOrders: number;
        filled: number;
        pending: number;
        cancelled: number;
        rejected: number;
        activeOrders: number;
        fillRate: number;
    };
    close(): void;
}
//# sourceMappingURL=TradeExecutor.d.ts.map