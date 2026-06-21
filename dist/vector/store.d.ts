export interface VectorDoc {
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
}
export declare class VectorStore {
    private docs;
    add(doc: VectorDoc): Promise<void>;
    search(query: string, limit?: number): Promise<VectorDoc[]>;
    loadFromIrys(): Promise<void>;
}
export declare const vectorStore: VectorStore;
//# sourceMappingURL=store.d.ts.map