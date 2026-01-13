<script lang="ts">
  // Ziel: Chase Tab Container - Zone-Tracking, Distance, Complications, Dash-Exhaustion
  // Siehe: docs/views/EncounterRunner/ChaseTab.md
  //
  // ============================================================================
  // HACK & TODO
  // ============================================================================
  //
  // [HACK]: Vereinfachte State-Struktur
  // - ChaseState komplett lokal definiert statt aus types importiert
  // - Keine echte Integration mit Workflow
  //
  // [TODO]: Implementiere Complication-System
  // - Spec: ChaseTab.md#complications
  // - Zufaellige Hindernisse pro Zone
  //
  // [TODO]: Implementiere Dash-Exhaustion
  // - Spec: ChaseTab.md#dash-exhaustion
  // - CON-Save nach mehreren Dashes
  //
  // ============================================================================

  import type { Action } from '#entities/action';

  import { ZoneView, DistanceTracker, ChaseLog } from '../components';

  // ============================================================================
  // TYPES (lokal bis types.ts existiert)
  // ============================================================================

  interface ChaseParticipant {
    id: string;
    name: string;
    speed: number;
    zoneIndex: number;
    dashCount: number;
    isExhausted: boolean;
  }

  interface Zone {
    index: number;
    terrain: string;
    complication?: string;
  }

  interface ChaseState {
    pursuers: ChaseParticipant[];
    quarry: ChaseParticipant[];
    distance: number;
    zones: Zone[];
    round: number;
    currentParticipantIndex: number;
    turnOrder: string[];
  }

  interface ChaseProtocolEntry {
    round: number;
    participantId: string;
    type: 'dash' | 'action' | 'complication' | 'exhaustion';
    description: string;
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    chase: ChaseState;
    onDash: (participantId: string) => void;
    onAction: (participantId: string, action: Action) => void;
    onSkipTurn: () => void;
    onEndChase: () => void;
  }

  let {
    chase,
    onDash,
    onAction,
    onSkipTurn,
    onEndChase,
  }: Props = $props();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  let selectedParticipantId = $state<string | null>(null);
  let protocol = $state<ChaseProtocolEntry[]>([]);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let currentParticipant = $derived(
    [...chase.pursuers, ...chase.quarry].find(
      p => p.id === chase.turnOrder[chase.currentParticipantIndex]
    ) ?? null
  );

  let allParticipants = $derived(
    [...chase.pursuers, ...chase.quarry].map(p => ({
      id: p.id,
      name: p.name,
      zoneIndex: p.zoneIndex,
      isPursuer: chase.pursuers.some(pur => pur.id === p.id),
    }))
  );

  let escapeThreshold = $derived(chase.zones.length);
  let catchThreshold = $derived(0);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleZoneClick(index: number): void {
    // TODO: Zone-Interaktion (z.B. Complication anzeigen)
    console.log('Zone clicked:', index);
  }

  function handleDash(): void {
    if (currentParticipant) {
      onDash(currentParticipant.id);
    }
  }

  function handleParticipantSelect(id: string): void {
    selectedParticipantId = id;
  }
</script>

<div class="chase-tab">
  <!-- Zone Visualization -->
  <div class="zone-section">
    <ZoneView
      zones={chase.zones}
      participants={allParticipants}
      currentZone={currentParticipant?.zoneIndex ?? 0}
      onZoneClick={handleZoneClick}
    />

    <DistanceTracker
      distance={chase.distance}
      maxDistance={chase.zones.length}
      {escapeThreshold}
      {catchThreshold}
    />
  </div>

  <!-- Info Panel -->
  <div class="info-panel">
    <div class="round-info">
      Round {chase.round} · Turn {chase.currentParticipantIndex + 1}/{chase.turnOrder.length}
    </div>

    <!-- Participant List -->
    <div class="participant-list">
      <h4>Pursuers</h4>
      {#each chase.pursuers as p}
        <button
          class="participant"
          class:active={p.id === currentParticipant?.id}
          class:selected={p.id === selectedParticipantId}
          onclick={() => handleParticipantSelect(p.id)}
        >
          {p.name} · Zone {p.zoneIndex}
          {#if p.dashCount > 0}
            <span class="dash-count">({p.dashCount} dash)</span>
          {/if}
        </button>
      {/each}

      <h4>Quarry</h4>
      {#each chase.quarry as q}
        <button
          class="participant quarry"
          class:active={q.id === currentParticipant?.id}
          class:selected={q.id === selectedParticipantId}
          onclick={() => handleParticipantSelect(q.id)}
        >
          {q.name} · Zone {q.zoneIndex}
          {#if q.dashCount > 0}
            <span class="dash-count">({q.dashCount} dash)</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Controls -->
    <div class="chase-controls">
      <button class="btn" onclick={handleDash} disabled={!currentParticipant}>
        Dash
      </button>
      <button class="btn btn-secondary" onclick={onSkipTurn}>
        Skip
      </button>
      <button class="btn btn-danger" onclick={onEndChase}>
        End Chase
      </button>
    </div>

    <ChaseLog {protocol} />
  </div>
</div>

<style>
  .chase-tab {
    display: flex;
    gap: 16px;
    padding: 16px;
    height: 100%;
    font-family: system-ui, sans-serif;
    color: var(--text-normal, #e0e0e0);
    background: var(--background-primary, #1a1a2e);
  }

  .zone-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .info-panel {
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .round-info {
    font-size: 14px;
    font-weight: 500;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    text-align: center;
  }

  .participant-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .participant-list h4 {
    margin: 8px 0 4px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .participant {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    color: inherit;
  }

  .participant:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .participant.active {
    border-color: var(--interactive-accent, #10b981);
    background: rgba(16, 185, 129, 0.1);
  }

  .participant.selected {
    background: rgba(74, 144, 217, 0.2);
  }

  .participant.quarry {
    border-left: 3px solid #D94A4A;
  }

  .dash-count {
    font-size: 11px;
    color: var(--text-muted, #a0a0a0);
  }

  .chase-controls {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn {
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    background: var(--interactive-accent, #10b981);
    color: white;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    color: var(--text-muted, #a0a0a0);
  }

  .btn-danger {
    background: #ef4444;
  }
</style>
