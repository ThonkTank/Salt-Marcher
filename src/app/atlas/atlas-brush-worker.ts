import { renderBrushPreview, type BrushPreviewJob } from './atlas-brush-preview';

// Browser entry: pure previews are owned by atlas-brush-preview.
if (typeof self !== 'undefined' && typeof document === 'undefined')
  self.onmessage = (event: MessageEvent<BrushPreviewJob>) => {
    try {
      let heightM: number | undefined, protectedLimit: number | undefined;
      const pixels = renderBrushPreview(
        event.data,
        (value) => {
          heightM = value;
        },
        (factor) => {
          protectedLimit = factor;
        },
      );
      self.postMessage(
        { generation: event.data.generation, pixels, heightM, protectedLimit },
        { transfer: [pixels.buffer] },
      );
    } catch (error) {
      self.postMessage({
        generation: event.data.generation,
        error: (error as Error).message,
      });
    }
  };
