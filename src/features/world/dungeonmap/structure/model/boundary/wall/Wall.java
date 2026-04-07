package features.world.dungeonmap.structure.model.boundary.wall;

import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridTranslation;
import features.world.dungeonmap.structure.model.boundary.BoundaryObject;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class Wall extends BoundaryObject {

    private final WallKind wallKind;

    private Wall(Long wallId, GridBoundary boundary, GridSegment anchorSegment, WallKind wallKind) {
        super(wallId, boundary, anchorSegment);
        this.wallKind = wallKind == null ? WallKind.solid() : wallKind;
    }

    public static Wall fromSegments(Collection<GridSegment> segments) {
        return new Wall(null, GridBoundary.of(segments), null, WallKind.solid());
    }

    public static Wall fromSegments(
            Long wallId,
            Collection<GridSegment> segments,
            GridSegment anchorSegment,
            WallKind wallKind
    ) {
        return new Wall(wallId, GridBoundary.of(segments), anchorSegment, wallKind);
    }

    public static Wall fromBoundary(GridBoundary boundary) {
        return new Wall(null, boundary, null, WallKind.solid());
    }

    public static Wall fromBoundary(Long wallId, GridBoundary boundary, GridSegment anchorSegment, WallKind wallKind) {
        return new Wall(wallId, boundary, anchorSegment, wallKind);
    }

    public Long wallId() {
        return objectId();
    }

    public GridSegment anchorSegment() {
        return anchorSegmentInternal();
    }

    public WallKind wallKind() {
        return wallKind;
    }

    public Wall movedBy(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return resolvedTranslation.isZero()
                ? this
                : new Wall(wallId(), GridBoundary.of(translatedBoundarySegments(resolvedTranslation)),
                translatedAnchorSegment(resolvedTranslation), wallKind);
    }

    public Wall movedBy(GridPoint delta) {
        if (delta == null) {
            return this;
        }
        return movedBy(new GridTranslation(delta.x(), delta.y(), delta.z()));
    }

    public Wall withWallId(Long wallId) {
        return Objects.equals(wallId(), wallId)
                ? this
                : new Wall(wallId, GridBoundary.of(orderedBoundarySegments()), anchorSegment(), wallKind);
    }

    public Wall withWallKind(WallKind wallKind) {
        WallKind resolvedWallKind = wallKind == null ? WallKind.solid() : wallKind;
        return Objects.equals(this.wallKind, resolvedWallKind)
                ? this
                : new Wall(wallId(), GridBoundary.of(orderedBoundarySegments()), anchorSegment(), resolvedWallKind);
    }

    public Wall clippedToBoundary(Collection<GridSegment> boundarySegments) {
        GridBoundary clippedBoundary = clippedBoundary(boundarySegments);
        return clippedBoundary.isEmpty()
                ? null
                : Wall.fromBoundary(wallId(), clippedBoundary, repairedAnchorSegment(clippedBoundary), wallKind);
    }

    public List<Wall> withoutBoundarySegments(Collection<GridSegment> removedBoundarySegments) {
        List<GridBoundary> components = remainingBoundaryComponents(removedBoundarySegments);
        if (components.isEmpty()) {
            return List.of();
        }
        int idRetainingIndex = retainingComponentIndex(components, anchorSegment());
        ArrayList<Wall> result = new ArrayList<>();
        for (int index = 0; index < components.size(); index++) {
            GridBoundary component = components.get(index);
            result.add(Wall.fromBoundary(
                    index == idRetainingIndex ? wallId() : null,
                    component,
                    repairedAnchorSegment(component),
                    wallKind));
        }
        result.sort(Comparator.comparing(Wall::anchorSegment, GridSegment.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public static List<Wall> fromBoundaryComponents(Collection<GridSegment> boundarySegments, WallKind wallKind) {
        ArrayList<Wall> result = new ArrayList<>();
        for (GridBoundary component : boundaryComponents(boundarySegments)) {
            if (!component.isEmpty()) {
                GridSegment anchorSegment = component.segments().stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
                result.add(Wall.fromBoundary(null, component, anchorSegment, wallKind));
            }
        }
        result.sort(Comparator.comparing(Wall::anchorSegment, GridSegment.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public boolean blocksPassage() {
        return wallKind.blocksPassage();
    }

    public boolean blocksSight() {
        return wallKind.blocksSight();
    }

    public boolean supportsDoorAttachments() {
        return wallKind.supportsDoorAttachments();
    }

    private static int retainingComponentIndex(List<GridBoundary> components, GridSegment preferredAnchorSegment) {
        for (int index = 0; index < components.size(); index++) {
            if (preferredAnchorSegment != null && components.get(index).contains(preferredAnchorSegment)) {
                return index;
            }
        }
        return 0;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Wall wall)) {
            return false;
        }
        return sameBaseState(wall) && Objects.equals(wallKind, wall.wallKind);
    }

    @Override
    public int hashCode() {
        return Objects.hash(baseHashCode(), wallKind);
    }
}
