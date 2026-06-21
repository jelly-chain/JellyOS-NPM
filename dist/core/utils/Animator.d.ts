export declare class Animator {
    private static instance;
    private logger;
    private constructor();
    static getInstance(): Animator;
    createSpinner(): Spinner;
    createProgressBar(): ProgressBar;
    createRealTimeDisplay(): RealTimeDisplay;
}
declare class Spinner {
    private frames;
    private currentFrame;
    private intervalId;
    private isSpinning;
    private text;
    start(text?: string): void;
    stop(): void;
    succeed(text?: string): void;
    fail(text?: string): void;
}
declare class ProgressBar {
    render(current: number, total: number, label?: string): void;
}
declare class RealTimeDisplay {
    private sections;
    private isRunning;
    start(sections: string[]): void;
    update(sectionIndex: number, content: string): void;
    private render;
    stop(): void;
}
export {};
//# sourceMappingURL=Animator.d.ts.map