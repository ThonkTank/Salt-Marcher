package src.data.travel.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonFeatureType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;

public final class TravelDungeonSessionMapMapper {

    private TravelDungeonSessionMapMapper() {
    }

    public static MapData toInternalMap(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new MapData(
                safeMap.topology() == null ? DungeonTopology.SQUARE : DungeonTopology.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonSessionMapMapper::toInternalArea).toList(),
                safeMap.boundaries().stream().map(TravelDungeonSessionMapMapper::toInternalBoundary).toList(),
                safeMap.features().stream().map(TravelDungeonSessionMapMapper::toInternalFeature).toList());
    }

    private static AreaData toInternalArea(@Nullable DungeonAreaSnapshot area) {
        if (area == null) {
            return new AreaData(
                    DungeonAreaType.ROOM,
                    1L,
                    "ROOM",
                    List.of());
        }
        return new AreaData(
                DungeonAreaType.valueOf(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(TravelDungeonSessionMapMapper::toInternalCell).toList());
    }

    private static BoundaryData toInternalBoundary(@Nullable DungeonBoundarySnapshot boundary) {
        if (boundary == null) {
            return new BoundaryData(
                    false,
                    1L,
                    "wall",
                    new DungeonEdge(
                            new DungeonCell(0, 0, 0),
                            new DungeonCell(0, 0, 0)));
        }
        return new BoundaryData(
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.id(),
                boundary.label(),
                new DungeonEdge(
                        toInternalCell(boundary.edge().from()),
                        toInternalCell(boundary.edge().to())));
    }

    private static FeatureData toInternalFeature(@Nullable DungeonFeatureSnapshot feature) {
        if (feature == null) {
            return new FeatureData(
                    DungeonFeatureType.STAIR,
                    1L,
                    "STAIR",
                    List.of(),
                    "",
                    "");
        }
        return new FeatureData(
                DungeonFeatureType.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelDungeonSessionMapMapper::toInternalCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static DungeonCell toInternalCell(@Nullable DungeonCellRef cell) {
        return new DungeonCell(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }
}
