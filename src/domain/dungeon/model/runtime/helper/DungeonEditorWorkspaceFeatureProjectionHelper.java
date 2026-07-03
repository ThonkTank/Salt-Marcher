package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.projection.DungeonFeatureFacts;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

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
        for (Cell cell : feature.cells()) {
            cells.add(cell(cell));
        }
        return new DungeonEditorWorkspaceValues.Feature(
                feature.kind(),
                feature.id(),
                feature.label(),
                List.copyOf(cells),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef(),
                edge(feature.anchorEdge()));
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEditorWorkspaceValues.Edge edge(
            src.domain.dungeon.model.core.geometry.Edge edge
    ) {
        return edge == null
                ? null
                : new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
    }
}
