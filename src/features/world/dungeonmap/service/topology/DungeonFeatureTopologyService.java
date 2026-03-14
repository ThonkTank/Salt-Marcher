package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DungeonFeatureTopologyService {

    private static final Pattern DEFAULT_FEATURE_NAME = Pattern.compile("^(Gefahr|Begegnung|Schatz|Kuriosität) #(\\d+)$");

    private DungeonFeatureTopologyService() {
        throw new AssertionError("No instances");
    }

    public static Long applyFeaturePaints(
            Connection conn,
            long mapId,
            DungeonFeatureCategory category,
            List<DungeonSquarePaint> edits
    ) throws SQLException {
        DungeonFeatureCategory effectiveCategory = category == null ? DungeonFeatureCategory.CURIOSITY : category;
        List<DungeonSquarePaint> filledEdits = TopologyPaintSupport.filledEdits(edits);
        if (filledEdits.isEmpty()) {
            return null;
        }

        List<DungeonFeatureTile> previousTiles = DungeonFeatureTileRepository.getTilesForCategory(conn, mapId, effectiveCategory);
        Map<String, DungeonFeatureTile> previousTilesByCoord = featureTilesByCoord(previousTiles);
        List<DungeonFeature> categoryFeatures = DungeonFeatureRepository.getFeaturesForCategory(conn, mapId, effectiveCategory);
        List<DungeonFeatureTile> currentTiles = previousTiles;
        Map<Long, Integer> featureSquareCounts = featureSquareCounts(currentTiles);

        List<Long> overlappedFeatureIds = TopologyPaintSupport.overlappedOwnerIds(
                filledEdits,
                key -> {
                    DungeonFeatureTile tile = previousTilesByCoord.get(key);
                    return tile == null ? null : tile.featureId();
                });
        SquarePaintOutcome outcome = TopologyPaintSupport.classifySquarePaintOutcome(overlappedFeatureIds);
        TopologyIntent intent = TopologyIntent.forSquareEdits(edits, List.of());

        long targetFeatureId;
        if (outcome == SquarePaintOutcome.NEW_ROOM) {
            targetFeatureId = createDefaultFeature(conn, mapId, effectiveCategory, nextDefaultFeatureNumber(categoryFeatures, effectiveCategory), null);
        } else {
            TopologyIntent priorityIntent = intent.withPrimaryRoomPriority(overlappedFeatureIds);
            Long preferredFeatureId = TopologyEntitySelectionSupport.selectPreferredEntityId(
                    overlappedFeatureIds,
                    featureSquareCounts,
                    priorityIntent);
            targetFeatureId = preferredFeatureId == null ? overlappedFeatureIds.get(0) : preferredFeatureId;
            List<Long> targetFirstFeatureIds = TopologyPaintSupport.prioritizeTargetEntity(targetFeatureId, overlappedFeatureIds);
            FeatureMetadataMerger.updateMergedFeatureMetadata(
                    conn,
                    targetFeatureId,
                    overlappedFeatureIds,
                    featuresById(categoryFeatures),
                    featureSquareCounts,
                    intent.withPrimaryRoomPriority(targetFirstFeatureIds));
            moveMergedFeatures(conn, targetFeatureId, overlappedFeatureIds);
            intent = intent.withPrimaryRoomPriority(targetFirstFeatureIds);
        }

        assignFilledSquaresToFeature(conn, mapId, targetFeatureId, filledEdits);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);
        return reconcileFeatureComponents(conn, mapId, effectiveCategory, intent, targetFeatureId);
    }

    private static Long reconcileFeatureComponents(
            Connection conn,
            long mapId,
            DungeonFeatureCategory category,
            TopologyIntent intent,
            long preferredFeatureId
    ) throws SQLException {
        List<DungeonFeature> features = DungeonFeatureRepository.getFeaturesForCategory(conn, mapId, category);
        List<DungeonFeatureTile> featureTiles = DungeonFeatureTileRepository.getTilesForCategory(conn, mapId, category);
        if (featureTiles.isEmpty()) {
            DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);
            return null;
        }

        List<DungeonSquare> syntheticSquares = toSyntheticSquares(featureTiles, mapId);
        List<RoomComponentGraph.RoomComponent> components = RoomComponentGraph.buildRoomComponents(syntheticSquares, Map.of());
        Map<Long, Integer> largestComponentByFeatureId = RoomComponentGraph.findLargestComponentByRoom(components, intent);
        int nextDefaultNumber = nextDefaultFeatureNumber(features, category);
        Set<Long> retainedFeatureIds = new HashSet<>();
        Map<Long, DungeonFeature> featuresById = featuresById(features);
        Long resolvedPreferredFeatureId = null;

        for (RoomComponentGraph.RoomComponent component : components) {
            List<Long> retainableFeatureIds = RoomComponentGraph.retainableRoomIds(component, largestComponentByFeatureId);
            Long primaryFeatureId = TopologyEntitySelectionSupport.selectPreferredEntityId(
                    retainableFeatureIds,
                    component.roomSquareCounts(),
                    intent);
            if (primaryFeatureId == null) {
                DungeonFeature templateFeature = selectTemplateFeature(component, featuresById, intent);
                primaryFeatureId = createDefaultFeature(conn, mapId, category, nextDefaultNumber++, templateFeature);
            } else {
                updatePrimaryFeature(conn, component, primaryFeatureId, largestComponentByFeatureId, featuresById, intent);
            }

            retainedFeatureIds.add(primaryFeatureId);
            if (primaryFeatureId == preferredFeatureId) {
                resolvedPreferredFeatureId = primaryFeatureId;
            }
            assignComponentTiles(conn, component.squares(), primaryFeatureId);
        }

        deleteUnretainedFeatures(conn, features, retainedFeatureIds);
        DungeonFeatureRepository.deleteEmptyFeatures(conn, mapId);
        if (resolvedPreferredFeatureId != null) {
            return resolvedPreferredFeatureId;
        }
        return retainedFeatureIds.contains(preferredFeatureId)
                ? preferredFeatureId
                : retainedFeatureIds.stream().sorted().findFirst().orElse(null);
    }

    private static void updatePrimaryFeature(
            Connection conn,
            RoomComponentGraph.RoomComponent component,
            long primaryFeatureId,
            Map<Long, Integer> largestComponentByFeatureId,
            Map<Long, DungeonFeature> featuresById,
            TopologyIntent intent
    ) throws SQLException {
        List<Long> mergedFeatureIds = new ArrayList<>();
        for (Long featureId : component.roomIds()) {
            if (featureId == null || featureId == primaryFeatureId) {
                continue;
            }
            if (largestComponentByFeatureId.getOrDefault(featureId, -1) == component.index()) {
                mergedFeatureIds.add(featureId);
            }
        }
        FeatureMetadataMerger.updateMergedFeatureMetadata(
                conn,
                primaryFeatureId,
                mergedFeatureIds,
                featuresById,
                component.roomSquareCounts(),
                intent);
    }

    private static DungeonFeature selectTemplateFeature(
            RoomComponentGraph.RoomComponent component,
            Map<Long, DungeonFeature> featuresById,
            TopologyIntent intent
    ) {
        Long templateFeatureId = TopologyEntitySelectionSupport.selectPreferredEntityId(
                List.copyOf(component.roomIds()),
                component.roomSquareCounts(),
                intent);
        return templateFeatureId == null ? null : featuresById.get(templateFeatureId);
    }

    private static void assignComponentTiles(Connection conn, List<DungeonSquare> squares, long targetFeatureId) throws SQLException {
        for (DungeonSquare square : squares) {
            if (square.roomId() == null) {
                DungeonFeatureTileRepository.addTile(conn, targetFeatureId, square.squareId());
                continue;
            }
            if (square.roomId() != targetFeatureId) {
                DungeonFeatureTileRepository.reassignTile(conn, square.squareId(), square.roomId(), targetFeatureId);
            }
        }
    }

    private static void deleteUnretainedFeatures(Connection conn, List<DungeonFeature> features, Set<Long> retainedFeatureIds) throws SQLException {
        for (DungeonFeature feature : features) {
            if (!retainedFeatureIds.contains(feature.featureId())) {
                DungeonFeatureRepository.deleteFeature(conn, feature.featureId());
            }
        }
    }

    private static void moveMergedFeatures(Connection conn, long targetFeatureId, List<Long> mergedFeatureIds) throws SQLException {
        for (Long featureId : mergedFeatureIds) {
            if (featureId != null && featureId != targetFeatureId) {
                DungeonFeatureTileRepository.moveTiles(conn, featureId, targetFeatureId);
            }
        }
    }

    private static void assignFilledSquaresToFeature(
            Connection conn,
            long mapId,
            long targetFeatureId,
            List<DungeonSquarePaint> filledEdits
    ) throws SQLException {
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(DungeonSquareRepository.getSquares(conn, mapId));
        for (DungeonSquarePaint edit : filledEdits) {
            DungeonSquare square = squaresByCoord.get(TopologyWorkspace.coordKey(edit.x(), edit.y()));
            if (square != null) {
                DungeonFeatureTileRepository.addTile(conn, targetFeatureId, square.squareId());
            }
        }
    }

    private static long createDefaultFeature(
            Connection conn,
            long mapId,
            DungeonFeatureCategory category,
            int number,
            DungeonFeature templateFeature
    ) throws SQLException {
        DungeonFeatureCategory effectiveCategory = category == null ? DungeonFeatureCategory.CURIOSITY : category;
        DungeonFeature feature = new DungeonFeature(
                null,
                mapId,
                effectiveCategory,
                effectiveCategory == DungeonFeatureCategory.ENCOUNTER && templateFeature != null ? templateFeature.encounterId() : null,
                effectiveCategory.label() + " #" + number,
                templateFeature == null ? "" : FeatureMetadataMerger.coalesceText(templateFeature.glanceDescription()),
                templateFeature == null ? "" : FeatureMetadataMerger.coalesceText(templateFeature.detailDescription()),
                templateFeature == null ? "" : FeatureMetadataMerger.coalesceText(templateFeature.reactiveChecks()),
                templateFeature == null ? "" : FeatureMetadataMerger.coalesceText(templateFeature.gmBackground()),
                templateFeature == null ? 0 : templateFeature.sortOrder());
        return DungeonFeatureRepository.upsertFeature(conn, feature);
    }

    private static int nextDefaultFeatureNumber(List<DungeonFeature> features, DungeonFeatureCategory category) {
        int next = 1;
        String expectedLabel = (category == null ? DungeonFeatureCategory.CURIOSITY : category).label();
        for (DungeonFeature feature : features == null ? List.<DungeonFeature>of() : features) {
            if (feature == null || feature.name() == null) {
                continue;
            }
            Matcher matcher = DEFAULT_FEATURE_NAME.matcher(feature.name().trim());
            if (matcher.matches() && expectedLabel.equals(matcher.group(1))) {
                next = Math.max(next, Integer.parseInt(matcher.group(2)) + 1);
            }
        }
        return next;
    }

    private static Map<Long, DungeonFeature> featuresById(List<DungeonFeature> features) {
        Map<Long, DungeonFeature> result = new HashMap<>();
        for (DungeonFeature feature : features) {
            result.put(feature.featureId(), feature);
        }
        return result;
    }

    private static Map<String, DungeonFeatureTile> featureTilesByCoord(List<DungeonFeatureTile> tiles) {
        Map<String, DungeonFeatureTile> result = new HashMap<>();
        for (DungeonFeatureTile tile : tiles) {
            result.put(TopologyWorkspace.coordKey(tile.x(), tile.y()), tile);
        }
        return result;
    }

    private static Map<Long, Integer> featureSquareCounts(List<DungeonFeatureTile> tiles) {
        Map<Long, Integer> result = new HashMap<>();
        for (DungeonFeatureTile tile : tiles) {
            result.merge(tile.featureId(), 1, Integer::sum);
        }
        return result;
    }

    private static List<DungeonSquare> toSyntheticSquares(List<DungeonFeatureTile> tiles, long mapId) {
        List<DungeonSquare> result = new ArrayList<>();
        for (DungeonFeatureTile tile : tiles) {
            result.add(new DungeonSquare(
                    tile.squareId(),
                    mapId,
                    tile.x(),
                    tile.y(),
                    tile.featureId(),
                    null,
                    null,
                    null));
        }
        return result;
    }

    private static Map<String, DungeonSquare> squaresByCoord(List<DungeonSquare> squares) {
        Map<String, DungeonSquare> result = new HashMap<>();
        for (DungeonSquare square : squares) {
            result.put(TopologyWorkspace.coordKey(square.x(), square.y()), square);
        }
        return result;
    }
}
