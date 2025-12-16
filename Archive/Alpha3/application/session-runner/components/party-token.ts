/**
 * Party Token Component
 *
 * SVG token representing the party's position on the map.
 * Supports smooth positioning and animated pulsing during travel.
 */

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const TOKEN_RADIUS = 15;
const TOKEN_COLOR = '#3b82f6'; // Blue
const TOKEN_STROKE = '#1d4ed8'; // Darker blue
const TOKEN_STROKE_WIDTH = 2;
const TOKEN_INNER_RADIUS = 5;
const TOKEN_INNER_COLOR = '#ffffff';

// Animation timing
const PULSE_DURATION = 1000; // ms

// ═══════════════════════════════════════════════════════════════
// Party Token
// ═══════════════════════════════════════════════════════════════

export class PartyToken {
  private readonly parent: SVGGElement;
  private readonly group: SVGGElement;
  private readonly outerCircle: SVGCircleElement;
  private readonly innerCircle: SVGCircleElement;
  private readonly pulseCircle: SVGCircleElement;

  private isAnimating = false;
  private animationId: number | null = null;

  // Position tracking for hit detection
  private currentX = 0;
  private currentY = 0;

  // Drag ghost
  private ghostElement: SVGGElement | null = null;

  constructor(parent: SVGGElement, _hexSize: number) {
    this.parent = parent;

    // Create group for token
    this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.group.classList.add('party-token');

    // Pulse effect circle (behind main token)
    this.pulseCircle = this.createCircle(0, 0, TOKEN_RADIUS, {
      fill: 'transparent',
      stroke: TOKEN_COLOR,
      strokeWidth: 2,
      opacity: 0,
    });
    this.pulseCircle.classList.add('party-token-pulse');

    // Main outer circle
    this.outerCircle = this.createCircle(0, 0, TOKEN_RADIUS, {
      fill: TOKEN_COLOR,
      stroke: TOKEN_STROKE,
      strokeWidth: TOKEN_STROKE_WIDTH,
    });
    this.outerCircle.classList.add('party-token-outer');

    // Inner dot
    this.innerCircle = this.createCircle(0, 0, TOKEN_INNER_RADIUS, {
      fill: TOKEN_INNER_COLOR,
      stroke: 'none',
      strokeWidth: 0,
    });
    this.innerCircle.classList.add('party-token-inner');

    // Append to group
    this.group.appendChild(this.pulseCircle);
    this.group.appendChild(this.outerCircle);
    this.group.appendChild(this.innerCircle);

    // Append to parent
    this.parent.appendChild(this.group);

    // Initially hidden until position is set
    this.group.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────
  // Position
  // ─────────────────────────────────────────────────────────────

  /**
   * Set token position (pixel coordinates)
   */
  setPosition(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
    this.group.setAttribute('transform', `translate(${x}, ${y})`);
    this.group.style.display = '';
  }

  /**
   * Get current position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  /**
   * Check if point is within token bounds (for click detection)
   */
  containsPoint(worldX: number, worldY: number): boolean {
    const dx = worldX - this.currentX;
    const dy = worldY - this.currentY;
    return Math.sqrt(dx * dx + dy * dy) <= TOKEN_RADIUS;
  }

  /**
   * Hide the token
   */
  hide(): void {
    this.group.style.display = 'none';
  }

  /**
   * Show the token
   */
  show(): void {
    this.group.style.display = '';
  }

  // ─────────────────────────────────────────────────────────────
  // Drag Ghost
  // ─────────────────────────────────────────────────────────────

  /**
   * Show ghost token at pixel position during drag
   */
  showDragGhost(worldX: number, worldY: number): void {
    this.hideGhost();

    // Hide original token
    this.group.setAttribute('opacity', '0');

    // Create ghost at cursor position
    this.ghostElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.ghostElement.setAttribute('transform', `translate(${worldX}, ${worldY})`);
    this.ghostElement.setAttribute('opacity', '0.7');
    this.ghostElement.classList.add('party-token-ghost');

    // Clone visual elements
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('r', TOKEN_RADIUS.toString());
    outerCircle.setAttribute('fill', TOKEN_COLOR);
    outerCircle.setAttribute('stroke', TOKEN_STROKE);
    outerCircle.setAttribute('stroke-width', TOKEN_STROKE_WIDTH.toString());

    const innerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerDot.setAttribute('r', TOKEN_INNER_RADIUS.toString());
    innerDot.setAttribute('fill', TOKEN_INNER_COLOR);

    this.ghostElement.appendChild(outerCircle);
    this.ghostElement.appendChild(innerDot);
    this.parent.appendChild(this.ghostElement);
  }

  /**
   * Hide ghost and restore original token
   */
  hideGhost(): void {
    if (this.ghostElement) {
      this.ghostElement.remove();
      this.ghostElement = null;
    }
    this.group.setAttribute('opacity', '1');
  }

  // ─────────────────────────────────────────────────────────────
  // Animation
  // ─────────────────────────────────────────────────────────────

  /**
   * Set animating state (pulsing effect during travel)
   */
  setAnimating(animating: boolean): void {
    if (animating === this.isAnimating) return;

    this.isAnimating = animating;

    if (animating) {
      this.startPulseAnimation();
    } else {
      this.stopPulseAnimation();
    }
  }

  private startPulseAnimation(): void {
    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!this.isAnimating) return;

      if (startTime === null) {
        startTime = currentTime;
      }

      const elapsed = currentTime - startTime;
      const progress = (elapsed % PULSE_DURATION) / PULSE_DURATION;

      // Pulse out effect
      const scale = 1 + progress * 0.5;
      const opacity = 1 - progress;

      this.pulseCircle.setAttribute('r', (TOKEN_RADIUS * scale).toString());
      this.pulseCircle.setAttribute('opacity', opacity.toString());

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  private stopPulseAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Reset pulse
    this.pulseCircle.setAttribute('r', TOKEN_RADIUS.toString());
    this.pulseCircle.setAttribute('opacity', '0');
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  private createCircle(
    cx: number,
    cy: number,
    r: number,
    style: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity?: number;
    }
  ): SVGCircleElement {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx.toString());
    circle.setAttribute('cy', cy.toString());
    circle.setAttribute('r', r.toString());
    circle.setAttribute('fill', style.fill);
    circle.setAttribute('stroke', style.stroke);
    circle.setAttribute('stroke-width', style.strokeWidth.toString());
    if (style.opacity !== undefined) {
      circle.setAttribute('opacity', style.opacity.toString());
    }
    return circle;
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  dispose(): void {
    this.stopPulseAnimation();
    this.hideGhost();
    this.group.remove();
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

export function createPartyToken(parent: SVGGElement, hexSize: number): PartyToken {
  return new PartyToken(parent, hexSize);
}
