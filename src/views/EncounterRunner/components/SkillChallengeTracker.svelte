<script lang="ts">
  // Ziel: Grid von Success/Failure Checkboxen fuer Skill Challenges
  // Siehe: docs/views/EncounterRunner/SocialTab.md
  //
  // ============================================================================
  // TYPES
  // ============================================================================

  interface SkillChallenge {
    name: string;
    successesRequired: number;
    failuresAllowed: number;
    currentSuccesses: number;
    currentFailures: number;
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    challenge: SkillChallenge;
    onSuccess: () => void;
    onFailure: () => void;
  }

  let { challenge, onSuccess, onFailure }: Props = $props();

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let isWon = $derived(challenge.currentSuccesses >= challenge.successesRequired);
  let isLost = $derived(challenge.currentFailures > challenge.failuresAllowed);
  let isComplete = $derived(isWon || isLost);

  let successSlots = $derived(
    Array.from({ length: challenge.successesRequired }, (_, i) => i < challenge.currentSuccesses)
  );

  let failureSlots = $derived(
    Array.from({ length: challenge.failuresAllowed + 1 }, (_, i) => i < challenge.currentFailures)
  );
</script>

<div class="skill-challenge-tracker" class:complete={isComplete} class:won={isWon} class:lost={isLost}>
  <div class="header">
    <h4>{challenge.name}</h4>
    {#if isWon}
      <span class="status-badge won">SUCCESS!</span>
    {:else if isLost}
      <span class="status-badge lost">FAILED</span>
    {/if}
  </div>

  <div class="tracks">
    <!-- Success Track -->
    <div class="track success-track">
      <span class="track-label">Successes</span>
      <div class="slots">
        {#each successSlots as filled, i}
          <div class="slot success" class:filled>
            {#if filled}✓{/if}
          </div>
        {/each}
      </div>
      <span class="count">{challenge.currentSuccesses}/{challenge.successesRequired}</span>
    </div>

    <!-- Failure Track -->
    <div class="track failure-track">
      <span class="track-label">Failures</span>
      <div class="slots">
        {#each failureSlots as filled, i}
          <div class="slot failure" class:filled>
            {#if filled}✗{/if}
          </div>
        {/each}
      </div>
      <span class="count">{challenge.currentFailures}/{challenge.failuresAllowed + 1}</span>
    </div>
  </div>

  {#if !isComplete}
    <div class="actions">
      <button class="btn success-btn" onclick={onSuccess}>Add Success</button>
      <button class="btn failure-btn" onclick={onFailure}>Add Failure</button>
    </div>
  {/if}
</div>

<style>
  .skill-challenge-tracker {
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .skill-challenge-tracker.complete {
    opacity: 0.8;
  }

  .skill-challenge-tracker.won {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(16, 185, 129, 0.05);
  }

  .skill-challenge-tracker.lost {
    border-color: rgba(217, 74, 74, 0.5);
    background: rgba(217, 74, 74, 0.05);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .status-badge.won {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .status-badge.lost {
    background: rgba(217, 74, 74, 0.2);
    color: #D94A4A;
  }

  .tracks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .track {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .track-label {
    width: 70px;
    font-size: 11px;
    color: var(--text-muted, #a0a0a0);
  }

  .slots {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .slot {
    width: 24px;
    height: 24px;
    border: 2px solid;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
  }

  .slot.success {
    border-color: rgba(16, 185, 129, 0.4);
    color: #10b981;
  }

  .slot.success.filled {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
  }

  .slot.failure {
    border-color: rgba(217, 74, 74, 0.4);
    color: #D94A4A;
  }

  .slot.failure.filled {
    background: rgba(217, 74, 74, 0.2);
    border-color: #D94A4A;
  }

  .count {
    width: 40px;
    text-align: right;
    font-size: 12px;
    color: var(--text-muted, #a0a0a0);
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn {
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    color: white;
  }

  .btn:hover {
    filter: brightness(1.1);
  }

  .success-btn {
    background: #10b981;
  }

  .failure-btn {
    background: #D94A4A;
  }
</style>
