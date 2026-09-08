export type CampaignManagementCommand =
  | Readonly<{ kind: 'create'; name: string }>
  | Readonly<{ kind: 'activate'; id: string }>
  | Readonly<{ kind: 'rename'; id: string; name: string }>
  | Readonly<{ kind: 'trash'; id: string }>
  | Readonly<{ kind: 'restore'; id: string }>
  | Readonly<{ kind: 'delete'; id: string; confirmationName: string }>

export interface CampaignActionAttempt {
  readonly completion: Promise<boolean>
  /** Resolves only this original attempt; never submits a replacement command. */
  settle(): Promise<'confirmed' | 'absent' | 'pending'>
}
