<script lang="ts">
  // Ziel: Unified Resolution Popup fuer Action, Reaction, Concentration, TurnEffect
  // Siehe: docs/views/EncounterRunner/CombatTab.md#unified-resolutionpopup
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Auto-Roll fuer mode='roll'
  // - Spec: CombatTab.md#varianten-nach-trigger
  // - System wuerfelt automatisch via probability/random
  //
  // [TODO]: Implementiere Crit-Damage-Berechnung
  // - Spec: CombatTab.md#bei-crit
  // - Dice verdoppeln
  //
  // [TODO]: Implementiere Half-Damage bei Save
  // - Spec: CombatTab.md#bei-save
  // - Automatische Halbierung
  //
  // ============================================================================

  import type {
    ResolutionRequest,
    ResolutionResult,
    ResolutionPopupProps,
    RollResult,
  } from './types';

  // Props
  let { request, onResolve, onCancel }: ResolutionPopupProps = $props();

  // ============================================================================
  // STATE
  // ============================================================================

  let attackRoll = $state<number | null>(null);
  let damageRoll = $state<number | null>(null);
  let selectedResult = $state<string | null>(null);

  // ============================================================================
  // COMPUTED - Header
  // ============================================================================

  let headerIcon = $derived(computeHeaderIcon());
  let headerText = $derived(computeHeaderText());
  let accentColor = $derived(computeAccentColor());

  function computeHeaderIcon(): string {
    switch (request.type) {
      case 'action': return '⚔️';
      case 'reaction': return '⚡';
      case 'concentration': return '🎯';
      case 'turnEffect': return '🔄';
    }
  }

  function computeHeaderText(): string {
    switch (request.type) {
      case 'action':
        return `${request.action.name} → ${request.target.name}`;
      case 'reaction':
        return 'Reaction verfuegbar!';
      case 'concentration':
        return 'Concentration-Check';
      case 'turnEffect':
        return `${request.combatant.name}'s Zug`;
    }
  }

  function computeAccentColor(): string {
    switch (request.type) {
      case 'action': return '#10b981'; // Green
      case 'reaction': return '#fbbf24'; // Yellow
      case 'concentration': return '#8b5cf6'; // Purple
      case 'turnEffect': return '#3b82f6'; // Blue
    }
  }

  // ============================================================================
  // COMPUTED - Action-specific
  // ============================================================================

  let isAttack = $derived(
    request.type === 'action' && !!request.action.attackRoll
  );

  let isSave = $derived(
    request.type === 'action' && !!request.action.savingThrow
  );

  let attackModifier = $derived(
    request.type === 'action' ? (request.action.attackRoll?.modifier ?? 0) : 0
  );

  let damageModifier = $derived(
    request.type === 'action' ? (request.action.damage?.modifier ?? 0) : 0
  );

  let damageDice = $derived(
    request.type === 'action' ? (request.action.damage?.dice ?? '') : ''
  );

  let saveDC = $derived(
    request.type === 'action' ? (request.action.savingThrow?.dc ?? 0) :
    request.type === 'concentration' ? Math.max(10, Math.floor(request.damage / 2)) :
    request.type === 'turnEffect' ? request.effect.saveDC : 0
  );

  let saveAbility = $derived(
    request.type === 'action' ? (request.action.savingThrow?.ability?.toUpperCase() ?? '') :
    request.type === 'turnEffect' ? request.effect.saveAbility.toUpperCase() :
    request.type === 'concentration' ? 'CON' : ''
  );

  let totalAttack = $derived(
    attackRoll !== null ? attackRoll + attackModifier : null
  );

  let totalDamage = $derived(computeTotalDamage());

  function computeTotalDamage(): number {
    if (damageRoll === null) return 0;

    let total = damageRoll + damageModifier;

    // Crit doubles base roll (HACK: vereinfacht)
    if (selectedResult === 'crit') {
      total = damageRoll * 2 + damageModifier;
    }

    // Save halves damage
    if (selectedResult === 'save') {
      total = Math.floor(total / 2);
    }

    return Math.max(0, total);
  }

  // ============================================================================
  // COMPUTED - Result Options
  // ============================================================================

  let resultOptions = $derived(computeResultOptions());

  function computeResultOptions(): Array<{ value: string; label: string }> {
    switch (request.type) {
      case 'action':
        if (isAttack) {
          return [
            { value: 'hit', label: 'Hit' },
            { value: 'miss', label: 'Miss' },
            { value: 'crit', label: 'Crit' },
          ];
        } else {
          return [
            { value: 'save', label: 'Save' },
            { value: 'fail', label: 'Fail' },
          ];
        }
      case 'reaction':
        return [
          { value: 'use', label: 'Verwenden' },
          { value: 'ignore', label: 'Ignorieren' },
        ];
      case 'concentration':
      case 'turnEffect':
        return [
          { value: 'save', label: 'Save erfolgt' },
          { value: 'fail', label: 'Save fehlgeschlagen' },
        ];
    }
  }

  // ============================================================================
  // COMPUTED - Visibility
  // ============================================================================

  let showDiceInput = $derived(
    request.type === 'action' && request.mode === 'enter'
  );

  let showDamageSection = $derived(computeShowDamage());

  function computeShowDamage(): boolean {
    if (request.type !== 'action') return false;
    if (!request.action.damage) return false;

    return (
      selectedResult === 'hit' ||
      selectedResult === 'crit' ||
      selectedResult === 'fail' ||
      selectedResult === 'save'
    );
  }

  let showTimingBadge = $derived(request.type === 'turnEffect');

  // ============================================================================
  // COMPUTED - Validation
  // ============================================================================

  let canConfirm = $derived(computeCanConfirm());

  function computeCanConfirm(): boolean {
    if (selectedResult === null) return false;

    if (request.type === 'action') {
      // Bei Action mit Damage muss damageRoll eingegeben sein
      if (showDamageSection && damageRoll === null) return false;
    }

    return true;
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  function selectResult(value: string): void {
    selectedResult = value;
  }

  function handleConfirm(): void {
    if (!canConfirm) return;

    let result: ResolutionResult;

    switch (request.type) {
      case 'action':
        result = {
          type: 'action',
          rollResult: selectedResult as RollResult,
          attackRoll: attackRoll ?? undefined,
          damageRoll: damageRoll ?? undefined,
          totalDamage,
        };
        break;

      case 'reaction':
        result = {
          type: 'reaction',
          used: selectedResult === 'use',
        };
        break;

      case 'concentration':
        result = {
          type: 'concentration',
          saved: selectedResult === 'save',
        };
        break;

      case 'turnEffect':
        result = {
          type: 'turnEffect',
          saved: selectedResult === 'save',
          damage: selectedResult === 'fail' && request.effect.damage ? damageRoll ?? undefined : undefined,
        };
        break;
    }

    onResolve(result);
  }

  function handleInputChange(
    event: Event,
    setter: (v: number | null) => void
  ): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (value === '') {
      setter(null);
    } else {
      const num = parseInt(value, 10);
      setter(isNaN(num) ? null : num);
    }
  }
