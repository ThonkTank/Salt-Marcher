package src.domain.travel.published;

import java.util.List;

public record TravelDungeonSurface(
        ContextKind contextKind,
        String mapName,
        int revision,
        TravelDungeonMapSnapshot map,
        TravelDungeonPosition position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<TravelDungeonAction> actions
) {

    public TravelDungeonSurface {
        NormalizedSurface normalized = new NormalizedSurface(
                contextKind,
                mapName,
                revision,
                map,
                position,
                surfaceTitle,
                areaLabel,
                tileLabel,
                headingLabel,
                statusLabel,
                visualDescription,
                actions);
        contextKind = normalized.contextKind;
        mapName = normalized.mapName;
        revision = normalized.revision;
        map = normalized.map;
        position = normalized.position;
        surfaceTitle = normalized.surfaceTitle;
        areaLabel = normalized.areaLabel;
        tileLabel = normalized.tileLabel;
        headingLabel = normalized.headingLabel;
        statusLabel = normalized.statusLabel;
        visualDescription = normalized.visualDescription;
        actions = normalized.actions;
    }

    public enum ContextKind {
        DUNGEON,
        OVERWORLD
    }

    private static final class NormalizedSurface {

        private final ContextKind contextKind;
        private final String mapName;
        private final int revision;
        private final TravelDungeonMapSnapshot map;
        private final TravelDungeonPosition position;
        private final String surfaceTitle;
        private final String areaLabel;
        private final String tileLabel;
        private final String headingLabel;
        private final String statusLabel;
        private final String visualDescription;
        private final List<TravelDungeonAction> actions;

        private NormalizedSurface(
                ContextKind contextKind,
                String mapName,
                int revision,
                TravelDungeonMapSnapshot map,
                TravelDungeonPosition position,
                String surfaceTitle,
                String areaLabel,
                String tileLabel,
                String headingLabel,
                String statusLabel,
                String visualDescription,
                List<TravelDungeonAction> actions
        ) {
            String safeMapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
            this.contextKind = contextKind == null ? ContextKind.DUNGEON : contextKind;
            this.mapName = safeMapName;
            this.revision = Math.max(0, revision);
            this.map = map == null ? TravelDungeonMapSnapshot.empty() : map;
            this.position = position == null
                    ? new TravelDungeonPosition(
                    1L,
                    TravelDungeonPosition.LocationKind.TILE,
                    0L,
                    new TravelDungeonCell(0, 0, 0),
                    TravelDungeonPosition.Heading.SOUTH)
                    : position;
            this.surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? safeMapName : surfaceTitle.trim();
            this.areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
            this.tileLabel = tileLabel == null ? "" : tileLabel.trim();
            this.headingLabel = headingLabel == null ? "" : headingLabel.trim();
            this.statusLabel = statusLabel == null ? "" : statusLabel.trim();
            this.visualDescription = visualDescription == null ? "" : visualDescription.trim();
            this.actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }
}
