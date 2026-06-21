export interface IrysTag {
    name: string;
    value: string;
}
export interface IrysUploadResult {
    id: string;
    timestamp: number;
    size: number;
}
export declare class IrysService {
    private uploaderPath;
    private port;
    private process;
    constructor(port?: number);
    start(): Promise<void>;
    stop(): Promise<void>;
    upload(data: Uint8Array | Buffer, tags?: IrysTag[]): Promise<IrysUploadResult>;
    fetch(txId: string): Promise<Buffer>;
}
export declare const irys: IrysService;
//# sourceMappingURL=irys.d.ts.map