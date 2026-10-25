import type { Result } from '../shared/contracts';
import type { DeskRef } from '../runtime/scene-desk-contracts';
export type SessionPacketAction =
  | { kind: 'reference'; ref: DeskRef }
  | { kind: 'encounter'; groupId: string; groupRevision?: number }
  | { kind: 'reward' };
export interface SessionPacketBlock {
  heading: string;
  text: string;
  kind: 'read-aloud' | 'gm' | 'reference' | 'encounter' | 'reward';
  action?: SessionPacketAction;
}
export interface SessionPacketVisit {
  id: string;
  title: string;
  locationId: string | null;
  location: string | null;
  blocks: SessionPacketBlock[];
}
export interface SessionPacket {
  planId: string;
  planName: string;
  planRevision: number;
  campaignName: string;
  basis: string;
  party: string[];
  visits: SessionPacketVisit[];
  warnings: string[];
}
export interface SessionPacketAPI {
  sessionPacket(token: string, planId: string): Promise<Result<SessionPacket>>;
  exportSessionPacket(
    token: string,
    planId: string,
    basis: string,
  ): Promise<Result<{ cancelled: boolean }>>;
}
const line = (s: string) => s.replace(/[\r\n]+/g, ' ');
export function sessionPacketMarkdown(p: SessionPacket): string {
  const out = [
    '# ' + line(p.planName || 'Unbenannter Spielabend'),
    '',
    line(p.campaignName) + ' · GM-Spielabendmappe',
    '',
    '**Planungsparty:** ' + (p.party.join(' · ') || 'Keine Vorgabe'),
    '',
    '## Besuchsfolge',
    '',
    ...p.visits.map(
      (v, i) => `${i + 1}. ${line(v.title)}${v.location ? ' — ' + line(v.location) : ''}`,
    ),
    '',
  ];
  if (p.warnings.length)
    out.push('## Offene Quellen', '', ...p.warnings.map((w) => '- ' + line(w)), '');
  for (const [i, v] of p.visits.entries()) {
    out.push(
      `## ${i + 1}. ${line(v.title)}`,
      '',
      v.location ? '**Ort:** ' + line(v.location) : '**Ort:** ohne Ortsbindung',
      '',
    );
    for (const b of v.blocks) out.push('### ' + line(b.heading), '', b.text, '');
  }
  return out.join('\n');
}
