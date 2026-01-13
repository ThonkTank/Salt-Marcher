<script lang="ts">
  // Ziel: Combat Protocol Anzeige
  // Siehe: docs/views/EncounterRunner/CombatTab.md#combatlog
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Scroll-to-Bottom bei neuen Eintraegen
  // - Spec: CombatTab.md#combatlog
  //
  // [TODO]: Implementiere Filter nach Entry-Typ
  // - actions, reactions, damage, conditions
  //
  // [TODO]: Implementiere Round-Separator
  // - Visuelle Trennung zwischen Runden
  //
  // ============================================================================

  import type { CombatProtocolEntry } from '@/services/combatTracking/protocolLogger';

  // Props
  interface Props {
    protocol: CombatProtocolEntry[];
  }

  let { protocol }: Props = $props();

  // Group by round
  let entriesByRound = $derived(groupByRound(protocol));

  function groupByRound(
    entries: CombatProtocolEntry[]
  ): Map<number, CombatProtocolEntry[]> {
    const map = new Map<number, CombatProtocolEntry[]>();
    for (const entry of entries) {
      const round = entry.round;
      if (!map.has(round)) {
        map.set(round, []);
      }
      map.get(round)!.push(entry);
    }
    return map;
  }

  // Format entry for display
  function formatEntry(entry: CombatProtocolEntry): string {
    return entry.description;
  }

  // Get entry type class
  function getTypeClass(entry: CombatProtocolEntry): string {
    return entry.type;
  }
</script>

<div class="combat-log">
  {#each [...entriesByRound.entries()] as [round, entries]}
    <div class="round-group">
      <div class="round-header">Round {round}</div>
      {#each entries as entry}
        <div class="log-entry" class:action={entry.type === 'action'}>
          <span class="entry-marker">›</span>
          <span class="entry-text">{formatEntry(entry)}</span>
        </div>
      {/each}
    </div>
  {/each}

  {#if protocol.length === 0}
    <div class="empty-log">Combat log is empty</div>
  {/if}
</div>

<style>
  .combat-log {
    font-family: monospace;
    font-size: 11px;
    max-height: 200px;
    overflow-y: auto;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .round-group {
    margin-bottom: 8px;
  }

  .round-header {
    font-weight: 600;
    color: var(--text-muted, #a0a0a0);
    margin-bottom: 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .log-entry {
    display: flex;
    gap: 6px;
    padding: 2px 0;
    color: var(--text-normal, #e0e0e0);
  }

  .log-entry.action {
    color: #fbbf24;
  }

  .entry-marker {
    color: var(--text-faint, #6b7280);
  }

  .entry-text {
    flex: 1;
  }

  .empty-log {
    color: var(--text-faint, #6b7280);
    text-align: center;
    padding: 16px;
  }
</style>
