package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionCatalog;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.qualification.DungeonQualificationDataset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonEditHistoryTest {
    @Test
    void productionRetentionLimitsMatchTheRequirements() {
        assertEquals(200, DungeonEditHistory.MAXIMUM_COMMANDS);
        assertEquals(128L * 1024L * 1024L, DungeonEditHistory.MAXIMUM_ENCODED_BYTES);
    }

    @Test
    void undoAndRedoRemainLocalToOneRunningSessionAndMap() {
        DungeonMap before = transitionMap(1L, 1L, "Before");
        DungeonMapIdentity mapId = before.metadata().mapId();
        Transition initial = before.transitionCatalog().transition(1L);
        DungeonPatch patch = DungeonPatch.of(
                mapId,
                before.revision(),
                List.of(new TransitionChange(initial, initial.withDescription("After"))));
        DungeonMap after = patch.applyTo(before);
        DungeonEditHistory history = new DungeonEditHistory();

        history.recordPatch(patch);

        assertTrue(history.canUndo(mapId));
        DungeonMap undone = applyAndComplete(history, after, true);
        assertEquals(before.transitionCatalog(), undone.transitionCatalog());
        assertEquals(after.revision() + 1L, undone.revision());
        assertFalse(history.canUndo(mapId));
        assertTrue(history.canRedo(mapId));
        DungeonMap redone = applyAndComplete(history, undone, false);
        assertEquals(after.transitionCatalog(), redone.transitionCatalog());
        assertEquals(undone.revision() + 1L, redone.revision());
    }

    @Test
    void newCommitClearsTheRedoBranch() {
        DungeonMap first = transitionMap(1L, 1L, "First");
        DungeonMapIdentity mapId = first.metadata().mapId();
        Transition initial = first.transitionCatalog().transition(1L);
        DungeonPatch firstPatch = DungeonPatch.of(
                mapId,
                first.revision(),
                List.of(new TransitionChange(initial, initial.withDescription("Second"))));
        DungeonMap second = firstPatch.applyTo(first);
        DungeonEditHistory history = new DungeonEditHistory();
        history.recordPatch(firstPatch);
        DungeonMap undone = applyAndComplete(history, second, true);

        DungeonPatch replacementPatch = DungeonPatch.of(
                mapId,
                undone.revision(),
                List.of(new TransitionChange(initial, initial.withDescription("Replacement"))));
        DungeonMap committedReplacement = replacementPatch.applyTo(undone);
        history.recordPatch(replacementPatch);

        assertFalse(history.canRedo(mapId));
        assertEquals(
                first.transitionCatalog(),
                applyAndComplete(history, committedReplacement, true).transitionCatalog());
    }

    @Test
    void compoundHistoryMovesEveryAffectedMapAtomically() {
        DungeonMap source = transitionMap(11L, 1L, "Source");
        DungeonMap target = transitionMap(12L, 2L, "Target");
        Transition sourceBefore = source.transitionCatalog().transition(1L);
        Transition targetBefore = target.transitionCatalog().transition(2L);
        DungeonCompoundPatch compound = DungeonCompoundPatch.of(List.of(
                DungeonPatch.of(
                        source.metadata().mapId(),
                        source.revision(),
                        List.of(new TransitionChange(
                                sourceBefore,
                                sourceBefore.withDestination(TransitionDestination.dungeonMap(12L, 2L))))),
                DungeonPatch.of(
                        target.metadata().mapId(),
                        target.revision(),
                        List.of(new TransitionChange(
                                targetBefore,
                                targetBefore.withLinkedTransitionId(1L))))));
        Map<Long, DungeonMap> changed = compound.applyTo(Map.of(11L, source, 12L, target));
        DungeonEditHistory history = new DungeonEditHistory();
        history.recordCompoundPatch(compound);

        assertTrue(history.canUndo(source.metadata().mapId()));
        assertTrue(history.canUndo(target.metadata().mapId()));
        DungeonEditHistory.Step undo = history.peekUndo(source.metadata().mapId());
        Map<Long, DungeonMap> restored = undo.applyTo(changed);
        history.complete(undo);
        assertEquals(source.transitionCatalog(), restored.get(11L).transitionCatalog());
        assertEquals(target.transitionCatalog(), restored.get(12L).transitionCatalog());
        assertTrue(history.canRedo(source.metadata().mapId()));
        assertTrue(history.canRedo(target.metadata().mapId()));

        DungeonEditHistory.Step redo = history.peekRedo(target.metadata().mapId());
        Map<Long, DungeonMap> redone = redo.applyTo(restored);
        history.complete(redo);
        assertEquals(changed.get(11L).transitionCatalog(), redone.get(11L).transitionCatalog());
        assertEquals(changed.get(12L).transitionCatalog(), redone.get(12L).transitionCatalog());

        DungeonMap currentTarget = redone.get(12L);
        Transition currentTargetTransition = currentTarget.transitionCatalog().transition(2L);
        DungeonPatch laterTargetPatch = DungeonPatch.of(
                currentTarget.metadata().mapId(),
                currentTarget.revision(),
                List.of(new TransitionChange(
                        currentTargetTransition,
                        currentTargetTransition.withDescription("Later target edit"))));
        history.recordPatch(laterTargetPatch);
        assertFalse(history.canUndo(source.metadata().mapId()));
        assertTrue(history.canUndo(target.metadata().mapId()));
    }

    @Test
    void commandLimitEvictsTheOldestCommittedPatch() {
        DungeonMap current = transitionMap(1L, 1L, "Initial");
        DungeonMapIdentity mapId = current.metadata().mapId();
        DungeonEditHistory history = new DungeonEditHistory(2, Long.MAX_VALUE);

        for (String description : List.of("First", "Second", "Third")) {
            DungeonPatch patch = descriptionPatch(current, description);
            current = patch.applyTo(current);
            history.recordPatch(patch);
        }

        current = applyAndComplete(history, current, true);
        assertEquals("Second", current.transitionCatalog().transition(1L).description());
        current = applyAndComplete(history, current, true);
        assertEquals("First", current.transitionCatalog().transition(1L).description());
        assertFalse(history.canUndo(mapId));
    }

    @Test
    void encodedByteLimitUsesTheMediumQualificationPatchPayload() {
        DungeonMap map = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Medium history map");
        Set<Cell> cells = DungeonQualificationDataset.MEDIUM.authoredCells()
                .map(cell -> new Cell(cell.q(), cell.r(), cell.level()))
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        RoomRegion room = new RoomRegion(
                1L,
                map.metadata().mapId().value(),
                1L,
                "Medium room",
                cells,
                DungeonRoomNarration.empty());
        DungeonPatch patch = DungeonPatch.of(
                map.metadata().mapId(),
                map.revision(),
                List.of(new RoomRegionChange(null, room)));
        long encodedHistoryBytes = patch.encodedBytes() + patch.inverse().encodedBytes();

        DungeonEditHistory exactBudget = new DungeonEditHistory(200, encodedHistoryBytes);
        exactBudget.recordPatch(patch);
        assertTrue(exactBudget.canUndo(map.metadata().mapId()));

        DungeonEditHistory undersizedBudget = new DungeonEditHistory(200, encodedHistoryBytes - 1L);
        undersizedBudget.recordPatch(patch);
        assertFalse(undersizedBudget.canUndo(map.metadata().mapId()));
        assertTrue(encodedHistoryBytes >= 32L * DungeonQualificationDataset.MEDIUM.authoredCellCount());
    }

    private static DungeonMap applyAndComplete(
            DungeonEditHistory history,
            DungeonMap current,
            boolean undo
    ) {
        DungeonEditHistory.Step step = undo
                ? history.peekUndo(current.metadata().mapId())
                : history.peekRedo(current.metadata().mapId());
        DungeonMap changed = step.applyTo(Map.of(current.metadata().mapId().value(), current))
                .get(current.metadata().mapId().value());
        history.complete(step);
        return changed;
    }

    private static DungeonPatch descriptionPatch(DungeonMap current, String description) {
        Transition before = current.transitionCatalog().transition(1L);
        return DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new TransitionChange(before, before.withDescription(description))));
    }

    private static DungeonMap transitionMap(long mapId, long transitionId, String name) {
        DungeonMap empty = DungeonMapAuthoring.empty(new DungeonMapIdentity(mapId), name);
        Transition transition = new Transition(
                transitionId,
                mapId,
                "",
                TransitionAnchor.cell(new Cell((int) transitionId, 0, 0)),
                TransitionDestination.unlinkedEntrance(),
                null);
        return empty.withTransitionCatalog(new TransitionCatalog(List.of(transition)));
    }
}
