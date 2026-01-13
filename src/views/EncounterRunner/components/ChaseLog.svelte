<script lang="ts">
  // Ziel: Chase-Protokoll analog zu CombatLog
  // Siehe: docs/views/EncounterRunner/ChaseTab.md
  //
  // ============================================================================
  // TYPES
  // ============================================================================

  interface ChaseProtocolEntry {
    round: number;
    participantId: string;
    participantName?: string;
    type: 'dash' | 'action' | 'complication' | 'exhaustion';
    description: string;
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    protocol: ChaseProtocolEntry[];
  }

  let { protocol }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let groupedByRound = $derived(
    protocol.reduce(
      (acc, entry) => {
        const round = entry.round;
        if (!acc[round]) acc[round] = [];
        acc[round].push(entry);
        return acc;
      },
      {} as Record<number, ChaseProtocolEntry[]>
    )
  );

  let rounds = $derived(Object.keys(groupedByRound).map(Number).sort((a, b) => b - a));

  // ============================================================================
  // HELPERS
  // ============================================================================

  function getTypeIcon(type: ChaseProtocolEntry['type']): string {
    switch (type) {
      case 'dash':
        return '🏃';
      case 'action':
        return '⚔️';
      case 'complication':
        return '⚠️';
      case 'exhaustion':
        return '😫';
      default:
        return '•';
    }
  }

  function getTypeColor(type: ChaseProtocolEntry['type']): string {
    switch (type) {
      case 'dash':
        return '#10b981';
      case 'action':
        return '#4A90D9';
      case 'complication':
        return '#f59e0b';
      case 'exhaustion':
        return '#D94A4A';
      default:
        return '#888';
    }
  }
</script>

<div class="chase-log">
  <h4>Chase Log</h4>

  {#if protocol.length === 0}
    <div class="empty">No events yet</div>
  {:else}
    <div class="entries">
      {#each rounds as round}
        <div class="round-group">
          <div class="round-header">Round {round}</div>
          {#each groupedByRound[round] as entry}
            <div class="entry" style="--type-color: {getTypeColor(entry.type)}">
              <span class="icon">{getTypeIcon(entry.type)}</span>
              <span class="description">{entry.description}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chase-log {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    padding: 8px;
    overflow: hidden;
  }

  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .empty {
    color: var(--text-muted, #a0a0a0);
    font-size: 12px;
    font-style: italic;
    text-align: center;
    padding: 16px;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .round-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .round-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #a0a0a0);
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .entry {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
    border-left: 2px solid var(--type-color, #888);
    font-size: 12px;
  }

  .icon {
    flex-shrink: 0;
  }

  .description {
    flex: 1;
    line-height: 1.4;
  }
</style>
