// src/features/data-manager/modal-persistence.ts
// Service for serializing and persisting draft data

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-modal-persistence");
import { buildSerializedPayload, persistSerializedPayload } from "../storage/storage";
import type { CreateSpec, SerializedPayload } from "../types";

/**
 * Result of serialization (before persistence)
 */
export interface ModalSerializationResult<TSerialized> {
  values: TSerialized;
  payload: SerializedPayload;
}

/**
 * Result of persistence (after save)
 */
export interface PersistenceResult<TSerialized> {
  filePath: string;
  values: TSerialized;
}

/**
 * Field transformer interface (will be implemented in modal-validator.ts)
 */
export interface FieldTransformer<TDraft> {
  apply(data: TDraft): Record<string, unknown>;
}

/**
 * Service responsible for serializing and persisting draft data.
 * Handles transformation, schema parsing, and storage operations.
 * Supports markdown backend for entity persistence.
 */
export class ModalPersistence<TDraft, TSerialized> {
  constructor(
    private app: App,
    private spec: CreateSpec<TDraft, TSerialized>,
    private transformer: FieldTransformer<TDraft>
  ) {}

  /**
   * Save draft data: transform → parse → serialize → persist
   */
  async save(data: TDraft): Promise<PersistenceResult<TSerialized>> {
    const serialized = await this.serialize(data);
    const result = await this.persist(serialized);
    return result;
  }

  /**
   * Serialize draft to payload (transform + parse + build payload)
   */
  private async serialize(draft: TDraft): Promise<ModalSerializationResult<TSerialized>> {
    // Apply field transforms
    const transformed = this.transformer.apply(draft);

    // Parse with schema
    const parsed = this.spec.schema.parse(transformed) as TSerialized;

    // Apply pre-save transformer (if defined)
    const prepared = this.spec.transformers?.preSave
      ? this.spec.transformers.preSave(parsed)
      : parsed;

    // Build serialized payload for storage
    const payload = buildSerializedPayload(
      this.spec.storage,
      prepared as unknown as Record<string, unknown>
    );

    return { values: prepared, payload };
  }

  /**
   * Persist serialized payload using vault backend
   */
  private async persist(
    serialized: ModalSerializationResult<TSerialized>
  ): Promise<PersistenceResult<TSerialized>> {
    const result = await persistSerializedPayload(
      this.app,
      this.spec.storage,
      serialized.payload
    );

    return {
      filePath: result.filePath,
      values: serialized.values
    };
  }
}
