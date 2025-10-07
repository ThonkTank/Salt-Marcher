// src/apps/almanac/data/almanac-repository.ts
// Almanac repository interface covering phenomenon access and mutation flows.

import type { EventsFilterState } from "../mode/contracts";
import type {
  EventsDataBatchDTO,
  EventsPaginationState,
  EventsSort,
  PhenomenonDTO,
  PhenomenonLinkUpdate,
  PhenomenonTemplateDTO,
} from "./dto";

export type AlmanacRepositoryErrorCode =
  | "validation_error"
  | "phenomenon_conflict"
  | "astronomy_source_missing";

export interface AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope: "phenomenon";
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export class AlmanacRepositoryError extends Error implements AlmanacRepositoryErrorDetails {
  readonly code: AlmanacRepositoryErrorCode;
  readonly scope = "phenomenon" as const;
  readonly details?: Record<string, unknown>;

  constructor(code: AlmanacRepositoryErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AlmanacRepositoryError";
    this.code = code;
    this.details = details;
  }
}

export interface AlmanacRepository {
  listPhenomena(input: {
    readonly viewMode: string;
    readonly filters: EventsFilterState;
    readonly sort: EventsSort;
    readonly pagination?: EventsPaginationState;
  }): Promise<EventsDataBatchDTO>;
  getPhenomenon(id: string): Promise<PhenomenonDTO | null>;
  upsertPhenomenon(draft: PhenomenonDTO): Promise<PhenomenonDTO>;
  deletePhenomenon(id: string): Promise<void>;
  updateLinks(update: PhenomenonLinkUpdate): Promise<PhenomenonDTO>;
  listTemplates(): Promise<ReadonlyArray<PhenomenonTemplateDTO>>;
}
