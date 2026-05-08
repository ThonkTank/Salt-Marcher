package src.domain.travel.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;

public final class TravelDungeonMapDataProjector {

    private TravelDungeonMapDataProjector() {
    }

    public static ApplyTravelDungeonSessionUseCase.MapData toInternalMap(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new ApplyTravelDungeonSessionUseCase.MapData(
                ApplyTravelDungeonSessionUseCase.GridTopology.fromName(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonMapDataProjector::toInternalArea).toList(),
                safeMap.boundaries().stream().map(TravelDungeonMapDataProjector::toInternalBoundary).toList(),
                safeMap.features().stream().map(TravelDungeonMapDataProjector::toInternalFeature).toList());
    }

    public static ApplyTravelDungeonSessionUseCase.AreaData toInternalArea(@Nullable DungeonAreaSnapshot area) {
        if (area == null) {
            return new ApplyTravelDungeonSessionUseCase.AreaData(
                    ApplyTravelDungeonSessionUseCase.AreaKind.ROOM,
                    1L,
                    "ROOM",
                    List.of());
        }
        return new ApplyTravelDungeonSessionUseCase.AreaData(
                ApplyTravelDungeonSessionUseCase.AreaKind.valueOf(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(TravelDungeonMapDataProjector::toInternalCell).toList());
    }

    public static ApplyTravelDungeonSessionUseCase.BoundaryData toInternalBoundary(
            @Nullable DungeonBoundarySnapshot boundary
    ) {
        if (boundary == null) {
            return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                    false,
                    1L,
                    "wall",
                    new ApplyTravelDungeonSessionUseCase.EdgeData(
                            new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0),
                            new ApplyTravelDungeonSessionUseCase.CellData(0, 0, 0)));
        }
        return new ApplyTravelDungeonSessionUseCase.BoundaryData(
                "door".equalsIgnoreCase(boundary.kind()),
                boundary.id(),
                boundary.label(),
                new ApplyTravelDungeonSessionUseCase.EdgeData(
                        toInternalCell(boundary.edge().from()),
                        toInternalCell(boundary.edge().to())));
    }

    public static ApplyTravelDungeonSessionUseCase.FeatureData toInternalFeature(
            @Nullable DungeonFeatureSnapshot feature
    ) {
        if (feature == null) {
            return new ApplyTravelDungeonSessionUseCase.FeatureData(
                    ApplyTravelDungeonSessionUseCase.FeatureKind.STAIR,
                    1L,
                    "STAIR",
                    List.of(),
                    "",
                    "");
        }
        return new ApplyTravelDungeonSessionUseCase.FeatureData(
                ApplyTravelDungeonSessionUseCase.FeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelDungeonMapDataProjector::toInternalCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    public static ApplyTravelDungeonSessionUseCase.CellData toInternalCell(@Nullable DungeonCellRef cell) {
        return new ApplyTravelDungeonSessionUseCase.CellData(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }
}
