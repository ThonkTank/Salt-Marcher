package features.world.quarantine.dungeonmap.loading;

import features.world.quarantine.dungeonmap.canvas.state.DungeonWorkspaceRenderState;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopologyPlanner;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.util.List;
import java.util.stream.Collectors;

public record DungeonLoadingState(
        List<DungeonMap> maps,
        Long selectedMapId,
        DungeonLayout layout,
        CorridorTopology corridorTopology,
        DungeonWorkspaceRenderState renderState,
        List<Long> degradedCorridorIds
) {
    public static DungeonLoadingState empty(List<DungeonMap> maps) {
        return new DungeonLoadingState(List.copyOf(maps), null, null, null, null, List.of());
    }

    public static DungeonLoadingState prepared(
            List<DungeonMap> maps,
            Long selectedMapId,
            DungeonLayout layout
    ) {
        if (layout == null) {
            return new DungeonLoadingState(List.copyOf(maps), selectedMapId, null, null, null, List.of());
        }
        CorridorTopology corridorTopology = CorridorTopologyPlanner.planCorridorTopology(layout);
        DungeonWorkspaceRenderState renderState = DungeonWorkspaceRenderState.from(layout, corridorTopology, null);
        List<Long> degradedCorridorIds = corridorTopology.corridorGeometries().values().stream()
                .filter(geometry -> geometry != null && !geometry.routable() && geometry.roomIds().size() >= 2)
                .map(geometry -> geometry.corridorId())
                .filter(id -> id != null)
                .collect(Collectors.toUnmodifiableList());
        return new DungeonLoadingState(List.copyOf(maps), selectedMapId, layout, corridorTopology, renderState, degradedCorridorIds);
    }
}
