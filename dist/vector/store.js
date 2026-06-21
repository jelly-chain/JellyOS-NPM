export class VectorStore {
    docs = [];
    async add(doc) {
        this.docs.push(doc);
    }
    async search(query, limit = 5) {
        return this.docs.slice(0, limit);
    }
    async loadFromIrys() {
        // Would download brain-index
    }
}
export const vectorStore = new VectorStore();
//# sourceMappingURL=store.js.map