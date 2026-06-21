/** Called once after setup to lock core files read-only */
export declare function lockCoreFiles(): void;
/** Called at every agent boot to verify core integrity */
export declare function verifyCoreIntegrity(jellyHome: string): {
    ok: boolean;
    changed: string[];
};
//# sourceMappingURL=verify-core.d.ts.map