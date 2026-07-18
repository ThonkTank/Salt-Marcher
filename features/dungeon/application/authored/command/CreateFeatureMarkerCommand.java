package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.util.List;

/** Plans creation of one stable feature marker. */
public final class CreateFeatureMarkerCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long markerId,
            FeatureMarkerKind kind,
            Cell anchor,
            String label,
            String description
    ) {
        if (current == null || markerId <= 0L || kind == null || anchor == null
                || current.featureMarkers().marker(markerId) != null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        FeatureMarker marker = new FeatureMarker(
                markerId,
                current.metadata().mapId(),
                kind,
                anchor,
                label,
                description);
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new FeatureMarkerChange(null, marker))));
    }
}
