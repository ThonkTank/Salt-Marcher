package src.domain.dungeon.model.worldspace.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonFeatureFacts;
import src.domain.dungeon.model.worldspace.model.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceFeatureProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Feature> project(DungeonMapFacts safeFacts) {
        List<DungeonEditorWorkspaceValues.Feature> features = new ArrayList<>();
        for (DungeonFeatureFacts feature : safeFacts.features()) {
            features.add(feature(feature));
        }
        return List.copyOf(features);
    }

    private static DungeonEditorWorkspaceValues.Feature feature(DungeonFeatureFacts feature) {
        List<DungeonEditorWorkspaceValues.Cell> cells = new ArrayList<>();
        for (DungeonCell cell : feature.cells()) {
            cells.add(cell(cell));
        }
        return new DungeonEditorWorkspaceValues.Feature(
                feature.kind(),
                feature.id(),
                feature.label(),
                List.copyOf(cells),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }
}
