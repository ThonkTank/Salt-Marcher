import { createHash } from 'node:crypto';
import {
  commitFingerprintInput,
  type CommitCommand,
  type CommitReference,
  type CommitFamily,
  type CommitOutcome,
} from '../src/app/commit-receipt';

export class CommitTracker {
  private pending = new Map<string, { ref: CommitReference; task: Promise<unknown> }>();

  constructor(private read: (ref: CommitReference, token: string) => CommitOutcome) {}

  execute<T>(family: CommitFamily, command: CommitCommand, apply: () => T | Promise<T>): Promise<T> {
    const ref: CommitReference = {
      family,
      commandId: command.commandId,
      campaignId: command.campaignId,
      fingerprint: createHash('sha256')
        .update(commitFingerprintInput(family, command))
        .digest('hex'),
    };
    const confirmed = this.read(ref, command.token);
    if (confirmed.outcome === 'applied') {
      return Promise.resolve(confirmed.value as T);
    }

    const key = family + ':' + command.commandId;
    const prior = this.pending.get(key);
    if (prior) {
      if (prior.ref.campaignId !== ref.campaignId || prior.ref.fingerprint !== ref.fingerprint) {
        throw new Error('Buchungskennung läuft bereits mit anderem Inhalt.');
      }
      return prior.task as Promise<T>;
    }

    const state = { ref, task: Promise.resolve(undefined) as Promise<unknown> };
    // Publish the pending entry before apply runs; retries must share this promise.
    const task = Promise.resolve()
      .then(apply)
      .finally(() => {
        if (this.pending.get(key) === state) {
          this.pending.delete(key);
        }
      });
    state.task = task;
    this.pending.set(key, state);
    return task;
  }

  status(ref: CommitReference, token: string): CommitOutcome {
    const result = this.read(ref, token);
    if (result.outcome === 'applied') {
      return result;
    }

    const pending = this.pending.get(ref.family + ':' + ref.commandId);
    if (!pending) {
      return result;
    }
    if (pending.ref.campaignId !== ref.campaignId || pending.ref.fingerprint !== ref.fingerprint) {
      throw new Error('Buchungskennung läuft mit anderem Inhalt.');
    }
    return { outcome: 'pending' };
  }
}
