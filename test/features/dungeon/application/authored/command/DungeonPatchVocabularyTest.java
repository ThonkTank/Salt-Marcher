package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.util.Set;
import org.junit.jupiter.api.Test;

final class DungeonPatchVocabularyTest {

    @Test
    void featureMarkerCommandProducesExactApplicableAndInvertiblePatch() {
        DungeonMap current = mapWithMarker();
        FeatureMarker before = current.featureMarkers().marker(7L);
        FeatureMarkerSemanticsCommand command = new FeatureMarkerSemanticsCommand();

        DungeonCommandResult.Accepted accepted = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                command.plan(current, 7L, "Neuer Name", "Neue Beschreibung"));

        DungeonPatch patch = accepted.patch();
        assertEquals(current.metadata().mapId(), patch.mapId());
        assertEquals(current.revision(), patch.expectedRevision());
        assertEquals(current.revision() + 1L, patch.committedRevision());
        assertEquals(1, patch.changes().size());
        assertEquals(Set.of(new DungeonChunkKey(91L, -2, -1, 1)), patch.touchedChunks());
        assertEquals(
                DungeonPatchEntityRef.featureMarker(before.markerId()),
                patch.resultFacts().affectedEntities().getFirst());
        long changedTextBytes = "Neuer NameNeue Beschreibung"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        assertTrue(patch.encodedBytes() >= changedTextBytes);
        assertThrows(IllegalArgumentException.class, () -> DungeonPatch.of(
                new DungeonMapIdentity(92L),
                current.revision(),
                patch.changes()));

        DungeonMap changed = patch.applyTo(current);
        assertEquals("Neuer Name", changed.featureMarkers().marker(7L).label());
        assertEquals("Neue Beschreibung", changed.featureMarkers().marker(7L).description());
        assertEquals(current.revision() + 1L, changed.revision());

        DungeonMap restored = accepted.inverse().applyTo(changed);
        assertEquals(before, restored.featureMarkers().marker(7L));
        assertEquals(current.revision() + 2L, restored.revision());
        assertThrows(IllegalArgumentException.class, () -> patch.applyTo(changed));
    }

    @Test
    void invalidAndNoEffectCommandsRejectWithoutChangingAuthoredTruth() {
        DungeonMap current = mapWithMarker();
        FeatureMarker marker = current.featureMarkers().marker(7L);
        FeatureMarkerSemanticsCommand command = new FeatureMarkerSemanticsCommand();

        DungeonCommandResult.Rejected missing = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                command.plan(current, 99L, "Fehlt", ""));
        DungeonCommandResult.Rejected noEffect = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                command.plan(current, 7L, marker.label(), marker.description()));

        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, missing.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT, noEffect.reason());
        assertEquals(marker, current.featureMarkers().marker(7L));
        assertEquals(2L, current.revision());
    }

    @Test
    void featureMarkerCreateAndDeleteUseExactForwardAndInversePatches() {
        DungeonMap empty = DungeonMapAuthoring.empty(new DungeonMapIdentity(91L), "Patch Vocabulary");
        Cell anchor = new Cell(-1, 64, -2);
        CreateFeatureMarkerCommand createCommand = new CreateFeatureMarkerCommand();

        DungeonCommandResult.Accepted createdResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                createCommand.plan(empty, 7L, FeatureMarkerKind.POI, anchor, "Fundort", "Hinweis"));
        DungeonPatch createPatch = createdResult.patch();
        assertEquals(Set.of(new DungeonChunkKey(91L, -2, -1, 1)), createPatch.touchedChunks());

        DungeonMap created = createPatch.applyTo(empty);
        FeatureMarker createdMarker = created.featureMarkers().marker(7L);
        assertEquals(new FeatureMarker(
                7L,
                empty.metadata().mapId(),
                FeatureMarkerKind.POI,
                anchor,
                "Fundort",
                "Hinweis"), createdMarker);
        DungeonMap createUndone = createdResult.inverse().applyTo(created);
        assertNull(createUndone.featureMarkers().marker(7L));
        assertEquals(empty.revision() + 2L, createUndone.revision());

        DeleteFeatureMarkerCommand deleteCommand = new DeleteFeatureMarkerCommand();
        DungeonCommandResult.Accepted deletedResult = assertInstanceOf(
                DungeonCommandResult.Accepted.class,
                deleteCommand.plan(created, 7L));
        DungeonMap deleted = deletedResult.patch().applyTo(created);
        assertNull(deleted.featureMarkers().marker(7L));
        DungeonMap deleteUndone = deletedResult.inverse().applyTo(deleted);
        assertEquals(createdMarker, deleteUndone.featureMarkers().marker(7L));
        assertEquals(created.revision() + 2L, deleteUndone.revision());
    }

    @Test
    void featureMarkerCreateCollisionAndMissingDeleteRejectWithoutMutation() {
        DungeonMap current = mapWithMarker();
        CreateFeatureMarkerCommand createCommand = new CreateFeatureMarkerCommand();
        DeleteFeatureMarkerCommand deleteCommand = new DeleteFeatureMarkerCommand();

        DungeonCommandResult.Rejected collision = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                createCommand.plan(
                        current,
                        7L,
                        FeatureMarkerKind.OBJECT,
                        new Cell(0, 0, 0),
                        "Kollision",
                        ""));
        DungeonCommandResult.Rejected missing = assertInstanceOf(
                DungeonCommandResult.Rejected.class,
                deleteCommand.plan(current, 99L));

        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, collision.reason());
        assertEquals(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET, missing.reason());
        assertEquals(1, current.featureMarkers().markers().size());
        assertEquals(2L, current.revision());
    }

    private static DungeonMap mapWithMarker() {
        DungeonMap base = DungeonMapAuthoring.empty(new DungeonMapIdentity(91L), "Patch Vocabulary");
        FeatureMarker marker = new FeatureMarker(
                7L,
                base.metadata().mapId(),
                FeatureMarkerKind.POI,
                new Cell(-1, 64, -2),
                "Alter Name",
                "Alte Beschreibung");
        return base.withFeatureMarkers(base.featureMarkers().withExactChange(null, marker));
    }
}
