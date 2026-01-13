<script lang="ts">
  // Ziel: Farbiger Balken mit Zonen (Hostile -> Helpful) fuer Social Encounters
  // Siehe: docs/views/EncounterRunner/SocialTab.md
  //
  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    value: number; // -100 to +100
    thresholds?: {
      hostile: number;
      unfriendly: number;
      friendly: number;
      helpful: number;
    };
  }

  let {
    value,
    thresholds = {
      hostile: -60,
      unfriendly: -20,
      friendly: 20,
      helpful: 60,
    },
  }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  // Convert -100..+100 to 0..100 percentage
  let percentage = $derived(Math.max(0, Math.min(100, (value + 100) / 2)));

  let currentZone = $derived(
    value <= thresholds.hostile
      ? 'hostile'
      : value <= thresholds.unfriendly
        ? 'unfriendly'
        : value <= thresholds.friendly
          ? 'neutral'
          : value <= thresholds.helpful
            ? 'friendly'
            : 'helpful'
  );

  // Convert thresholds to percentages
  let hostilePos = $derived((thresholds.hostile + 100) / 2);
  let unfriendlyPos = $derived((thresholds.unfriendly + 100) / 2);
  let friendlyPos = $derived((thresholds.friendly + 100) / 2);
  let helpfulPos = $derived((thresholds.helpful + 100) / 2);
</script>

<div class="disposition-meter">
  <div class="track">
    <!-- Zone backgrounds -->
    <div class="zone hostile" style="width: {hostilePos}%"></div>
    <div class="zone unfriendly" style="left: {hostilePos}%; width: {unfriendlyPos - hostilePos}%"></div>
    <div class="zone neutral" style="left: {unfriendlyPos}%; width: {friendlyPos - unfriendlyPos}%"></div>
    <div class="zone friendly" style="left: {friendlyPos}%; width: {helpfulPos - friendlyPos}%"></div>
    <div class="zone helpful" style="left: {helpfulPos}%; width: {100 - helpfulPos}%"></div>

    <!-- Threshold markers -->
    <div class="threshold" style="left: {hostilePos}%"></div>
    <div class="threshold" style="left: {unfriendlyPos}%"></div>
    <div class="threshold" style="left: {friendlyPos}%"></div>
    <div class="threshold" style="left: {helpfulPos}%"></div>

    <!-- Current value indicator -->
    <div class="indicator {currentZone}" style="left: {percentage}%"></div>
  </div>

  <div class="labels">
    <span class="label hostile">Hostile</span>
    <span class="label unfriendly">Unfriendly</span>
    <span class="label neutral">Neutral</span>
    <span class="label friendly">Friendly</span>
    <span class="label helpful">Helpful</span>
  </div>

  <div class="value-display">
    {value > 0 ? '+' : ''}{value}
  </div>
</div>

<style>
  .disposition-meter {
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .track {
    position: relative;
    height: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    overflow: hidden;
  }

  .zone {
    position: absolute;
    top: 0;
    height: 100%;
    opacity: 0.6;
  }

  .zone.hostile {
    background: #D94A4A;
  }

  .zone.unfriendly {
    background: #f59e0b;
  }

  .zone.neutral {
    background: #888888;
  }

  .zone.friendly {
    background: #4A90D9;
  }

  .zone.helpful {
    background: #10b981;
  }

  .threshold {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-50%);
  }

  .indicator {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    border: 3px solid currentColor;
    transform: translate(-50%, -50%);
    transition: left 0.3s ease;
    z-index: 1;
  }

  .indicator.hostile {
    color: #D94A4A;
  }

  .indicator.unfriendly {
    color: #f59e0b;
  }

  .indicator.neutral {
    color: #888888;
  }

  .indicator.friendly {
    color: #4A90D9;
  }

  .indicator.helpful {
    color: #10b981;
  }

  .labels {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    padding: 0 4px;
  }

  .label {
    font-size: 9px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .label.hostile {
    color: #D94A4A;
  }

  .label.unfriendly {
    color: #f59e0b;
  }

  .label.friendly {
    color: #4A90D9;
  }

  .label.helpful {
    color: #10b981;
  }

  .value-display {
    text-align: center;
    margin-top: 8px;
    font-size: 18px;
    font-weight: 600;
  }
</style>
