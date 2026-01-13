<script lang="ts">
  // Ziel: Social Tab Container - Disposition-Tracking, NPC Reactions, Skill Challenges
  // Siehe: docs/views/EncounterRunner/SocialTab.md
  //
  // ============================================================================
  // HACK & TODO
  // ============================================================================
  //
  // [HACK]: Vereinfachte State-Struktur
  // - SocialState komplett lokal definiert statt aus types importiert
  // - Keine echte Integration mit Workflow
  //
  // [TODO]: Implementiere Skill Challenge Flow
  // - Spec: SocialTab.md#skill-challenges
  // - Success/Failure Tracking mit Threshold
  //
  // [TODO]: Implementiere Disposition-Modifikatoren
  // - Spec: SocialTab.md#disposition
  // - Automatische Anpassung basierend auf Checks
  //
  // ============================================================================

  import { DispositionMeter, SkillChallengeTracker, NPCPanel, DialogLog } from '../components';

  // ============================================================================
  // TYPES (lokal bis types.ts existiert)
  // ============================================================================

  interface SocialNPC {
    id: string;
    name: string;
    personality: string;
    goal: string;
    quirk?: string;
    disposition: number;
  }

  interface SkillChallenge {
    name: string;
    successesRequired: number;
    failuresAllowed: number;
    currentSuccesses: number;
    currentFailures: number;
  }

  interface DialogEntry {
    speaker: 'npc' | 'player';
    speakerName: string;
    text: string;
    timestamp?: string;
    skillCheck?: { skill: string; result: 'success' | 'failure' };
  }

  interface SocialState {
    npcs: SocialNPC[];
    leadNPC: SocialNPC | null;
    disposition: number;
    skillChallenge: SkillChallenge | null;
    dialogLog: DialogEntry[];
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    social: SocialState;
    onSkillCheck: (skill: string) => void;
    onDispositionChange: (delta: number) => void;
    onEndEncounter: (outcome: 'success' | 'failure' | 'neutral') => void;
  }

  let {
    social,
    onSkillCheck,
    onDispositionChange,
    onEndEncounter,
  }: Props = $props();

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  let selectedNpcId = $state<string | null>(null);
  let pendingSkillCheck = $state<{ skill: string; dc: number } | null>(null);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  let selectedNpc = $derived(
    social.npcs.find(n => n.id === selectedNpcId) ?? social.leadNPC
  );

  let dispositionLabel = $derived(getDispositionLabel(social.disposition));

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

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function handleNpcSelect(id: string): void {
    selectedNpcId = id;
  }

  function handleSkillSelect(skill: string): void {
    onSkillCheck(skill);
  }

  function handleChallengeSuccess(): void {
    // TODO: Increment success counter via workflow
    console.log('Skill challenge success');
  }

  function handleChallengeFailure(): void {
    // TODO: Increment failure counter via workflow
    console.log('Skill challenge failure');
  }

  function handleEndSuccess(): void {
    onEndEncounter('success');
  }

  function handleEndFailure(): void {
    onEndEncounter('failure');
  }

  function handleEndNeutral(): void {
    onEndEncounter('neutral');
  }
</script>

<div class="social-tab">
  <!-- Main Content -->
  <div class="main-section">
    <!-- NPC Panel -->
    {#if selectedNpc}
      <NPCPanel npc={selectedNpc} isLead={selectedNpc.id === social.leadNPC?.id} />
    {/if}

    <!-- Disposition Meter -->
    <div class="disposition-section">
      <h4>Disposition: {dispositionLabel}</h4>
      <DispositionMeter value={social.disposition} />
    </div>

    <!-- Skill Challenge (if active) -->
    {#if social.skillChallenge}
      <SkillChallengeTracker
        challenge={social.skillChallenge}
        onSuccess={handleChallengeSuccess}
        onFailure={handleChallengeFailure}
      />
    {/if}

    <!-- Skill Buttons -->
    <div class="skill-buttons">
      <h4>Skills</h4>
      <div class="skill-grid">
        <button class="skill-btn" onclick={() => handleSkillSelect('Persuasion')}>Persuasion</button>
        <button class="skill-btn" onclick={() => handleSkillSelect('Deception')}>Deception</button>
        <button class="skill-btn" onclick={() => handleSkillSelect('Intimidation')}>Intimidation</button>
        <button class="skill-btn" onclick={() => handleSkillSelect('Insight')}>Insight</button>
      </div>
    </div>
  </div>

  <!-- Side Panel -->
  <div class="side-panel">
    <!-- NPC List -->
    <div class="npc-list">
      <h4>NPCs</h4>
      {#each social.npcs as npc}
        <button
          class="npc-item"
          class:selected={npc.id === selectedNpcId}
          class:lead={npc.id === social.leadNPC?.id}
          onclick={() => handleNpcSelect(npc.id)}
        >
          {npc.name}
          {#if npc.id === social.leadNPC?.id}
            <span class="lead-badge">Lead</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Dialog Log -->
    <DialogLog entries={social.dialogLog} />

    <!-- Controls -->
    <div class="social-controls">
      <button class="btn btn-success" onclick={handleEndSuccess}>Success</button>
      <button class="btn btn-secondary" onclick={handleEndNeutral}>Neutral</button>
      <button class="btn btn-danger" onclick={handleEndFailure}>Failure</button>
    </div>
  </div>
</div>

<style>
  .social-tab {
    display: flex;
    gap: 16px;
    padding: 16px;
    height: 100%;
    font-family: system-ui, sans-serif;
    color: var(--text-normal, #e0e0e0);
    background: var(--background-primary, #1a1a2e);
  }

  .main-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .side-panel {
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .disposition-section h4,
  .skill-buttons h4,
  .npc-list h4 {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .skill-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .skill-btn {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
  }

  .skill-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .npc-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .npc-item {
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

  .npc-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .npc-item.selected {
    background: rgba(74, 144, 217, 0.2);
    border-color: rgba(74, 144, 217, 0.4);
  }

  .npc-item.lead {
    border-left: 3px solid var(--interactive-accent, #10b981);
  }

  .lead-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--interactive-accent, #10b981);
    border-radius: 3px;
    color: white;
  }

  .social-controls {
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
    color: white;
  }

  .btn:hover {
    filter: brightness(1.1);
  }

  .btn-success {
    background: #10b981;
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
