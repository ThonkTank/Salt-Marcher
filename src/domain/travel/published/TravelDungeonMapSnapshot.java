package src.domain.travel.published;

import java.util.List;

public record TravelDungeonMapSnapshot(
        TopologyKind topology,
        int width,
        int height,
        List<TravelDungeonArea> areas,
        List<TravelDungeonBoundary> boundaries,
        List<TravelDungeonFeature> features
) {

    public TravelDungeonMapSnapshot {
        topology = topology == null ? TopologyKind.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
    }

    public static TravelDungeonMapSnapshot empty() {
        return new TravelDungeonMapSnapshot(TopologyKind.SQUARE, 1, 1, List.of(), List.of(), List.of());
    }

    public enum TopologyKind {
        SQUARE,
        HEX
    }
}
