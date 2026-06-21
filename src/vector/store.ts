// Vector Store - FAISS wrapper for semantic search
import { irys } from "../services/irys.js";

export interface VectorDoc {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class VectorStore {
  private docs: VectorDoc[] = [];

  async add(doc: VectorDoc): Promise<void> {
    this.docs.push(doc);
  }

  async search(query: string, limit = 5): Promise<VectorDoc[]> {
    return this.docs.slice(0, limit);
  }

  async loadFromIrys(): Promise<void> {
    // Would download brain-index
  }
}

export const vectorStore = new VectorStore();
