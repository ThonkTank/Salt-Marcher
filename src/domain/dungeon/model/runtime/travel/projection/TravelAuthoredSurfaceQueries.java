package src.domain.dungeon.model.runtime.travel.projection;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface.CorridorConnection;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface.RoomNarration;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AreaKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.FeatureKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.FeatureData;

final class TravelAuthoredSurfaceQueries {

    private TravelAuthoredSurfaceQueries() {
    }

    static boolean contains(TravelAuthoredSurface surface, Cell cell) {
        return areaAt(surface, cell) != null || travelFeatureAt(surface, cell) != null;
    }

    static TravelAuthoredSurface.Transition deterministicEntryTransition(TravelAuthoredSurface surface) {
        TravelAuthoredSurface.Transition result = null;
        for (TravelAuthoredSurface.Transition transition : surface.transitions()) {
            Cell anchor = transition.anchor();
            if (anchor == null || !contains(surface, anchor)) {
                continue;
            }
            if (result == null || transition.transitionId() < result.transitionId()) {
                result = transition;
            }
        }
        return result;
    }

    static @Nullable Cell firstCell(TravelAuthoredSurface surface) {
        Cell first = null;
        for (AreaData area : surface.map().areas()) {
            first = firstCell(first, area.cells());
        }
        for (FeatureData feature : surface.map().features()) {
            first = firstCell(first, feature.cells());
        }
        return first;
    }

    static @Nullable AreaData areaAt(TravelAuthoredSurface surface, Cell cell) {
        if (cell == null) {
            return null;
        }
        for (AreaData area : surface.map().areas()) {
            if (area.cells().contains(cell)) {
                return area;
            }
        }
        return null;
    }

    static @Nullable FeatureData travelFeatureAt(TravelAuthoredSurface surface, Cell cell) {
        if (cell == null) {
            return null;
        }
        for (FeatureData feature : surface.map().features()) {
            if (isTravelFeature(feature) && feature.cells().contains(cell)) {
                return feature;
            }
        }
        return null;
    }

    static AreaData areaById(TravelAuthoredSurface surface, long areaId) {
        for (AreaData area : surface.map().areas()) {
            if (area.id() == areaId) {
                return area;
            }
        }
        return new AreaData(AreaKind.ROOM,
                0L,
                "",
                List.of(),
                DungeonTopologyRef.empty());
    }

    static List<String> corridorTargetLabels(TravelAuthoredSurface surface, AreaData activeArea, long corridorId) {
        Set<String> labels = new LinkedHashSet<>();
        for (CorridorConnection connection : surface.content().connections()) {
            if (connection.corridorId() != corridorId || connection.roomId() == activeArea.id()) {
                continue;
            }
            AreaData room = areaById(surface, connection.roomId());
            if (room.kind().equals(AreaKind.ROOM)) {
                labels.add(room.label());
            }
        }
        return List.copyOf(labels);
    }

    static String narratedExit(
            TravelAuthoredSurface surface,
            AreaData activeArea,
            Cell sourceTile,
            @Nullable Direction direction
    ) {
        if (activeArea == null || !activeArea.kind().equals(AreaKind.ROOM)) {
            return "";
        }
        for (RoomNarration roomNarration : surface.content().roomNarrations()) {
            if (roomNarration.roomId() == activeArea.id()) {
                return roomNarration.exitDescription(sourceTile, direction);
            }
        }
        return "";
    }

    private static boolean isTravelFeature(FeatureData feature) {
        return feature.kind().equals(FeatureKind.STAIR) || feature.kind().equals(FeatureKind.TRANSITION);
    }

    private static @Nullable Cell firstCell(@Nullable Cell current, List<Cell> candidates) {
        Cell result = current;
        for (Cell cell : candidates == null ? List.<Cell>of() : candidates) {
            if (cell != null && (result == null || compareCells(cell, result) < 0)) {
                result = cell;
            }
        }
        return result;
    }

    private static int compareCells(Cell left, Cell right) {
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.r(), right.r());
        return rowComparison != 0 ? rowComparison : Integer.compare(left.q(), right.q());
    }
}
