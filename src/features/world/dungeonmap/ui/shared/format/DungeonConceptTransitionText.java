package features.world.dungeonmap.ui.shared.format;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptTransitionVariants;

import java.util.List;

public final class DungeonConceptTransitionText {

    private DungeonConceptTransitionText() {
        throw new AssertionError("No instances");
    }

    public static String nodeLabel(DungeonConceptCanvasNode node) {
        if (node == null) {
            return "";
        }
        if (node.nodeType() == DungeonConceptNodeType.LEVEL_TRANSITION) {
            return transitionLabel(node.name(), node.transitionVariantIndex(), node.transitionVariantCount());
        }
        return node.displayName();
    }

    public static String transitionLabel(String targetLevelName, Integer variantIndex, Integer variantCount) {
        String baseLabel = targetLevelName == null || targetLevelName.isBlank() ? "Ebenenwechsel" : "Zu " + targetLevelName;
        return appendVariant(baseLabel, variantIndex, variantCount);
    }

    public static String targetChipLabel(String targetLevelName, Integer variantIndex, Integer variantCount) {
        String baseLabel = targetLevelName == null || targetLevelName.isBlank() ? "Ebene" : targetLevelName;
        return appendVariant(baseLabel, variantIndex, variantCount);
    }

    public static String targetChipLabel(
            List<DungeonConceptLevelConnection> connections,
            List<DungeonConceptLevel> levels,
            Long sourceLevelId,
            DungeonConceptLevelConnection connection
    ) {
        DungeonConceptLevel targetLevel = findLevel(levels, connection == null ? null : connection.otherLevelId(sourceLevelId));
        return targetChipLabel(
                targetLevel == null ? null : targetLevel.displayName(),
                DungeonConceptTransitionVariants.variantIndex(connections, sourceLevelId, connection),
                DungeonConceptTransitionVariants.variantCount(connections, sourceLevelId, connection));
    }

    private static String appendVariant(String baseLabel, Integer variantIndex, Integer variantCount) {
        int safeVariantCount = variantCount == null ? 1 : variantCount;
        int safeVariantIndex = variantIndex == null ? 1 : variantIndex;
        return safeVariantCount <= 1 ? baseLabel : baseLabel + " · " + safeVariantIndex;
    }

    private static DungeonConceptLevel findLevel(List<DungeonConceptLevel> levels, Long conceptLevelId) {
        if (conceptLevelId == null || levels == null) {
            return null;
        }
        for (DungeonConceptLevel level : levels) {
            if (conceptLevelId.equals(level.conceptLevelId())) {
                return level;
            }
        }
        return null;
    }
}
