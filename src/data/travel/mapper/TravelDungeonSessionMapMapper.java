package src.data.travel.mapper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;

public final class TravelDungeonSessionMapMapper {

    private TravelDungeonSessionMapMapper() {
    }

    public static ApplyTravelDungeonSessionUseCase.MapData toInternalMap(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new ApplyTravelDungeonSessionUseCase.MapData(
                ApplyTravelDungeonSessionUseCase.GridTopology.fromName(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonSessionMapMapper::toInternalArea).toList(),
                safeMap.boundaries().stream().map(TravelDungeonSessionMapMapper::toInternalBoundary).toList(),
                safeMap.features().stream().map(TravelDungeonSessionMapMapper::toInternalFeature).toList());
    }

    private static ApplyTravelDungeonSessionUseCase.AreaData toInternalArea(@Nullable DungeonAreaSnapshot area) {
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
                area.cells().stream().map(TravelDungeonSessionMapMapper::toInternalCell).toList());
    }

    private static ApplyTravelDungeonSessionUseCase.BoundaryData toInternalBoundary(
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

    private static ApplyTravelDungeonSessionUseCase.FeatureData toInternalFeature(
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
                feature.cells().stream().map(TravelDungeonSessionMapMapper::toInternalCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static ApplyTravelDungeonSessionUseCase.CellData toInternalCell(@Nullable DungeonCellRef cell) {
        return new ApplyTravelDungeonSessionUseCase.CellData(
                cell == null ? 0 : cell.q(),
                cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level());
    }
}
