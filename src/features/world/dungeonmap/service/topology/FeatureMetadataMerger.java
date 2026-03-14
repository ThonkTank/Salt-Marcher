package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

final class FeatureMetadataMerger {

    private FeatureMetadataMerger() {
    }

    static void updateMergedFeatureMetadata(
            Connection conn,
            long primaryFeatureId,
            List<Long> mergedFeatureIds,
            Map<Long, DungeonFeature> featuresById,
            Map<Long, Integer> featureSquareCounts,
            TopologyIntent intent
    ) throws SQLException {
        DungeonFeature primaryFeature = featuresById.get(primaryFeatureId);
        if (primaryFeature == null) {
            return;
        }

        List<Long> secondaryFeatureIds = new ArrayList<>();
        for (Long featureId : mergedFeatureIds) {
            if (featureId != null && featureId != primaryFeatureId) {
                secondaryFeatureIds.add(featureId);
            }
        }
        secondaryFeatureIds.sort(TopologyEntitySelectionSupport.mergeComparator(featureSquareCounts, intent));

        List<DungeonFeature> secondaryFeatures = new ArrayList<>();
        for (Long featureId : secondaryFeatureIds) {
            DungeonFeature feature = featuresById.get(featureId);
            if (feature != null) {
                secondaryFeatures.add(feature);
            }
        }
        upsertMergedMetadata(conn, primaryFeature, secondaryFeatures);
    }

    static String coalesceText(String value) {
        return value == null ? "" : value;
    }

    private static void upsertMergedMetadata(Connection conn, DungeonFeature primaryFeature, List<DungeonFeature> secondaryFeatures) throws SQLException {
        String mergedGlanceDescription = mergeText(primaryFeature.glanceDescription(), secondaryFeatures, DungeonFeature::glanceDescription);
        String mergedDetailDescription = mergeText(primaryFeature.detailDescription(), secondaryFeatures, DungeonFeature::detailDescription);
        String mergedReactiveChecks = mergeText(primaryFeature.reactiveChecks(), secondaryFeatures, DungeonFeature::reactiveChecks);
        String mergedGmBackground = mergeText(primaryFeature.gmBackground(), secondaryFeatures, DungeonFeature::gmBackground);
        Long mergedEncounterId = mergeEncounterId(primaryFeature.category(), primaryFeature.encounterId(), secondaryFeatures);
        if (sameText(primaryFeature.glanceDescription(), mergedGlanceDescription)
                && sameText(primaryFeature.detailDescription(), mergedDetailDescription)
                && sameText(primaryFeature.reactiveChecks(), mergedReactiveChecks)
                && sameText(primaryFeature.gmBackground(), mergedGmBackground)
                && sameNullableId(primaryFeature.encounterId(), mergedEncounterId)) {
            return;
        }
        DungeonFeatureRepository.upsertFeature(conn, primaryFeature.withEditorValues(
                primaryFeature.category(),
                mergedEncounterId,
                primaryFeature.name(),
                mergedGlanceDescription,
                mergedDetailDescription,
                mergedReactiveChecks,
                mergedGmBackground,
                primaryFeature.sortOrder()));
    }

    private static Long mergeEncounterId(
            DungeonFeatureCategory category,
            Long primaryEncounterId,
            List<DungeonFeature> mergedFeatures
    ) {
        if (category != DungeonFeatureCategory.ENCOUNTER) {
            return null;
        }
        if (primaryEncounterId != null) {
            return primaryEncounterId;
        }
        Long resolvedEncounterId = null;
        for (DungeonFeature feature : mergedFeatures) {
            if (feature == null || feature.encounterId() == null) {
                continue;
            }
            if (resolvedEncounterId == null) {
                resolvedEncounterId = feature.encounterId();
                continue;
            }
            if (!resolvedEncounterId.equals(feature.encounterId())) {
                return null;
            }
        }
        return resolvedEncounterId;
    }

    private static String mergeText(
            String primaryValue,
            List<DungeonFeature> mergedFeatures,
            java.util.function.Function<DungeonFeature, String> accessor
    ) {
        List<String> parts = new ArrayList<>();
        String base = normalizedText(primaryValue);
        if (base != null) {
            parts.add(base);
        }
        java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>(parts);
        for (DungeonFeature feature : mergedFeatures) {
            String value = normalizedText(accessor.apply(feature));
            if (value != null && seen.add(value)) {
                parts.add(value);
            }
        }
        return parts.isEmpty() ? "" : String.join("\n\n", parts);
    }

    private static String normalizedText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean sameText(String left, String right) {
        String normalizedLeft = normalizedText(left);
        String normalizedRight = normalizedText(right);
        if (normalizedLeft == null && normalizedRight == null) {
            return true;
        }
        if (normalizedLeft == null || normalizedRight == null) {
            return false;
        }
        return normalizedLeft.equals(normalizedRight);
    }

    private static boolean sameNullableId(Long left, Long right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equals(right);
    }
}
