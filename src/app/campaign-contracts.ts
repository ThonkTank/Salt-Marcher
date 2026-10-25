import type { Campaign, Result } from './contracts';
export interface CampaignOverview extends Campaign {
  trashed: boolean;
  rooms: number;
  locations: number;
  characters: number;
  notes: number;
  maps: number;
  audio: number;
  trashRevision: number;
  createdAt: string | null;
  lastOpenedAt: string | null;
}
export type SharedKind = 'item' | 'preset' | 'table' | 'audio' | 'mood';
export type ConflictChoice = 'keep-current' | 'keep-imported' | 'keep-both';
export interface DefinitionConflict {
  key: string;
  kind: SharedKind;
  id: string;
  name: string;
  incoming: string;
  existing: string;
  affectedCampaigns: number;
}
export interface CampaignTransferPreview {
  ticket: string;
  name: string;
  campaignId: string;
  applicationVersion: string;
  schema: number;
  counts: { table: string; records: number }[];
  audioFiles: number;
  bytes: number;
  conflicts: DefinitionConflict[];
  problems: string[];
  copy: boolean;
}
export interface CampaignTransferProgress {
  phase: string;
  records: number;
  bytes: number;
  busy: boolean;
}
export type CampaignTransferStatus =
  | { state: 'pending' | 'not-applied' }
  | { state: 'applied'; campaign: Campaign };
export interface CampaignManagementAPI {
  campaignInstallationSettings(): Promise<
    Result<{
      registry: import('./generation-contracts').GeneratorRegistry;
      activeId: string | null;
    }>
  >;
  campaignCatalog(command: CampaignCatalogCommand): Promise<Result<CampaignCatalogReceipt>>;
  campaignCatalogOutcome(
    command: CampaignCatalogCommand,
  ): Promise<Result<CampaignCatalogReceipt | null>>;
  campaignCatalogWorkspace(commandId: string): Promise<Result<import('./contracts').Workspace>>;

  campaignOverview(): Promise<Result<CampaignOverview[]>>;
  exportCampaign(token: string): Promise<Result<{ cancelled: boolean }>>;
  prepareCampaignImport(): Promise<Result<CampaignTransferPreview | null>>;
  prepareCampaignCopy(token: string): Promise<Result<CampaignTransferPreview>>;
  acceptCampaignTransfer(
    ticket: string,
    name: string,
    choices: Record<string, ConflictChoice>,
  ): Promise<Result<Campaign>>;
  campaignTransferStatus(ticket: string): Promise<Result<CampaignTransferStatus>>;
  cancelCampaignTransfer(ticket?: string): Promise<Result<void>>;
  onCampaignTransfer(callback: (progress: CampaignTransferProgress) => void): void;
}

export type CampaignCatalogCommand = { commandId: string } & (
  | { kind: 'create'; name: string }
  | { kind: 'open'; id: string }
  | { kind: 'rename'; id: string; expectedRevision: number; name: string }
  | { kind: 'trash'; id: string; expectedRevision: number; trashed: boolean }
  | { kind: 'erase'; id: string; expectedRevision: number; confirmName: string }
);
export interface CampaignCatalogReceipt {
  commandId: string;
  kind: CampaignCatalogCommand['kind'];
  campaignId: string;
  name: string;
  createdAt: string | null;
  lastOpenedAt: string | null;
}
