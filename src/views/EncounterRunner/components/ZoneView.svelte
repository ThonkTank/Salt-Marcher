<script lang="ts">
  // Ziel: Horizontale Zone-Visualisierung fuer Chase Encounters
  // Siehe: docs/views/EncounterRunner/ChaseTab.md
  //
  // ============================================================================
  // HACK & TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Complication-Anzeige
  // - Spec: ChaseTab.md#complications
  // - Icon/Badge pro Zone wenn Complication aktiv
  //
  // ============================================================================

  // ============================================================================
  // TYPES
  // ============================================================================

  interface Zone {
    index: number;
    terrain: string;
    complication?: string;
  }

  interface Participant {
    id: string;
    name: string;
    zoneIndex: number;
    isPursuer: boolean;
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    zones: Zone[];
    participants: Participant[];
    currentZone: number;
    onZoneClick?: (index: number) => void;
  }

  let {
    zones,
    participants,
    currentZone,
    onZoneClick,
  }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let participantsByZone = $derived(
    zones.map(zone => ({
      zone,
      participants: participants.filter(p => p.zoneIndex === zone.index),
    }))
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleZoneClick(index: number): void {
    onZoneClick?.(index);
  }
</script>

<div class="zone-view">
  {#each participantsByZone as { zone, participants: zoneParticipants }}
    <button
      class="zone"
      class:current={zone.index === currentZone}
      class:has-complication={zone.complication}
      onclick={() => handleZoneClick(zone.index)}
    >
      <div class="zone-header">
        <span class="zone-number">{zone.index}</span>
        <span class="zone-terrain">{zone.terrain}</span>
      </div>

      {#if zone.complication}
        <div class="complication-badge" title={zone.complication}>!</div>
      {/if}

      <div class="zone-participants">
        {#each zoneParticipants as p}
          <div
            class="participant-token"
            class:pursuer={p.isPursuer}
            class:quarry={!p.isPursuer}
            title={p.name}
          >
            {p.name.charAt(0)}
          </div>
        {/each}
      </div>
    </button>
  {/each}
</div>

<style>
  .zone-view {
    display: flex;
    gap: 8px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    overflow-x: auto;
  }

  .zone {
    position: relative;
    min-width: 80px;
    min-height: 100px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: inherit;
  }

  .zone:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .zone.current {
    border-color: var(--interactive-accent, #10b981);
    background: rgba(16, 185, 129, 0.1);
  }

  .zone.has-complication {
    border-color: #f59e0b;
  }

  .zone-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .zone-number {
    font-size: 18px;
    font-weight: 600;
  }

  .zone-terrain {
    font-size: 10px;
    color: var(--text-muted, #a0a0a0);
    text-transform: uppercase;
  }

  .complication-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    background: #f59e0b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: white;
  }

  .zone-participants {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
  }

  .participant-token {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
  }

  .participant-token.pursuer {
    background: #4A90D9;
  }

  .participant-token.quarry {
    background: #D94A4A;
  }
</style>
