package features.world.dungeonmap.model.structures.traversal;

final class TraversalRoutingEngine {

    private TraversalRoutingEngine() {
        throw new AssertionError("No instances");
    }

    static TraversalRoute route(Traversal traversal, TraversalRoutingSnapshot snapshot) {
        if (traversal == null || snapshot == null) {
            return TraversalRoute.empty();
        }
        return features.world.dungeonmap.model.structures.traversal.routing.TraversalRoutingKernel.route(traversal, snapshot);
    }
}
