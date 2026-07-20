package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.projection.DungeonFeatureFacts;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceFeatureProjectionHelper {
    public List<DungeonEditorWorkspaceValues.Feature> project(DungeonMapFacts safeFacts) {
        List<DungeonEditorWorkspaceValues.Feature> features = new ArrayList<>();
        for (DungeonFeatureFacts feature : safeFacts.features()) {
            features.add(feature(feature));
        }
        return List.copyOf(features);
    }

    private static DungeonEditorWorkspaceValues.Feature feature(DungeonFeatureFacts feature) {
        List<features.dungeon.domain.core.geometry.Cell> cells = new ArrayList<>();
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

    private static features.dungeon.domain.core.geometry.Cell cell(@Nullable Cell cell) {
        return cell == null
                ? features.dungeon.domain.core.geometry.Cell.empty()
                : new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }

    private static features.dungeon.domain.core.geometry.Edge edge(
            features.dungeon.domain.core.geometry.Edge edge
    ) {
        return edge == null
                ? null
                : new features.dungeon.domain.core.geometry.Edge(cell(edge.from()), cell(edge.to()));
    }
}
