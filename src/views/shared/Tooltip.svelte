<script lang="ts">
  // Ziel: View-uebergreifendes Popup-System fuer kontextuelle Hilfe
  // Siehe: docs/views/Tooltip.md
  //
  // ============================================================================
  // TODO
  // ============================================================================
  //
  // [TODO]: Implementiere Viewport-Collision Detection
  // - Spec: Tooltip.md#positionierung
  // - Fallback bei Viewport-Ueberschreitung
  //
  // [TODO]: Implementiere Rich Content (HTML/Markdown)
  // - Spec: Tooltip.md#erweiterungen
  //
  // [TODO]: Implementiere Pinnable Tooltips
  // - Spec: Tooltip.md#erweiterungen
  //
  // ============================================================================

  import type { Snippet } from 'svelte';
  import type { TooltipProps } from './types';

  // Props
  let {
    content,
    position = 'top',
    delay = 300,
    children,
  }: TooltipProps & { children: Snippet } = $props();

  // State
  let visible = $state(false);
  let tooltipEl: HTMLDivElement | undefined = $state();
  let triggerEl: HTMLDivElement | undefined = $state();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Computed content (supports lazy evaluation)
  let tooltipContent = $derived(
    typeof content === 'function' ? content() : content
  );

  // Position styles
  let tooltipStyle = $derived(computeTooltipStyle());

  function computeTooltipStyle(): string {
    // Base positioning - actual viewport collision handled in TODO
    switch (position) {
      case 'top':
        return 'bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-8px);';
      case 'bottom':
        return 'top: 100%; left: 50%; transform: translateX(-50%) translateY(8px);';
      case 'left':
        return 'right: 100%; top: 50%; transform: translateY(-50%) translateX(-8px);';
      case 'right':
        return 'left: 100%; top: 50%; transform: translateY(-50%) translateX(8px);';
      default:
        return 'bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-8px);';
    }
  }

  function showTooltip(): void {
    timeoutId = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hideTooltip(): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    visible = false;
  }
</script>

<div
  class="tooltip-trigger"
  bind:this={triggerEl}
  onmouseenter={showTooltip}
  onmouseleave={hideTooltip}
  onfocus={showTooltip}
  onblur={hideTooltip}
>
  {@render children()}

  {#if visible && tooltipContent}
    <div
      class="tooltip"
      bind:this={tooltipEl}
      style={tooltipStyle}
      role="tooltip"
    >
      {tooltipContent}
    </div>
  {/if}
</div>

<style>
  .tooltip-trigger {
    position: relative;
    display: inline-block;
  }

  .tooltip {
    position: absolute;
    background: var(--background-primary, #1a1a2e);
    border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
    padding: 6px 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 200;
    font-size: 11px;
    max-width: 280px;
    pointer-events: none;
    white-space: pre-wrap;
    color: var(--text-normal, #e0e0e0);
  }
</style>
