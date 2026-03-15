package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class DungeonConceptTransitionVariants {

    private DungeonConceptTransitionVariants() {
        throw new AssertionError("No instances");
    }

    public static int variantIndex(
            List<DungeonConceptLevelConnection> connections,
            Long sourceLevelId,
            DungeonConceptLevelConnection reference
    ) {
        if (reference == null) {
            return 1;
        }
        List<DungeonConceptLevelConnection> siblings = sameTargetSiblings(connections, sourceLevelId, reference);
        for (int index = 0; index < siblings.size(); index++) {
            if (reference.connectionId().equals(siblings.get(index).connectionId())) {
                return index + 1;
            }
        }
        return 1;
    }

    public static int variantCount(
            List<DungeonConceptLevelConnection> connections,
            Long sourceLevelId,
            DungeonConceptLevelConnection reference
    ) {
        return reference == null ? 1 : sameTargetSiblings(connections, sourceLevelId, reference).size();
    }

    private static List<DungeonConceptLevelConnection> sameTargetSiblings(
            List<DungeonConceptLevelConnection> connections,
            Long sourceLevelId,
            DungeonConceptLevelConnection reference
    ) {
        List<DungeonConceptLevelConnection> result = new ArrayList<>();
        if (connections == null || sourceLevelId == null || reference == null) {
            return result;
        }
        Long targetLevelId = reference.otherLevelId(sourceLevelId);
        for (DungeonConceptLevelConnection connection : connections) {
            if (connection == null) {
                continue;
            }
            if (targetLevelId != null && targetLevelId.equals(connection.otherLevelId(sourceLevelId))) {
                result.add(connection);
            }
        }
        result.sort(Comparator.comparing(DungeonConceptLevelConnection::connectionId));
        return result;
    }
}
