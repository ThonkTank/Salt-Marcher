<script lang="ts">
  // Ziel: Turn-Order Anzeige mit HP und Conditions
  // Siehe: docs/views/EncounterRunner/CombatTab.md#initiativelist
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Condition-Icons
  // - Spec: CombatTab.md#initiativelist
  // - Icons fuer Blinded, Poisoned, etc.
  //
  // [TODO]: Implementiere Concentration-Anzeige
  // - Spec: CombatTab.md#concentration
  // - [Concentrating: Spell] Badge
  //
  // ============================================================================

  import type { Combatant } from '@/types/combat';

  // Props
  interface Props {
    combatants: Combatant[];
    turnOrder: string[];
    currentTurnIndex: number;
    selectedCombatantId: string | null;
    onSelectCombatant: (id: string) => void;
  }

  let {
    combatants,
    turnOrder,
    currentTurnIndex,
    selectedCombatantId,
    onSelectCombatant,
  }: Props = $props();

  // Get combatant by ID
  function getCombatant(id: string): Combatant | undefined {
    return combatants.find(c => c.id === id);
  }

  // Format HP display
  function formatHP(combatant: Combatant): string {
    const current = combatant.combatState.currentHP;
    const max = combatant.combatState.maxHP;
    return `${current}/${max} HP`;
  }

  // Check if downed
  function isDowned(combatant: Combatant): boolean {
    return combatant.combatState.currentHP <= 0;
  }

  // Get group color
  function getGroupClass(combatant: Combatant): string {
    return combatant.combatState.groupId === 'party' ? 'party' : 'enemy';
  }
</script>

<div class="initiative-list">
  {#each turnOrder as id, index}
    {@const combatant = getCombatant(id)}
    {#if combatant}
      <button
        class="combatant-row"
        class:party={getGroupClass(combatant) === 'party'}
        class:enemy={getGroupClass(combatant) === 'enemy'}
        class:active={index === currentTurnIndex}
        class:selected={id === selectedCombatantId}
        class:downed={isDowned(combatant)}
        onclick={() => onSelectCombatant(id)}
      >
        <span class="turn-marker">{index === currentTurnIndex ? '▸' : ''}</span>
        <span class="name">{combatant.name}</span>
        <span class="hp">{formatHP(combatant)}</span>
        {#if isDowned(combatant)}
          <span class="status-badge downed-badge">[Downed]</span>
        {/if}
        <!-- TODO: Condition badges -->
        <!-- TODO: Concentration badge -->
      </button>
    {/if}
  {/each}
</div>

<style>
  .initiative-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: monospace;
    font-size: 12px;
  }

  .combatant-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: var(--text-normal, #e0e0e0);
    width: 100%;
  }

  .combatant-row:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .combatant-row.party {
    border-left: 3px solid #4A90D9;
    background: rgba(74, 144, 217, 0.1);
  }

  .combatant-row.enemy {
    border-left: 3px solid #D94A4A;
    background: rgba(217, 74, 74, 0.1);
  }

  .combatant-row.active {
    outline: 2px solid #fbbf24;
    outline-offset: -2px;
  }

  .combatant-row.selected {
    background: rgba(255, 255, 255, 0.1);
  }

  .combatant-row.downed {
    opacity: 0.6;
  }

  .turn-marker {
    width: 12px;
    color: #fbbf24;
    font-weight: bold;
  }

  .name {
    flex: 1;
    font-weight: 500;
  }

  .hp {
    color: var(--text-muted, #a0a0a0);
    min-width: 70px;
    text-align: right;
  }

  .status-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .downed-badge {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
</style>
