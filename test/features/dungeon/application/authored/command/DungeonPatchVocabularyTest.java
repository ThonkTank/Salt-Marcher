package features.dungeon.application.authored.command;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
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
        assertEquals(before.topologyRef(), patch.resultFacts().affectedTopologyRefs().getFirst());
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

    private static DungeonMap mapWithMarker() {
        DungeonMap base = DungeonMapAuthoring.empty(new DungeonMapIdentity(91L), "Patch Vocabulary");
        return base.withFeatureMarkers(base.featureMarkers().withCreated(
                7L,
                base.metadata().mapId(),
                FeatureMarkerKind.POI,
                new Cell(-1, 64, -2),
                "Alter Name",
                "Alte Beschreibung"));
    }
}
