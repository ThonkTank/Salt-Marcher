<script lang="ts">
  // Ziel: Kompakte NPC-Info-Karte fuer Social Encounters
  // Siehe: docs/views/EncounterRunner/SocialTab.md
  //
  // ============================================================================
  // TYPES
  // ============================================================================

  interface SocialNPC {
    id: string;
    name: string;
    personality: string;
    goal: string;
    quirk?: string;
    disposition: number;
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    npc: SocialNPC;
    isLead?: boolean;
  }

  let { npc, isLead = false }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let dispositionLabel = $derived(getDispositionLabel(npc.disposition));
  let dispositionColor = $derived(getDispositionColor(npc.disposition));

  // ============================================================================
  // HELPERS
  // ============================================================================

  function getDispositionLabel(value: number): string {
    if (value <= -60) return 'Hostile';
    if (value <= -20) return 'Unfriendly';
    if (value <= 20) return 'Neutral';
    if (value <= 60) return 'Friendly';
    return 'Helpful';
  }

  function getDispositionColor(value: number): string {
    if (value <= -60) return '#D94A4A';
    if (value <= -20) return '#f59e0b';
    if (value <= 20) return '#888888';
    if (value <= 60) return '#4A90D9';
    return '#10b981';
  }
</script>

<div class="npc-panel" class:lead={isLead}>
  <div class="header">
    <h3>{npc.name}</h3>
    {#if isLead}
      <span class="lead-badge">Lead</span>
    {/if}
  </div>

  <div class="disposition-row">
    <span class="disposition-label" style="color: {dispositionColor}">{dispositionLabel}</span>
    <span class="disposition-value">({npc.disposition > 0 ? '+' : ''}{npc.disposition})</span>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <span class="info-label">Personality</span>
      <span class="info-value">{npc.personality}</span>
    </div>

    <div class="info-item">
      <span class="info-label">Goal</span>
      <span class="info-value">{npc.goal}</span>
    </div>

    {#if npc.quirk}
      <div class="info-item">
        <span class="info-label">Quirk</span>
        <span class="info-value">{npc.quirk}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .npc-panel {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .npc-panel.lead {
    border-color: var(--interactive-accent, #10b981);
    background: rgba(16, 185, 129, 0.05);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .lead-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--interactive-accent, #10b981);
    border-radius: 3px;
    color: white;
    text-transform: uppercase;
  }

  .disposition-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .disposition-label {
    font-weight: 600;
    font-size: 14px;
  }

  .disposition-value {
    font-size: 12px;
    color: var(--text-muted, #a0a0a0);
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .info-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .info-value {
    font-size: 13px;
    line-height: 1.4;
  }
</style>
