package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.CorridorComponent;
import features.world.dungeonmap.model.CorridorGeometry;
import features.world.dungeonmap.model.CorridorTopology;
import features.world.dungeonmap.model.DungeonCorridorGeometry;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.GridSegment;
import features.world.dungeonmap.model.Point2i;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayoutRenderData {

    private final DungeonLayout layout;
    private final CorridorTopology corridorTopology;
    private final Map<Long, CorridorGeometry> corridorGeometries;
    private final Set<Point2i> corridorCells;

    private DungeonLayoutRenderData(
            DungeonLayout layout,
            CorridorTopology corridorTopology,
            Map<Long, CorridorGeometry> corridorGeometries,
            Set<Point2i> corridorCells
    ) {
        this.layout = layout;
        this.corridorTopology = corridorTopology;
        this.corridorGeometries = corridorGeometries;
        this.corridorCells = corridorCells;
    }

    public static DungeonLayoutRenderData from(DungeonLayout layout) {
        CorridorTopology corridorTopology = layout == null
                ? new CorridorTopology(Map.of(), Map.of(), Map.of())
                : DungeonCorridorGeometry.corridorTopology(layout);
        Map<Long, CorridorGeometry> corridorGeometries = corridorTopology.corridorGeometries();
        Set<Point2i> corridorCells = new LinkedHashSet<>();
        for (CorridorGeometry geometry : corridorGeometries.values()) {
            corridorCells.addAll(geometry.cells());
        }
        return new DungeonLayoutRenderData(
                layout,
                corridorTopology,
                Map.copyOf(corridorGeometries),
                Set.copyOf(corridorCells));
    }

    public DungeonLayout layout() {
        return layout;
    }

    public List<Point2i> corridorPath(Long corridorId) {
        CorridorGeometry geometry = corridorGeometry(corridorId);
        if (geometry == null || geometry.segments().isEmpty()) {
            return List.of();
        }
        java.util.List<Point2i> points = new java.util.ArrayList<>();
        for (GridSegment segment : geometry.segments()) {
            if (points.isEmpty() || !points.get(points.size() - 1).equals(segment.from())) {
                points.add(segment.from());
            }
            points.add(segment.to());
        }
        return List.copyOf(points);
    }

    public CorridorGeometry corridorGeometry(Long corridorId) {
        return corridorId == null ? null : corridorGeometries.get(corridorId);
    }

    public Set<Point2i> corridorCells() {
        return corridorCells;
    }

    public CorridorTopology corridorTopology() {
        return corridorTopology;
    }

    public CorridorComponent corridorComponent(String componentId) {
        return corridorTopology.componentById(componentId);
    }

    public CorridorComponent corridorComponentForCorridor(Long corridorId) {
        return corridorTopology.componentForCorridor(corridorId);
    }

    public String corridorComponentId(Long corridorId) {
        return corridorId == null ? null : corridorTopology.componentIdByCorridorId().get(corridorId);
    }
}
