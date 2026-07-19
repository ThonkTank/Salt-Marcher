package platform.ui.mapcanvas;

/** One executed physical-layer paint, emitted after the paint completes. */
public record MapCanvasPaintSample(
        MapCanvasLayer layer,
        long operationId,
        long durationNanos,
        long visitedPrimitives,
        long paintedPrimitives
) {
    public MapCanvasPaintSample {
        layer = layer == null ? MapCanvasLayer.BASE : layer;
        operationId = Math.max(0L, operationId);
        durationNanos = Math.max(0L, durationNanos);
        visitedPrimitives = Math.max(0L, visitedPrimitives);
        paintedPrimitives = Math.max(0L, paintedPrimitives);
        if (paintedPrimitives > visitedPrimitives) {
            throw new IllegalArgumentException("painted primitives cannot exceed visited primitives");
        }
    }
}
