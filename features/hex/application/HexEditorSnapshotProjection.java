package features.hex.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexEditorMode;
import features.hex.domain.map.HexEditorState;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexTerrain;
import features.hex.api.HexEditorSnapshot;
import features.hex.api.HexMapId;
import features.hex.api.HexMarkerId;

final class HexEditorSnapshotProjection {

    private HexEditorSnapshotProjection() {
    }

    static HexEditorSnapshot project(HexEditorState state) {
        Optional<HexMap> selectedMap = state.selectedMap();
        if (selectedMap.isEmpty()) {
            return new HexEditorSnapshot(
                    state.catalog().stream().map(HexEditorSnapshotProjection::summary).toList(),
                    Optional.empty(),
                    List.of(),
                    Optional.empty(),
                    tool(state.activeMode()),
                    terrain(state.activeTerrain()),
                    state.statusText(),
                    state.failureText(),
                    state.warningText());
        }
        HexMap map = selectedMap.get();
        List<HexCoordinate> coordinates = map.coordinates();
        Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> markersByCoordinate =
                markerSnapshotsByCoordinate(map);
        return new HexEditorSnapshot(
                state.catalog().stream().map(HexEditorSnapshotProjection::summary).toList(),
                Optional.of(mapSnapshot(map, coordinates.size())),
                tiles(map, state.selectedTile(), coordinates, markersByCoordinate),
                selectedTile(map, state.selectedTile(), markersByCoordinate),
                tool(state.activeMode()),
                terrain(state.activeTerrain()),
                state.statusText(),
                state.failureText(),
                state.warningText());
    }

    private static HexEditorSnapshot.MapSummary summary(HexMapSummary summary) {
        return new HexEditorSnapshot.MapSummary(
                new HexMapId(summary.mapId().value()),
                summary.displayName(),
                summary.radius());
    }

    private static HexEditorSnapshot.MapSnapshot mapSnapshot(HexMap map, int tileCount) {
        return new HexEditorSnapshot.MapSnapshot(
                new HexMapId(map.mapId().value()),
                map.displayName(),
                map.radius(),
                tileCount);
    }

    private static List<HexEditorSnapshot.TileSnapshot> tiles(
            HexMap map,
            Optional<HexCoordinate> selectedTile,
            List<HexCoordinate> coordinates,
            Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> markersByCoordinate
    ) {
        return coordinates.stream()
                .map(coordinate -> new HexEditorSnapshot.TileSnapshot(
                        coordinate.q(),
                        coordinate.r(),
                        terrain(map.terrainAt(coordinate)),
                        selectedTile.map(coordinate::equals).orElse(false),
                        markersByCoordinate.getOrDefault(coordinate, List.of())))
                .toList();
    }

    private static Optional<HexEditorSnapshot.TileDetails> selectedTile(
            HexMap map,
            Optional<HexCoordinate> selectedTile,
            Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> markersByCoordinate
    ) {
        if (selectedTile.isEmpty()) {
            return Optional.empty();
        }
        HexCoordinate coordinate = selectedTile.get();
        return Optional.of(new HexEditorSnapshot.TileDetails(
                coordinate.q(),
                coordinate.r(),
                terrain(map.terrainAt(coordinate)),
                "",
                "",
                "",
                "",
                markersByCoordinate.getOrDefault(coordinate, List.of())));
    }

    private static Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> markerSnapshotsByCoordinate(HexMap map) {
        Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> grouped = new LinkedHashMap<>();
        map.markers().stream()
                .sorted(Comparator.comparing(marker -> marker.name().toLowerCase()))
                .forEach(marker -> addMarkerSnapshot(grouped, marker));
        grouped.replaceAll((ignored, markers) -> List.copyOf(markers));
        return Map.copyOf(grouped);
    }

    private static void addMarkerSnapshot(
            Map<HexCoordinate, List<HexEditorSnapshot.MarkerSnapshot>> grouped,
            HexMarker marker
    ) {
        grouped.computeIfAbsent(marker.coordinate(), ignored -> new ArrayList<>()).add(marker(marker));
    }

    private static HexEditorSnapshot.MarkerSnapshot marker(HexMarker marker) {
        return new HexEditorSnapshot.MarkerSnapshot(
                new HexMarkerId(marker.markerId().value()),
                marker.coordinate().q(),
                marker.coordinate().r(),
                marker.name(),
                marker.type().name(),
                marker.note());
    }

    private static String tool(HexEditorMode mode) {
        return mode == null ? HexEditorMode.defaultMode().name() : mode.name();
    }

    private static String terrain(HexTerrain terrain) {
        return terrain == null ? HexTerrain.defaultTerrain().name() : terrain.name();
    }
}
