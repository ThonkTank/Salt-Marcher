package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonTransitionPatchCommandsTest {

    @Test
    void transitionCreateDescriptionAndDeleteUseExactPatches() {
        DungeonMap empty = transitionMap(101L);
        TransitionAnchor anchor = TransitionAnchor.cell(new Cell(-1, -2, 0));
        TransitionDestination destination = TransitionDestination.overworldTile(500L, 9L);

        DungeonCommandResult.Accepted createdResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new CreateTransitionCommand().plan(empty, 11L, anchor, destination));
        assertEquals(
                DungeonPatchEntityRef.transition(11L),
                createdResult.patch().resultFacts().affectedEntities().getFirst());
        assertEquals(Set.of(new DungeonChunkKey(101L, 0, -1, -1)), createdResult.patch().touchedChunks());
        DungeonMap created = createdResult.patch().applyTo(empty);
        Transition initial = created.transitionCatalog().transition(11L);
        assertEquals(destination, initial.destination());
        assertNull(createdResult.inverse().applyTo(created).transitionCatalog().transition(11L));

        DungeonCommandResult.Accepted describedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new TransitionDescriptionCommand().plan(created, 11L, "  Alter Durchgang  "));
        DungeonMap described = describedResult.patch().applyTo(created);
        assertEquals("Alter Durchgang", described.transitionCatalog().transition(11L).description());
        assertEquals(initial, describedResult.inverse().applyTo(described).transitionCatalog().transition(11L));

        DungeonCommandResult.Accepted deletedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                new DeleteTransitionCommand().plan(described, 11L));
        DungeonMap deleted = deletedResult.patch().applyTo(described);
        assertNull(deleted.transitionCatalog().transition(11L));
        assertEquals(
                described.transitionCatalog().transition(11L),
                deletedResult.inverse().applyTo(deleted).transitionCatalog().transition(11L));
        assertThrows(IllegalArgumentException.class, () -> deletedResult.patch().applyTo(deleted));
    }

    @Test
    void invalidCreateNoEffectAndReferencedDeleteRejectWithoutMutation() {
        Transition target = transition(
                12L,
                101L,
                new Cell(2, 2, 0),
                TransitionDestination.overworldTile(500L, 9L),
                null);
        Transition source = transition(
                11L,
                101L,
                new Cell(1, 1, 0),
                TransitionDestination.dungeonMap(101L, 12L),
                null);
        DungeonMap current = transitionMap(101L, source, target);

        DungeonCommandResult.Rejected invalidCreate = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new CreateTransitionCommand().plan(
                        current,
                        13L,
                        TransitionAnchor.none(),
                        TransitionDestination.unlinkedEntrance()));
        DungeonCommandResult.Rejected noEffect = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new TransitionDescriptionCommand().plan(current, 11L, source.description()));
        DungeonCommandResult.Rejected protectedDelete = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                new DeleteTransitionCommand().plan(current, 12L));

        assertEquals(
                DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION,
                invalidCreate.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, noEffect.reason());
        assertEquals(
                DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION,
                protectedDelete.reason());
        assertEquals(List.of(source, target), current.transitionCatalog().transitions());
    }

    @Test
    void crossMapLinkLoadsClosureAndAppliesOneExactCompoundPatch() {
        DungeonMap sourceMap = transitionMap(101L, transition(
                11L,
                101L,
                new Cell(1, 1, 0),
                TransitionDestination.dungeonMap(103L, 31L),
                null));
        DungeonMap targetMap = transitionMap(102L, transition(
                21L,
                102L,
                new Cell(2, 2, 0),
                TransitionDestination.unlinkedEntrance(),
                null));
        DungeonMap previousMap = transitionMap(103L, transition(
                31L,
                103L,
                new Cell(3, 3, 0),
                TransitionDestination.unlinkedEntrance(),
                11L));
        TransitionLinkCommand command = new TransitionLinkCommand();

        DungeonCompoundCommandResult.RequiresMap requiresMap = assertInstanceOf(
                DungeonCompoundCommandResult.RequiresMap.class,
                command.plan(
                        List.of(sourceMap, targetMap),
                        101L,
                        11L,
                        102L,
                        21L,
                        true,
                        Set.of()));
        assertEquals(103L, requiresMap.mapId());

        DungeonCompoundCommandResult.Accepted accepted = assertInstanceOf(
                DungeonCompoundCommandResult.Accepted.class,
                command.plan(
                        List.of(sourceMap, targetMap, previousMap),
                        101L,
                        11L,
                        102L,
                        21L,
                        true,
                        Set.of()));
        DungeonCompoundPatch patch = accepted.patch();
        assertEquals(Set.of(
                new DungeonMapIdentity(101L),
                new DungeonMapIdentity(102L),
                new DungeonMapIdentity(103L)), patch.resultFactsByMap().keySet());
        Map<Long, DungeonMap> changed = patch.applyTo(Map.of(
                101L, sourceMap,
                102L, targetMap,
                103L, previousMap));
        assertEquals(
                TransitionDestination.dungeonMap(102L, 21L),
                changed.get(101L).transitionCatalog().transition(11L).destination());
        assertEquals(11L, changed.get(102L).transitionCatalog().transition(21L).linkedTransitionId());
        assertNull(changed.get(103L).transitionCatalog().transition(31L).linkedTransitionId());
        assertEquals(sourceMap.revision() + 1L, changed.get(101L).revision());
        assertEquals(targetMap.revision() + 1L, changed.get(102L).revision());
        assertEquals(previousMap.revision() + 1L, changed.get(103L).revision());

        Map<Long, DungeonMap> restored = accepted.inverse().applyTo(changed);
        assertEquals(sourceMap.transitionCatalog(), restored.get(101L).transitionCatalog());
        assertEquals(targetMap.transitionCatalog(), restored.get(102L).transitionCatalog());
        assertEquals(previousMap.transitionCatalog(), restored.get(103L).transitionCatalog());
    }

    private static DungeonMap transitionMap(long mapId, Transition... transitions) {
        DungeonMap empty = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), "Transitions " + mapId);
        return empty.withTransitionCatalog(new TransitionCatalog(List.of(transitions)));
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
}
