package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import java.util.List;

/** Plans deletion of one existing stable feature marker. */
public final class DeleteFeatureMarkerCommand {

    public DungeonCommandResult plan(DungeonMap current, long markerId) {
        if (current == null || markerId <= 0L) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        FeatureMarker marker = current.featureMarkers().marker(markerId);
        if (marker == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new FeatureMarkerChange(marker, null))));
    }
}
