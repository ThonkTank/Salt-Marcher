package src.data.travel.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.CellData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.EdgeData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.travel.model.session.model.TravelDungeonSessionValues.AreaKind;
import src.domain.travel.model.session.model.TravelDungeonSessionValues.FeatureKind;
import src.domain.travel.model.session.model.TravelDungeonSessionValues.GridTopology;

public final class TravelDungeonSessionMapMapper {

    private TravelDungeonSessionMapMapper() {
    }

    public static MapData toInternalMap(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new MapData(
                GridTopology.fromName(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonSessionMapMapper::toInternalArea).toList(),
                safeMap.boundaries().stream().map(TravelDungeonSessionMapMapper::toInternalBoundary).toList(),
                safeMap.features().stream().map(TravelDungeonSessionMapMapper::toInternalFeature).toList());
    }

    private static AreaData toInternalArea(@Nullable DungeonAreaSnapshot area) {
        if (area == null) {
            return new AreaData(
                    AreaKind.ROOM,
                    1L,
                    "ROOM",
                    List.of());
        }
        return new AreaData(
                AreaKind.valueOf(area.kind().name()),
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
                    new EdgeData(
                            new CellData(0, 0, 0),
                            new CellData(0, 0, 0)));
        }
        return new BoundaryData(
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.id(),
                boundary.label(),
                new EdgeData(
                        toInternalCell(boundary.edge().from()),
                        toInternalCell(boundary.edge().to())));
    }

    private static FeatureData toInternalFeature(@Nullable DungeonFeatureSnapshot feature) {
        if (feature == null) {
            return new FeatureData(
                    FeatureKind.STAIR,
                    1L,
                    "STAIR",
                    List.of(),
                    "",
                    "");
        }
        return new FeatureData(
                FeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelDungeonSessionMapMapper::toInternalCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static CellData toInternalCell(@Nullable DungeonCellRef cell) {
        return new CellData(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }
}
