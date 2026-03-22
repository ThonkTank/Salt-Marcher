package features.world.dungeonmap.model.structures.corridor;

import java.util.List;

public final class LoadedCorridorPathMaterializer {

    private LoadedCorridorPathMaterializer() {
        throw new AssertionError("No instances");
    }

    public static List<Corridor> materialize(List<Corridor> corridors, CorridorPlanningInput planningInput) {
        if (corridors == null || corridors.isEmpty()) {
            return List.of();
        }
        return corridors.stream()
                .map(corridor -> corridor == null ? null : corridor.replanned(planningInput))
                .toList();
    }
}
