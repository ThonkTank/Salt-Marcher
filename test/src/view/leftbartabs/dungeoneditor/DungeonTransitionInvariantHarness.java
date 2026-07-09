package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.core.structure.transition.TransitionDestinationTarget;

final class DungeonTransitionInvariantHarness {

    private static final String OWNER = "TransitionInvariantHarness";

    private DungeonTransitionInvariantHarness() {
    }

    static void run(List<String> results) {
        assertTransitionLocalFacts();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-001",
                "Transition owner normalizes local facts, placement, labels, descriptions, and destinations");
        assertTransitionLinkCollection();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-002",
                "Transition catalog owns one-way and bidirectional link replacement plus reverse-link cleanup");
        assertProtectedDeletePolicy();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-TRANSITION-004",
                "Transition catalog rejects linked, reverse-linked, and destination-referenced deletes");
    }

    private static void assertTransitionLocalFacts() {
        TransitionDestination dungeonDestination = TransitionDestination.dungeonMap(12L, 20L);
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition invalid = new Transition(-1L, -4L, null, null, null, -2L);
        Transition transition = new Transition(
                1L,
                4L,
                " source ",
                TransitionAnchor.cell(new Cell(0, 0, 0)),
                dungeonDestination,
                null);
        Transition linkedTransition =
                new Transition(
                        2L,
                        4L,
                        "",
                        TransitionAnchor.cell(new Cell(1, 0, 0)),
                        overworldDestination,
                        7L);

        assertEquals(0L, invalid.transitionId(), "transition owner normalizes invalid id");
        assertEquals(0L, invalid.mapId(), "transition owner normalizes invalid map id");
        assertEquals("", invalid.description(), "transition owner normalizes null description");
        assertFalse(invalid.isPlaced(), "transition owner reports missing anchor as unplaced");
        assertFalse(invalid.hasLinkedTransition(), "transition owner rejects invalid linked transition id");
        assertEquals(TransitionDestination.unlinkedEntrance(), invalid.destination(),
                "transition owner normalizes null destination to unlinked entrance");
        assertTrue(invalid.destination().isValid(),
                "transition owner treats unlinked entrance as valid authoring placeholder");
        assertEquals("Dungeon-Eingang (unverbunden)", invalid.destination().label(),
                "transition destination label explains unlinked entrance");
        assertEquals(7L, linkedTransition.linkedTransitionId(),
                "transition owner preserves valid local linked transition id");
        assertTrue(dungeonDestination.isValid(), "transition destination validates dungeon map id");
        assertEquals("Dungeon 12 / Übergang 20", dungeonDestination.label(),
                "transition destination label includes linked target transition");
        assertEquals(TransitionDestinationTarget.absent(), TransitionDestinationTarget.fromPositiveId(0L),
                "transition target owner translates legacy zero storage ids to named absence");
        assertEquals(TransitionDestinationTarget.present(20L), dungeonDestination.transitionTarget(),
                "transition destination preserves present target transition as a named value");
        assertTrue(overworldDestination.isValid(), "transition destination validates overworld tile");
        assertEquals("Overworld-Feld 9", overworldDestination.label(),
                "transition destination label uses tile id");
        assertEquals(1L, transition.transitionId(), "transition owner preserves valid id");
        assertEquals(4L, transition.mapId(), "transition owner preserves valid map id");
        assertEquals(TransitionAnchor.cell(new Cell(0, 0, 0)), transition.anchor(),
                "transition owner preserves cell anchor value");
        assertEquals(new Cell(0, 0, 0), transition.anchorCell(),
                "transition owner exposes derived display cell without storing a second anchor fact");
        assertEquals("source", transition.description(), "transition owner trims description");
        assertEquals("Übergang 1", transition.label(), "transition owner derives stable label from id");
        assertTrue(transition.isPlaced(), "transition owner reports placed anchor");
        assertIllegalTransitionAnchor(
                () -> TransitionAnchor.cell(null),
                "transition anchor rejects null cell for CELL anchor");
        assertIllegalTransitionAnchor(
                () -> TransitionAnchor.edge(new Cell(2, 2, 0), null),
                "transition anchor rejects null direction for EDGE anchor");
        assertEquals(TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST),
                TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST),
                "transition anchor preserves edge coordinate and direction");
        TransitionAnchor edgeAnchor = TransitionAnchor.edge(new Cell(2, 2, 0), Direction.EAST);
        assertEquals(TransitionAnchor.Kind.EDGE, edgeAnchor.kind(),
                "transition anchor preserves EDGE kind");
        assertEquals(Direction.EAST, edgeAnchor.edgeDirection(),
                "transition anchor preserves edge direction");
        assertTrue(edgeAnchor.isPlaced(),
                "transition anchor reports edge anchors as placed");
        assertEquals(new Cell(2, 2, 0), edgeAnchor.displayCell(),
                "transition anchor exposes edge display cell as derived current projection input");
        assertEquals(new Cell(2, 2, 0), edgeAnchor.travelCell(),
                "transition anchor exposes edge travel cell as derived current projection input");
        assertEquals("updated", transition.withDescription(" updated ").description(),
                "transition owner replaces description through value operation");
        assertEquals(overworldDestination, transition.withDestination(overworldDestination).destination(),
                "transition owner replaces destination through value operation");
    }

    private static void assertIllegalTransitionAnchor(
            Runnable action,
            String message
    ) {
        try {
            action.run();
            throw new AssertionError(message);
        } catch (IllegalArgumentException expected) {
            // Expected by the invariant under test.
        }
    }

    private static void assertTransitionLinkCollection() {
        TransitionDestination dungeonDestination = TransitionDestination.dungeonMap(12L, 20L);
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition source = transition(1L, 4L, new Cell(0, 0, 0), dungeonDestination, null);
        Transition oldTarget = transition(2L, 4L, new Cell(1, 0, 0), overworldDestination, 1L);
        Transition target = transition(3L, 4L, new Cell(1, 1, 0), overworldDestination, null);
        Transition sameIdDifferentMap = transition(1L, 5L, new Cell(2, 0, 0), overworldDestination, null);
        java.util.ArrayList<Transition> transitions =
                new java.util.ArrayList<>(List.of(source, oldTarget, target, sameIdDifferentMap));
        transitions.add(null);
        TransitionCatalog catalog = new TransitionCatalog(transitions);
        assertEquals(4, catalog.transitions().size(), "transition catalog filters null transition entries");

        TransitionCatalog oneWayCatalog = catalog.withMapLocalAuthoredTransitionLink(
                link(4L, 1L, 4L, 3L, TransitionLinkDirectionality.ONE_WAY));
        assertEquals(TransitionDestination.dungeonMap(4L, 3L), oneWayCatalog.transitions().getFirst().destination(),
                "transition catalog updates one-way source destination");
        assertEquals(null, oneWayCatalog.transitions().get(1).linkedTransitionId(),
                "transition catalog clears stale reverse link");
        assertEquals(null, oneWayCatalog.transitions().get(2).linkedTransitionId(),
                "transition catalog does not create reverse link for one-way link");

        TransitionCatalog bidirectionalCatalog = catalog.withMapLocalAuthoredTransitionLink(
                link(4L, 1L, 4L, 3L, TransitionLinkDirectionality.BIDIRECTIONAL));
        assertEquals(TransitionDestination.dungeonMap(4L, 3L), bidirectionalCatalog.transitions().getFirst().destination(),
                "transition catalog updates bidirectional source destination");
        assertEquals(null, bidirectionalCatalog.transitions().get(1).linkedTransitionId(),
                "transition catalog clears stale reverse link for bidirectional link");
        assertEquals(1L, bidirectionalCatalog.transitions().get(2).linkedTransitionId(),
                "transition catalog creates bidirectional reverse link");
        assertEquals(sameIdDifferentMap, bidirectionalCatalog.transitions().get(3),
                "transition catalog does not update same transition id on a different map");
        assertEquals(catalog, catalog.withMapLocalAuthoredTransitionLink(
                link(0L, 1L, 4L, 3L, TransitionLinkDirectionality.BIDIRECTIONAL)),
                "transition catalog rejects invalid authored link");
    }

    private static void assertProtectedDeletePolicy() {
        TransitionDestination overworldDestination = TransitionDestination.overworldTile(5L, 9L);
        Transition linked = transition(1L, 4L, new Cell(0, 0, 0), overworldDestination, 3L);
        Transition destinationReferenced = transition(2L, 4L, new Cell(1, 0, 0), overworldDestination, null);
        Transition reverseLinked = new Transition(
                3L,
                4L,
                "",
                TransitionAnchor.cell(new Cell(1, 1, 0)),
                TransitionDestination.dungeonMap(4L, 2L),
                null);
        Transition deletable = transition(4L, 4L, new Cell(2, 0, 0), overworldDestination, null);
        TransitionCatalog catalog = new TransitionCatalog(List.of(linked, destinationReferenced, reverseLinked, deletable));

        assertFalse(catalog.canDelete(1L), "transition catalog rejects linked transition delete");
        assertFalse(catalog.canDelete(2L), "transition catalog rejects destination-referenced transition delete");
        assertFalse(catalog.canDelete(3L), "transition catalog rejects reverse-linked transition delete");
        assertTrue(catalog.canDelete(4L), "transition catalog allows unreferenced transition delete");
        assertEquals(List.of(1L, 2L, 3L), transitionIds(catalog.withoutTransition(4L)),
                "transition catalog removes deletable transition");
        assertEquals(List.of(1L, 2L, 3L, 4L), transitionIds(catalog.withoutTransition(2L)),
                "transition catalog preserves protected transition");
    }

    private static Transition transition(
            long transitionId,
            long mapId,
            Cell anchor,
            TransitionDestination destination,
            Long linkedTransitionId
    ) {
        return new Transition(
                transitionId,
                mapId,
                "",
                TransitionAnchor.cell(anchor),
                destination,
                linkedTransitionId);
    }

    private static AuthoredTransitionLink link(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            TransitionLinkDirectionality directionality
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                directionality);
    }

    private static List<Long> transitionIds(TransitionCatalog catalog) {
        java.util.ArrayList<Long> result = new java.util.ArrayList<>();
        for (Transition transition : catalog.transitions()) {
            result.add(transition.transitionId());
        }
        return List.copyOf(result);
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

    private static void assertFalse(boolean value, String message) {
        if (value) {
            throw new IllegalStateException(message);
        }
    }
}
