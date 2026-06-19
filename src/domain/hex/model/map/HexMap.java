package src.domain.hex.model.map;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public record HexMap(
        HexMapIdentity mapId,
        String displayName,
        int radius,
        Map<HexCoordinate, HexTerrain> terrainOverrides,
        List<HexMarker> markers
) {

    private static final HexTerrain DEFAULT_TERRAIN = HexTerrain.GRASSLAND;
    private static final int MAX_RADIUS = 99;

    public HexMap {
        mapId = Objects.requireNonNull(mapId, "mapId");
        displayName = normalizeName(displayName);
        if (radius < 0) {
            throw new IllegalArgumentException("Hex map radius must be nonnegative.");
        }
        if (radius > MAX_RADIUS) {
            throw new IllegalArgumentException("Hex map radius must be at most " + MAX_RADIUS + ".");
        }
        terrainOverrides = copyValidTerrain(radius, terrainOverrides);
        markers = copyValidMarkers(radius, markers);
    }

    public static HexMap create(HexMapIdentity mapId, String displayName, int radius) {
        return new HexMap(mapId, displayName, radius, Map.of(), List.of());
    }

    public static int maxRadius() {
        return MAX_RADIUS;
    }

    public List<HexCoordinate> coordinates() {
        List<HexCoordinate> coordinates = new ArrayList<>();
        for (int q = -radius; q <= radius; q++) {
            for (int r = -radius; r <= radius; r++) {
                HexCoordinate coordinate = new HexCoordinate(q, r);
                if (coordinate.insideRadius(radius)) {
                    coordinates.add(coordinate);
                }
            }
        }
        coordinates.sort(Comparator.comparingInt(HexCoordinate::q).thenComparingInt(HexCoordinate::r));
        return List.copyOf(coordinates);
    }

    public HexTerrain terrainAt(HexCoordinate coordinate) {
        requireInside(coordinate);
        return terrainOverrides.getOrDefault(coordinate, DEFAULT_TERRAIN);
    }

    @Override
    public Map<HexCoordinate, HexTerrain> terrainOverrides() {
        return Map.copyOf(terrainOverrides);
    }

    @Override
    public List<HexMarker> markers() {
        return List.copyOf(markers);
    }

    public boolean wouldRemoveAuthoredData(int nextRadius) {
        if (nextRadius >= radius) {
            return false;
        }
        return terrainOverrides.keySet().stream().anyMatch(coordinate -> !coordinate.insideRadius(nextRadius))
                || markers.stream().map(HexMarker::coordinate).anyMatch(coordinate -> !coordinate.insideRadius(nextRadius));
    }

    public HexMap updateMetadata(String nextDisplayName, int nextRadius) {
        return new HexMap(mapId, nextDisplayName, nextRadius, terrainOverrides, markers);
    }

    public HexMap paintTerrain(HexCoordinate coordinate, HexTerrain terrain) {
        requireInside(coordinate);
        HexTerrain safeTerrain = terrain == null ? DEFAULT_TERRAIN : terrain;
        Map<HexCoordinate, HexTerrain> nextTerrain = new LinkedHashMap<>(terrainOverrides);
        if (safeTerrain == DEFAULT_TERRAIN) {
            nextTerrain.remove(coordinate);
        } else {
            nextTerrain.put(coordinate, safeTerrain);
        }
        return new HexMap(mapId, displayName, radius, nextTerrain, markers);
    }

    public HexMap saveMarker(
            HexMarkerIdentity markerId,
            HexCoordinate coordinate,
            String name,
            HexMarkerKind type,
            String note
    ) {
        requireInside(coordinate);
        HexMarker nextMarker = new HexMarker(markerId, coordinate, name, type, note);
        List<HexMarker> nextMarkers = new ArrayList<>();
        boolean replaced = false;
        for (HexMarker marker : markers) {
            if (marker.markerId().equals(markerId)) {
                nextMarkers.add(nextMarker);
                replaced = true;
            } else {
                nextMarkers.add(marker);
            }
        }
        if (!replaced) {
            nextMarkers.add(nextMarker);
        }
        return new HexMap(mapId, displayName, radius, terrainOverrides, nextMarkers);
    }

    public void requireInside(HexCoordinate coordinate) {
        Objects.requireNonNull(coordinate, "coordinate");
        if (!coordinate.insideRadius(radius)) {
            throw new IllegalArgumentException("Hex coordinate is outside the map radius.");
        }
    }

    private static Map<HexCoordinate, HexTerrain> copyValidTerrain(
            int radius,
            Map<HexCoordinate, HexTerrain> terrainOverrides
    ) {
        if (terrainOverrides == null || terrainOverrides.isEmpty()) {
            return Map.of();
        }
        Map<HexCoordinate, HexTerrain> validTerrain = new LinkedHashMap<>();
        terrainOverrides.forEach((coordinate, terrain) -> {
            HexCoordinate safeCoordinate = Objects.requireNonNull(coordinate, "coordinate");
            if (safeCoordinate.insideRadius(radius)) {
                validTerrain.put(safeCoordinate, terrain == null ? DEFAULT_TERRAIN : terrain);
            }
        });
        return Map.copyOf(validTerrain);
    }

    private static List<HexMarker> copyValidMarkers(int radius, List<HexMarker> markers) {
        if (markers == null || markers.isEmpty()) {
            return List.of();
        }
        return markers.stream()
                .filter(marker -> marker.coordinate().insideRadius(radius))
                .sorted(Comparator.comparing(marker -> marker.markerId().value()))
                .toList();
    }

    private static String normalizeName(String displayName) {
        String normalized = displayName == null ? "" : displayName.trim();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Hex map name must be nonblank.");
        }
        return normalized;
    }
}
