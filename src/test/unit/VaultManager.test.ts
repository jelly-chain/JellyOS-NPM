import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VaultManager } from '../../vault/VaultManager.js';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('VaultManager', () => {
  let tempDir: string;
  let vault: VaultManager;

  beforeEach(() => {
    tempDir = join(tmpdir(), `jelly-vault-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    vault = new VaultManager(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('creates a new vault with passphrase', async () => {
    await vault.create('test-passphrase-123');
    expect(vault.isLocked()).toBe(false);
    expect(vault.getBalance()).toBe(0);
  });

  it('locks and unlocks vault with correct passphrase', async () => {
    await vault.create('correct-passphrase');
    vault.lock();
    expect(vault.isLocked()).toBe(true);
    
    const unlocked = await vault.unlock('correct-passphrase');
    expect(unlocked).toBe(true);
    expect(vault.isLocked()).toBe(false);
  });

  it('fails unlock with wrong passphrase', async () => {
    await vault.create('correct-passphrase');
    vault.lock();
    
    const unlocked = await vault.unlock('wrong-passphrase');
    expect(unlocked).toBe(false);
  });

  it('sweeps profits into vault', async () => {
    await vault.create('passphrase');
    await vault.sweep(100, 'test sweep');
    
    expect(vault.getBalance()).toBe(100);
    const history = vault.getHistory();
    expect(history.length).toBe(1);
    expect(history[0]!.note).toBe('test sweep');
  });

  it('gets vault stats', async () => {
    await vault.create('passphrase');
    const stats = vault.getStats();
    expect(stats.locked).toBe(false);
    expect(stats.balance).toBe(0);
    expect(stats.entries).toBe(0);
  });
});