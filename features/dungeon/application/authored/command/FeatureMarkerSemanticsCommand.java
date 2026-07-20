package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import java.util.List;

/** Plans one exact feature-marker semantic patch from current authored truth. */
public final class FeatureMarkerSemanticsCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long markerId,
            String label,
            String description
    ) {
        if (current == null || markerId <= 0L || label == null || label.isBlank()) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        FeatureMarker before = current.featureMarkers().marker(markerId);
        if (before == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        FeatureMarker after = before.withSemantics(label, description);
        if (after.equals(before)) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        DungeonPatch patch = DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new FeatureMarkerChange(before, after)));
        return DungeonCommandResult.Accepted.from(patch);
    }
}
