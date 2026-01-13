<script lang="ts">
  // Ziel: Einheitliches Panel fuer AI-Vorschlaege und manuelle Aktionen
  // Siehe: docs/views/shared.md#tokenoverlay-actionpanel
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Modifier-Collapse Toggle
  // - Spec: shared.md#interaktion
  // - Modifikatoren-Sektion ein-/ausklappen
  //
  // [TODO]: Implementiere Schema-generierte Action-Beschreibung
  // - Spec: Tooltip.md#schema-generierte-beschreibungen
  // - generateActionDescription() aufrufen
  //
  // [TODO]: Implementiere Tooltip-Integration
  // - Spec: Tooltip.md
  // - Hover ueber Namen zeigt Tooltip
  //
  // ============================================================================

  import type { ActionPanelProps, ActionModifier } from './types';

  // Props
  let {
    position,
    cellSize,
    anchor = 'right',
    action,
    attacker,
    target,
    modifiers,
    onRoll,
    onEnterResult,
    onExecute,
  }: ActionPanelProps = $props();

  // State
  let modifiersExpanded = $state(true);

  // Computed - Position berechnen
  let style = $derived(computeStyle());

  function computeStyle(): string {
    const baseX = position.x * cellSize;
    const baseY = position.y * cellSize;

    let left: number;
    let top: number;

    switch (anchor) {
      case 'right':
        left = baseX + cellSize + 8;
        top = baseY;
        break;
      case 'left':
        left = baseX - 200; // Panel width estimate
        top = baseY;
        break;
      case 'top':
        left = baseX;
        top = baseY - 120; // Panel height estimate
        break;
      case 'bottom':
        left = baseX;
        top = baseY + cellSize + 8;
        break;
      default:
        left = baseX + cellSize + 8;
        top = baseY;
    }

    return `left: ${left}px; top: ${top}px;`;
  }

  // Check if action requires rolling
  /** HACK: siehe Header - vereinfachte Erkennung ob Wuerfeln noetig */
  let requiresRoll = $derived(
    action.actionType !== 'other' ||
    action.name.toLowerCase() !== 'dash' &&
    action.name.toLowerCase() !== 'disengage' &&
    action.name.toLowerCase() !== 'dodge' &&
    action.name.toLowerCase() !== 'hide'
  );

  // Format attack/save info
  /** HACK: siehe Header - vereinfachte Roll-Info Formatierung */
  let rollInfo = $derived(formatRollInfo());

  function formatRollInfo(): string {
    // Attack actions
    if (action.attackRoll) {
      const bonus = action.attackRoll.modifier ?? 0;
      const sign = bonus >= 0 ? '+' : '';
      return `${sign}${bonus} vs AC ${target.ac}`;
    }
    // Save actions
    if (action.savingThrow) {
      return `DC ${action.savingThrow.dc} ${action.savingThrow.ability.toUpperCase()}`;
    }
    return '';
  }

  // Format damage
  /** HACK: siehe Header - vereinfachte Damage Formatierung */
  let damageInfo = $derived(formatDamageInfo());

  function formatDamageInfo(): string {
    if (!action.damage) return '';
    const dmg = action.damage;
    const modifier = dmg.modifier ?? 0;
    const sign = modifier >= 0 ? '+' : '';
    return `${dmg.dice}${modifier !== 0 ? sign + modifier : ''} ${dmg.type}`;
  }

  function toggleModifiers(): void {
    modifiersExpanded = !modifiersExpanded;
  }
</script>

<div class="action-panel" style={style}>
  <!-- Action Name (mit Hover-Tooltip) -->
  <div class="action-header">
    <span class="action-name" title="TODO: Tooltip mit Schema-Beschreibung">
      {action.name}
    </span>
  </div>

  <!-- Roll Info + Damage -->
  <div class="roll-info">
    {#if rollInfo}
      <span>{rollInfo}</span>
    {/if}
    {#if rollInfo && damageInfo}
      <span class="separator">·</span>
    {/if}
    {#if damageInfo}
      <span>{damageInfo}</span>
    {/if}
  </div>

  <!-- Modifiers (collapsible) -->
  {#if modifiers.length > 0}
    <div class="modifiers">
      <button class="modifier-toggle" onclick={toggleModifiers}>
        {modifiersExpanded ? '▾' : '▸'} Modifiers ({modifiers.length})
      </button>
      {#if modifiersExpanded}
        <div class="modifier-list">
          {#each modifiers as mod}
            <div class="modifier" title="TODO: Tooltip mit Detail-Erklaerung">
              <span class="modifier-name">{mod.name}:</span>
              <span class="modifier-effect">{mod.effect}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Action Buttons -->
  <div class="actions">
    {#if requiresRoll}
      <button class="btn btn-primary" onclick={onRoll}>Roll</button>
      <button class="btn btn-secondary" onclick={onEnterResult}>Enter Result</button>
    {:else if onExecute}
      <button class="btn btn-primary" onclick={onExecute}>Ausfuehren</button>
    {/if}
  </div>
</div>

<style>
  .action-panel {
    position: absolute;
    background: var(--background-secondary, #2a2a4e);
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 100;
    font-size: 12px;
    min-width: 180px;
    font-family: system-ui, sans-serif;
    color: var(--text-normal, #e0e0e0);
  }

  .action-header {
    margin-bottom: 4px;
  }

  .action-name {
    font-weight: 600;
    cursor: help;
  }

  .roll-info {
    color: var(--text-muted, #a0a0a0);
    margin-bottom: 8px;
  }

  .separator {
    margin: 0 4px;
  }

  .modifiers {
    border-top: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
    padding-top: 6px;
    margin-top: 6px;
  }

  .modifier-toggle {
    background: none;
    border: none;
    color: var(--text-muted, #a0a0a0);
    cursor: pointer;
    padding: 0;
    font-size: 11px;
  }

  .modifier-toggle:hover {
    color: var(--text-normal, #e0e0e0);
  }

  .modifier-list {
    margin-top: 4px;
  }

  .modifier {
    cursor: help;
    padding: 2px 0;
    font-size: 11px;
  }

  .modifier-name {
    color: var(--text-muted, #a0a0a0);
  }

  .modifier-effect {
    color: var(--text-normal, #e0e0e0);
    margin-left: 4px;
  }

  .actions {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.1));
    padding-top: 8px;
    margin-top: 8px;
  }

  .btn {
    border: none;
    border-radius: 3px;
    padding: 4px 12px;
    cursor: pointer;
    flex: 1;
    font-size: 12px;
  }

  .btn-primary {
    background: var(--interactive-accent, #10b981);
    color: var(--text-on-accent, white);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    color: var(--text-muted, #a0a0a0);
  }

  .btn-secondary:hover {
    border-color: var(--text-muted, #a0a0a0);
    color: var(--text-normal, #e0e0e0);
  }
</style>
