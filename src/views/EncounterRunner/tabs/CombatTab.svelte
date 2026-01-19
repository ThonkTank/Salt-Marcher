<script lang="ts">
  // Ziel: Combat Tab Container - Initiative-Tracker, Grid, HP-Management
  // Siehe: docs/views/EncounterRunner/CombatTab.md
  //
  // ============================================================================
  // HACK & TODO
  // ============================================================================
  //
  // [HACK]: Vereinfachte State-Struktur
  // - CombatTabState komplett lokal statt via sessionState
  // - Keine echte Integration mit combatTestControl
  //
  // [TODO]: Implementiere vollstaendigen AI-Flow
  // - Spec: CombatTab.md#flow-turn-ausfuehren-ai
  // - AI berechnet suggestedAction bei Turn-Start
  //
  // [TODO]: Implementiere manuellen Action-Flow
  // - Spec: CombatTab.md#flow-turn-ausfuehren-manuell
  // - Aktion im DetailView waehlen, Ziel auf Map klicken
  //
  // [TODO]: Implementiere Reaction-Processing
  // - Spec: CombatTab.md#reactions
  // - Automatische Trigger-Erkennung
  //
  // [TODO]: Implementiere Concentration-Tracking
  // - Spec: CombatTab.md#concentration
  // - Check bei Damage
  //
  // [TODO]: Implementiere Turn-Effect Processing
  // - Spec: CombatTab.md#startend-of-turn-effekte
  // - Automatische Effekte bei Turn-Wechsel
  //
  // [TODO]: Implementiere Token Drag/Drop
  // - Spec: CombatTab.md#token-dragdrop
  //
  // ============================================================================

  import type { CombatState, Combatant, ManualRollData } from '@/types/combat';
  import type { Action } from '#entities/action';
  import type {
    GridPosition,
    ActionModifier,
    ResolutionRequest,
    ResolutionResult,
    RollResult,
  } from '@/views/shared/types';

  import { GridCanvas, ActionPanel, ResolutionPopup } from '@/views/shared';
  import { InitiativeList, CombatLog } from '../components';

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    combat: CombatState;
    suggestedAction: TurnAction | null;
    onAcceptAction: () => void;
    onSkipTurn: () => void;
    onEndCombat: () => void;
    onManualAction: (action: Action, targetId: string, manualRolls?: ManualRollData) => void;
    onTokenDrag: (combatantId: string, newPosition: GridPosition) => void;
  }

  interface TurnAction {
    combatantId: string;
    action: Action;
    targetId: string | null;
    targetPosition: GridPosition | null;
    movementPath: GridPosition[];
    score: number;
    expectedDamage: number;
  }

  let {
    combat,
    suggestedAction,
    onAcceptAction,
    onSkipTurn,
    onEndCombat,
    onManualAction,
    onTokenDrag,
  }: Props = $props();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  let selectedCombatantId = $state<string | null>(null);
  let selectedAction = $state<Action | null>(null);

  // Unified Resolution State (ersetzt separate Popup-States)
  let pendingResolution = $state<ResolutionRequest | null>(null);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let currentCombatant = $derived(
    combat.combatants.find(c => c.id === combat.turnOrder[combat.currentTurnIndex]) ?? null
  );

  let gridEntities = $derived(
    combat.combatants.map(c => ({
      id: c.id,
      position: c.combatState.position,
      label: c.name.charAt(0).toUpperCase(),
      color: c.combatState.groupId === 'party' ? '#4A90D9' : '#D94A4A',
      isActive: c.id === currentCombatant?.id,
    }))
  );

  // ActionPanel data for suggested action
  let actionPanelData = $derived(computeActionPanelData());

  function computeActionPanelData(): {
    position: GridPosition;
    action: Action;
    attacker: Combatant;
    target: Combatant;
    modifiers: ActionModifier[];
  } | null {
    if (!suggestedAction || !suggestedAction.targetId) return null;

    const attacker = combat.combatants.find(c => c.id === suggestedAction.combatantId);
    const target = combat.combatants.find(c => c.id === suggestedAction.targetId);

    if (!attacker || !target) return null;

    return {
      position: target.combatState.position,
      action: suggestedAction.action,
      attacker,
      target,
      modifiers: [], // TODO: berechne Modifiers aus AI-Context
    };
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleEntityClick(id: string): void {
    selectedCombatantId = id;
    // TODO: wenn selectedAction gesetzt, zeige ActionPanel fuer dieses Target
  }

  function handleCellClick(_pos: GridPosition): void {
    // TODO: Movement-Ziel oder AoE-Platzierung
  }

  function handleRoll(): void {
    if (!actionPanelData) return;
    pendingResolution = {
      type: 'action',
      action: actionPanelData.action,
      attacker: actionPanelData.attacker,
      target: actionPanelData.target,
      mode: 'roll',
    };
  }

  function handleEnterResult(): void {
    if (!actionPanelData) return;
    pendingResolution = {
      type: 'action',
      action: actionPanelData.action,
      attacker: actionPanelData.attacker,
      target: actionPanelData.target,
      mode: 'enter',
    };
  }

  /**
   * Converts view RollResult to ManualRollData.resultOverride.
   */
  function mapRollResultToOverride(rollResult: RollResult): ManualRollData['resultOverride'] {
    switch (rollResult) {
      case 'hit': return 'hit';
      case 'miss': return 'miss';
      case 'crit': return 'crit';
      default: return undefined; // 'save' and 'fail' not used for attacks
    }
  }

  function handleResolution(result: ResolutionResult): void {
    switch (result.type) {
      case 'action': {
        // Convert view result to ManualRollData
        const manualRolls: ManualRollData | undefined =
          result.attackRoll !== undefined || result.damageRoll !== undefined || result.rollResult !== undefined
            ? {
                attackRoll: result.attackRoll,
                damageRoll: result.damageRoll,
                resultOverride: mapRollResultToOverride(result.rollResult),
              }
            : undefined;

        // Call parent with manual roll data
        if (actionPanelData) {
          onManualAction(
            actionPanelData.action,
            actionPanelData.target.id,
            manualRolls
          );
        }
        break;
      }
      case 'reaction':
        console.log('Reaction:', result.used ? 'used' : 'ignored');
        // TODO: Apply reaction effect if used
        break;
      case 'concentration':
        console.log('Concentration:', result.saved ? 'maintained' : 'broken');
        // TODO: Break concentration if failed
        break;
      case 'turnEffect':
        console.log('Turn effect:', result.saved ? 'saved' : 'failed', 'Damage:', result.damage);
        // TODO: Apply effect damage if failed
        break;
    }
    pendingResolution = null;
  }

  function handleResolutionCancel(): void {
    pendingResolution = null;
  }

  // Helper: Trigger Reaction Prompt (called by workflow)
  function triggerReaction(reaction: Action, owner: Combatant, trigger: string): void {
    pendingResolution = { type: 'reaction', reaction, owner, trigger };
  }

  // Helper: Trigger Concentration Check (called by workflow)
  function triggerConcentrationCheck(combatant: Combatant, spell: string, damage: number): void {
    pendingResolution = { type: 'concentration', combatant, spell, damage };
  }

  // Helper: Trigger Turn Effect (called by workflow)
  function triggerTurnEffect(
    combatant: Combatant,
    timing: 'start' | 'end',
    effect: { name: string; description: string; saveDC: number; saveAbility: string; damage?: string }
  ): void {
    pendingResolution = { type: 'turnEffect', combatant, timing, effect };
  }

  // Expose helpers for external use (TypeScript will enforce type safety)
  export { triggerReaction, triggerConcentrationCheck, triggerTurnEffect };
</script>

<div class="combat-tab">
  <!-- Grid Section -->
  <div class="grid-section">
    <div class="canvas-container">
      <GridCanvas
        width={combat.grid?.size ?? 20}
        height={combat.grid?.size ?? 20}
        cellSize={32}
        entities={gridEntities}
        selectedEntityId={selectedCombatantId}
        onEntityClick={handleEntityClick}
        onCellClick={handleCellClick}
      />

      <!-- ActionPanel Overlay -->
      {#if actionPanelData}
        <ActionPanel
          position={actionPanelData.position}
          cellSize={32}
          action={actionPanelData.action}
          attacker={actionPanelData.attacker}
          target={actionPanelData.target}
          modifiers={actionPanelData.modifiers}
          onRoll={handleRoll}
          onEnterResult={handleEnterResult}
        />
      {/if}
    </div>
  </div>

  <!-- Info Panel -->
  <div class="info-panel">
    <div class="round-info">
      Round {combat.roundNumber} · Turn {combat.currentTurnIndex + 1}/{combat.turnOrder.length}
    </div>

    <InitiativeList
      combatants={combat.combatants}
      turnOrder={combat.turnOrder}
      currentTurnIndex={combat.currentTurnIndex}
      {selectedCombatantId}
      onSelectCombatant={handleEntityClick}
    />

    <div class="combat-controls">
      <button class="btn" onclick={onAcceptAction} disabled={!suggestedAction}>Accept AI</button>
      <button class="btn btn-secondary" onclick={onSkipTurn}>Skip</button>
      <button class="btn btn-danger" onclick={onEndCombat}>End Combat</button>
    </div>

    <CombatLog protocol={combat.protocol ?? []} />
  </div>

  <!-- Unified Resolution Popup (Action, Reaction, Concentration, TurnEffect) -->
  {#if pendingResolution}
    <ResolutionPopup
      request={pendingResolution}
      onResolve={handleResolution}
      onCancel={handleResolutionCancel}
    />
  {/if}
</div>

<style>
  .combat-tab {
    display: flex;
    gap: 16px;
    padding: 16px;
    height: 100%;
    font-family: system-ui, sans-serif;
    color: var(--text-normal, #e0e0e0);
    background: var(--background-primary, #1a1a2e);
  }

  .grid-section {
    flex: 1;
  }

  .canvas-container {
    position: relative;
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

  .combat-controls {
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
