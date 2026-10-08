/** Loads image URLs only for tiles near the visible part of a gallery. */
export class LazyObjectImages {
  private observer?: IntersectionObserver;

  constructor(root: HTMLElement, rootMargin: string,
    private assetUrl: (id: string) => string) {
    if (typeof IntersectionObserver === "function")
      this.observer = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const image = entry.target as HTMLImageElement;
          image.src = this.assetUrl(image.dataset.assetId!);
          observer.unobserve(image);
        }
      }, { root, rootMargin });
  }

  observe(image: HTMLImageElement, assetId: string): void {
    image.dataset.assetId = assetId;
    if (this.observer) this.observer.observe(image);
    else image.src = this.assetUrl(assetId);
  }

  disconnect(): void {
    this.observer?.disconnect();
  }
}
