package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelTransitionTarget;
import src.domain.dungeon.model.worldspace.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.worldspace.DungeonBoundaryFacts;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonEdge;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.DungeonTopology;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

final class DungeonRuntimeProjectionInvariantHarness {

    private static final String OWNER = "RuntimeProjectionInvariantHarness";

    private DungeonRuntimeProjectionInvariantHarness() {
    }

    static void run(List<String> results) {
        assertRuntimeTraversalProjection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-PATH-005",
                "Runtime travel traversal actions recompute from authored area and boundary facts");
        assertRuntimeTransitionProjection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-005",
                "Runtime travel transition actions recompute from authored transition facts");
    }

    private static void assertRuntimeTraversalProjection() {
        DungeonCell source = new DungeonCell(0, 0, 0);
        DungeonCell target = new DungeonCell(1, 0, 0);
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(3L), "Runtime Paths");
        DungeonDerivedState derived = derivedState(List.of(
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 10L, "Start", List.of(source)),
                        new DungeonAreaFacts(DungeonAreaType.ROOM, 20L, "Ziel", List.of(target))),
                List.of(new DungeonBoundaryFacts(
                        "door",
                        30L,
                        "Tuer",
                        DungeonEdge.sideOf(source, DungeonEdgeDirection.EAST),
                        DungeonTopologyRef.empty())));
        TravelSurfaceFacts surface = project(map, derived, new Cell(0, 0, 0));
        TravelActionFacts traversal = firstActionOfKind(surface, TravelActionKind.TRAVERSAL);

        assertEquals("Start", surface.areaLabel(),
                "runtime path projection resolves active authored area");
        assertTrue(traversal != null, "runtime path projection publishes traversal action");
        assertEquals(new Cell(1, 0, 0), traversal.targetPosition().tile(),
                "runtime path projection recomputes traversal target from authored boundary facts");
        assertEquals(null, traversal.transitionTarget(),
                "runtime path projection keeps traversal state outside transition targets");
    }

    private static void assertRuntimeTransitionProjection() {
        DungeonCell anchor = new DungeonCell(2, 0, 0);
        DungeonMap map = DungeonMapAuthoring
                .empty(new DungeonMapIdentity(4L), "Runtime Transitions")
                .createTransition(40L, anchor, true, 9L, 0L, 12L);
        DungeonDerivedState derived = derivedState(
                List.of(new DungeonAreaFacts(DungeonAreaType.ROOM, 11L, "Portalraum", List.of(anchor))),
                List.of());
        TravelSurfaceFacts surface = project(map, derived, new Cell(2, 0, 0));
        TravelActionFacts transition = firstActionOfKind(surface, TravelActionKind.TRANSITION);

        assertEquals("Portalraum", surface.areaLabel(),
                "runtime transition projection resolves active authored area");
        assertTrue(transition != null, "runtime transition projection publishes transition action");
        assertEquals(new TravelPositionFacts(
                        4L,
                        TravelPositionFacts.LocationKind.TRANSITION,
                        40L,
                        new Cell(2, 0, 0),
                        TravelHeading.SOUTH),
                transition.targetPosition(),
                "runtime transition projection recomputes local transition position from authored facts");
        assertEquals(TravelTransitionTarget.dungeonMap(9L, 12L), transition.transitionTarget(),
                "runtime transition projection recomputes transition target from authored destination facts");
    }

    private static TravelSurfaceFacts project(DungeonMap map, DungeonDerivedState derived, Cell activeTile) {
        TravelAuthoredSurface authoredSurface = TravelAuthoredSurfaceProjectionMapper.from(map, derived);
        return new TravelSurfaceProjection().project(
                authoredSurface,
                new TravelPositionFacts(
                        map.metadata().mapId().value(),
                        TravelPositionFacts.LocationKind.TILE,
                        0L,
                        activeTile,
                        TravelHeading.SOUTH),
                "");
    }

    private static DungeonDerivedState derivedState(
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries
    ) {
        return new DungeonDerivedState(
                new DungeonMapFacts(DungeonTopology.SQUARE, 2, 1, areas, boundaries),
                List.of(),
                null,
                List.of());
    }

    private static TravelActionFacts firstActionOfKind(TravelSurfaceFacts surface, TravelActionKind kind) {
        for (TravelActionFacts action : surface.actions()) {
            if (action.kind() == kind) {
                return action;
            }
        }
        return null;
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }
}
