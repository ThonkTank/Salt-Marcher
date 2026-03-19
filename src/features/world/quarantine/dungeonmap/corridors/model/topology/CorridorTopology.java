package features.world.quarantine.dungeonmap.corridors.model.topology;

import java.util.Map;

public record CorridorTopology(
        Map<Long, CorridorGeometry> corridorGeometries,
        Map<String, CorridorComponent> componentsById,
        Map<Long, String> componentIdByCorridorId
) {
    public CorridorComponent componentForCorridor(Long corridorId) {
        if (corridorId == null) {
            return null;
        }
        String componentId = componentIdByCorridorId.get(corridorId);
        return componentId == null ? null : componentsById.get(componentId);
    }

    public CorridorComponent componentById(String componentId) {
        return componentId == null ? null : componentsById.get(componentId);
    }
}
