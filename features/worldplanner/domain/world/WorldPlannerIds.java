package features.worldplanner.domain.world;

import java.util.ArrayList;
import java.util.List;

public final class WorldPlannerIds {

    private static final long MINIMUM_VALID_ID = 1L;

    public static boolean isPositive(long id) {
        return id >= MINIMUM_VALID_ID;
    }

    static List<Long> addUnique(List<Long> ids, long id) {
        if (!isPositive(id)) {
            throw new IllegalArgumentException("id must be positive");
        }
        if (ids.contains(id)) {
            throw new IllegalArgumentException("id already linked");
        }
        List<Long> nextIds = new ArrayList<>(ids);
        nextIds.add(id);
        return List.copyOf(nextIds);
    }

    static List<Long> normalize(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }
        List<Long> normalizedIds = new ArrayList<>();
        for (Long id : ids) {
            if (id == null || !isPositive(id)) {
                throw new IllegalArgumentException("ids must be positive");
            }
            if (normalizedIds.contains(id)) {
                throw new IllegalArgumentException("ids must be unique");
            }
            normalizedIds.add(id);
        }
        return List.copyOf(normalizedIds);
    }

    private WorldPlannerIds() {
    }
}