</script>

<div class="resolution-popup" style="--accent-color: {accentColor}">
  <!-- Header -->
  <div class="popup-header">
    <span class="header-icon">{headerIcon}</span>
    <span class="header-text">{headerText}</span>
    {#if showTimingBadge && request.type === 'turnEffect'}
      <span class="timing-badge">
        {request.timing === 'start' ? 'Start-of-Turn' : 'End-of-Turn'}
      </span>
    {/if}
  </div>

  <!-- Info Section -->
  <div class="info-section">
    {#if request.type === 'action'}
      {#if isAttack}
        <div class="info-label">Angriffswurf</div>
        {#if showDiceInput}
          <div class="roll-row">
            <span>Gewuerfelt:</span>
            <input
              type="number"
              class="roll-input"
              bind:value={attackRoll}
              oninput={(e) => handleInputChange(e, (v) => attackRoll = v)}
              placeholder="___"
            />
            <span>+ {attackModifier} =</span>
            <span class="total">{totalAttack ?? '___'}</span>
          </div>
        {:else}
          <div class="info-value">+{attackModifier} vs AC {request.target.ac}</div>
        {/if}
      {:else if isSave}
        <div class="info-label">{saveAbility} Save DC {saveDC}</div>
      {/if}

    {:else if request.type === 'reaction'}
      <div class="info-label">Trigger</div>
      <div class="info-value">{request.trigger}</div>
      <div class="reaction-info">
        <span class="reaction-name">{request.reaction.name}</span>
        <span class="reaction-owner">({request.owner.name})</span>
      </div>

    {:else if request.type === 'concentration'}
      <div class="concentration-info">
        <div class="combatant-name">{request.combatant.name}</div>
        <div class="spell-info">konzentriert auf: <strong>{request.spell}</strong></div>
        <div class="damage-info">Schaden erhalten: {request.damage}</div>
      </div>
      <div class="dc-info">
        <span class="info-label">DC:</span>
        <span class="info-value">{saveDC}</span>
        <span class="formula">(max(10, damage/2))</span>
      </div>

    {:else if request.type === 'turnEffect'}
      <div class="effect-info">
        <div class="effect-name">{request.effect.name}</div>
        <div class="effect-description">{request.effect.description}</div>
      </div>
      <div class="save-info">
        Save: DC {saveDC} {saveAbility}
      </div>
    {/if}
  </div>

  <!-- Result Buttons -->
  <div class="result-buttons">
    {#each resultOptions as option}
      <button
        class="result-btn"
        class:selected={selectedResult === option.value}
        onclick={() => selectResult(option.value)}
      >
        {option.label}
      </button>
    {/each}
  </div>

  <!-- Damage Section (conditional) -->
  {#if showDamageSection && request.type === 'action'}
    <div class="damage-section">
      <div class="section-label">
        Schaden
        {#if selectedResult === 'crit'}
          <span class="note">(Crit: Dice verdoppelt)</span>
        {/if}
        {#if selectedResult === 'save'}
          <span class="note">(Bei Save: halber Schaden)</span>
        {/if}
      </div>
      <div class="roll-row">
        <span>Gewuerfelt:</span>
        <input
          type="number"
          class="roll-input"
          bind:value={damageRoll}
          oninput={(e) => handleInputChange(e, (v) => damageRoll = v)}
          placeholder="___"
          disabled={request.mode === 'roll'}
        />
        {#if damageModifier !== 0}
          <span>+ {damageModifier}</span>
        {/if}
        <span>=</span>
        <span class="total">{totalDamage}</span>
      </div>
      <div class="dice-hint">{damageDice}</div>
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="popup-actions">
    <button class="btn btn-secondary" onclick={onCancel}>Abbrechen</button>
    <button
      class="btn btn-primary"
      onclick={handleConfirm}
      disabled={!canConfirm}
    >
      Bestaetigen
    </button>
  </div>
</div>

<style>
  .resolution-popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--background-primary, #1a1a2e);
    border: 2px solid var(--accent-color);
    border-radius: 8px;
    padding: 16px;
    min-width: 320px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px color-mix(in srgb, var(--accent-color) 30%, transparent);
    z-index: 1000;
    font-family: system-ui, sans-serif;
    color: var(--text-normal, #e0e0e0);
  }

  .popup-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 12px;
  }

  .header-icon {
    font-size: 20px;
  }

  .header-text {
    font-weight: 600;
    font-size: 14px;
    flex: 1;
  }

  .timing-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: color-mix(in srgb, var(--accent-color) 20%, transparent);
    color: var(--accent-color);
    border-radius: 4px;
  }

  .info-section {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    margin-bottom: 12px;
  }

  .info-label {
    font-size: 12px;
    color: var(--text-muted, #a0a0a0);
    margin-bottom: 4px;
  }

  .info-value {
    font-size: 14px;
  }

  .roll-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin-top: 4px;
  }

  .roll-input {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
    background: var(--background-secondary, #2a2a4e);
    color: var(--text-normal, #e0e0e0);
    text-align: center;
    font-size: 14px;
  }

  .roll-input:disabled {
    opacity: 0.6;
  }

  .total {
    font-weight: 600;
    min-width: 30px;
  }

  /* Reaction specific */
  .reaction-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .reaction-name {
    font-weight: 600;
  }

  .reaction-owner {
    color: var(--text-muted, #a0a0a0);
    font-size: 12px;
  }

  /* Concentration specific */
  .concentration-info {
    margin-bottom: 8px;
  }

  .combatant-name {
    font-weight: 600;
    margin-bottom: 4px;
  }

  .spell-info,
  .damage-info {
    font-size: 13px;
    color: var(--text-muted, #a0a0a0);
  }

  .dc-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .formula {
    font-size: 11px;
    color: var(--text-faint, #6b7280);
  }

  /* Turn effect specific */
  .effect-info {
    margin-bottom: 8px;
  }

  .effect-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .effect-description {
    font-size: 12px;
    color: var(--text-muted, #a0a0a0);
    line-height: 1.4;
  }

  .save-info {
    font-size: 14px;
    font-weight: 500;
  }

  /* Result buttons */
  .result-buttons {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }

  .result-btn {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
    background: var(--background-secondary, #2a2a4e);
    color: var(--text-normal, #e0e0e0);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .result-btn:hover {
    border-color: var(--accent-color);
  }

  .result-btn.selected {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  /* Damage section */
  .damage-section {
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 12px;
  }

  .section-label {
    font-size: 12px;
    color: var(--text-muted, #a0a0a0);
    margin-bottom: 6px;
  }

  .note {
    font-size: 10px;
    margin-left: 8px;
    color: var(--text-faint, #6b7280);
  }

  .dice-hint {
    font-size: 11px;
    color: var(--text-faint, #6b7280);
    margin-top: 4px;
  }

  /* Action buttons */
  .popup-actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    color: var(--text-muted, #a0a0a0);
  }

  .btn-secondary:hover {
    border-color: var(--text-muted, #a0a0a0);
  }
</style>
