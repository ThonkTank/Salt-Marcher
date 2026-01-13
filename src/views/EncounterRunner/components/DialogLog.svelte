<script lang="ts">
  // Ziel: Chat-artiger Gespraechsverlauf fuer Social Encounters
  // Siehe: docs/views/EncounterRunner/SocialTab.md
  //
  // ============================================================================
  // TYPES
  // ============================================================================

  interface DialogEntry {
    speaker: 'npc' | 'player';
    speakerName: string;
    text: string;
    timestamp?: string;
    skillCheck?: {
      skill: string;
      result: 'success' | 'failure';
    };
  }

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    entries: DialogEntry[];
  }

  let { entries }: Props = $props();
</script>

<div class="dialog-log">
  <h4>Dialog</h4>

  {#if entries.length === 0}
    <div class="empty">No dialog yet</div>
  {:else}
    <div class="entries">
      {#each entries as entry}
        <div class="entry {entry.speaker}">
          <div class="entry-header">
            <span class="speaker-name">{entry.speakerName}</span>
            {#if entry.timestamp}
              <span class="timestamp">{entry.timestamp}</span>
            {/if}
          </div>

          <div class="entry-text">{entry.text}</div>

          {#if entry.skillCheck}
            <div class="skill-check {entry.skillCheck.result}">
              {entry.skillCheck.skill}:
              {entry.skillCheck.result === 'success' ? 'Success' : 'Failure'}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dialog-log {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    padding: 8px;
    overflow: hidden;
  }

  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-muted, #a0a0a0);
  }

  .empty {
    color: var(--text-muted, #a0a0a0);
    font-size: 12px;
    font-style: italic;
    text-align: center;
    padding: 16px;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entry {
    padding: 8px;
    border-radius: 8px;
    max-width: 85%;
  }

  .entry.npc {
    background: rgba(217, 74, 74, 0.1);
    border: 1px solid rgba(217, 74, 74, 0.2);
    align-self: flex-start;
  }

  .entry.player {
    background: rgba(74, 144, 217, 0.1);
    border: 1px solid rgba(74, 144, 217, 0.2);
    align-self: flex-end;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .speaker-name {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .entry.npc .speaker-name {
    color: #D94A4A;
  }

  .entry.player .speaker-name {
    color: #4A90D9;
  }

  .timestamp {
    font-size: 10px;
    color: var(--text-muted, #a0a0a0);
  }

  .entry-text {
    font-size: 13px;
    line-height: 1.4;
  }

  .skill-check {
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .skill-check.success {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .skill-check.failure {
    background: rgba(217, 74, 74, 0.2);
    color: #D94A4A;
  }
</style>
