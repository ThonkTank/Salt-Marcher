package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.TransitionChange;
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
import org.junit.jupiter.api.Test;

final class DungeonEditHistoryTest {
    @Test
    void undoAndRedoRemainLocalToOneRunningSessionAndMap() {
        DungeonMapIdentity mapId = new DungeonMapIdentity(1L);
        DungeonMap before = DungeonMapAuthoring.empty(mapId, "Before");
        DungeonMap after = DungeonMapAuthoring.rename(before, "After");
        DungeonEditHistory history = new DungeonEditHistory();

        history.record(before, after);

        assertTrue(history.canUndo(mapId));
        DungeonMap undone = applyAndComplete(history, after, true);
        assertEquals(before.metadata(), undone.metadata());
        assertEquals(after.revision() + 1L, undone.revision());
        assertFalse(history.canUndo(mapId));
        assertTrue(history.canRedo(mapId));
        DungeonMap redone = applyAndComplete(history, undone, false);
        assertEquals(after.metadata(), redone.metadata());
        assertEquals(undone.revision() + 1L, redone.revision());
    }

    @Test
    void newCommitClearsTheRedoBranch() {
        DungeonMapIdentity mapId = new DungeonMapIdentity(1L);
        DungeonMap first = DungeonMapAuthoring.empty(mapId, "First");
        DungeonMap second = DungeonMapAuthoring.rename(first, "Second");
        DungeonMap replacement = DungeonMapAuthoring.rename(first, "Replacement");
        DungeonEditHistory history = new DungeonEditHistory();
        history.record(first, second);
        DungeonMap undone = applyAndComplete(history, second, true);

        DungeonMap committedReplacement = DungeonMapAuthoring.committedContent(
                replacement,
                undone.revision() + 1L);
        history.record(undone, committedReplacement);

        assertFalse(history.canRedo(mapId));
        assertEquals(first.metadata(), applyAndComplete(history, committedReplacement, true).metadata());
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

        DungeonMap laterTarget = DungeonMapAuthoring.rename(redone.get(12L), "Later target edit");
        history.record(redone.get(12L), laterTarget);
        assertFalse(history.canUndo(source.metadata().mapId()));
        assertTrue(history.canUndo(target.metadata().mapId()));
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
