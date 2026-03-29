package features.world.dungeonmap.model.structures.traversal.planning.internal;

final class LocalTraversalRoutePlanner {

    private LocalTraversalRoutePlanner() {
        throw new AssertionError("No instances");
    }

    static LocalSegmentResult route(LocalSegmentRequest request) {
        PlannerContext context = new PlannerContext(request);
        if (!context.isRoutable()) {
            return LocalSegmentResult.unroutable();
        }
        CostField.ExtractedPath extractedPath = CostField.route(context);
        if (extractedPath.isEmpty()) {
            return LocalSegmentResult.unroutable();
        }
        return new LocalSegmentResult(
                extractedPath.cells(),
                extractedPath.cells().getFirst(),
                extractedPath.cells().getLast());
    }
}
