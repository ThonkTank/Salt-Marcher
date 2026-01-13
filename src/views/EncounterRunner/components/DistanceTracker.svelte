<script lang="ts">
  // Ziel: Visueller Abstandsbalken mit Schwellenwert-Markern fuer Chase
  // Siehe: docs/views/EncounterRunner/ChaseTab.md
  //
  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    distance: number;
    maxDistance: number;
    escapeThreshold: number;
    catchThreshold: number;
  }

  let {
    distance,
    maxDistance,
    escapeThreshold,
    catchThreshold,
  }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let percentage = $derived(Math.max(0, Math.min(100, (distance / maxDistance) * 100)));
  let escapePercentage = $derived((escapeThreshold / maxDistance) * 100);
  let catchPercentage = $derived((catchThreshold / maxDistance) * 100);

  let status = $derived(
    distance >= escapeThreshold
      ? 'escaped'
      : distance <= catchThreshold
        ? 'caught'
        : 'ongoing'
  );
</script>

<div class="distance-tracker">
  <div class="label-row">
    <span class="label">Caught</span>
    <span class="distance-value">{distance} / {maxDistance} zones</span>
    <span class="label">Escaped</span>
  </div>

  <div class="track">
    <!-- Catch zone marker -->
    <div
      class="threshold-marker catch"
      style="left: {catchPercentage}%"
    ></div>

    <!-- Escape zone marker -->
    <div
      class="threshold-marker escape"
      style="left: {escapePercentage}%"
    ></div>

    <!-- Current distance indicator -->
    <div
      class="indicator"
      class:caught={status === 'caught'}
      class:escaped={status === 'escaped'}
      style="left: {percentage}%"
    ></div>

    <!-- Progress fill -->
    <div class="fill" style="width: {percentage}%"></div>
  </div>

  <div class="status-row">
    {#if status === 'caught'}
      <span class="status-badge caught">CAUGHT!</span>
    {:else if status === 'escaped'}
      <span class="status-badge escaped">ESCAPED!</span>
    {:else}
      <span class="status-badge ongoing">Chase ongoing</span>
    {/if}
  </div>
</div>

<style>
  .distance-tracker {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .label {
    font-size: 11px;
    color: var(--text-muted, #a0a0a0);
    text-transform: uppercase;
  }

  .distance-value {
    font-size: 14px;
    font-weight: 500;
  }

  .track {
    position: relative;
    height: 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: visible;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #D94A4A 0%, #f59e0b 50%, #10b981 100%);
    border-radius: 6px;
    transition: width 0.3s ease;
  }

  .threshold-marker {
    position: absolute;
    top: -4px;
    width: 2px;
    height: 20px;
    transform: translateX(-50%);
  }

  .threshold-marker.catch {
    background: #D94A4A;
  }

  .threshold-marker.escape {
    background: #10b981;
  }

  .indicator {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    background: white;
    border: 3px solid #f59e0b;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: left 0.3s ease;
    z-index: 1;
  }

  .indicator.caught {
    border-color: #D94A4A;
  }

  .indicator.escaped {
    border-color: #10b981;
  }

  .status-row {
    margin-top: 8px;
    text-align: center;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.ongoing {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-muted, #a0a0a0);
  }

  .status-badge.caught {
    background: rgba(217, 74, 74, 0.2);
    color: #D94A4A;
  }

  .status-badge.escaped {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
</style>
