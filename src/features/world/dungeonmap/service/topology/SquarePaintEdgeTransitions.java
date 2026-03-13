package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.PassageDirection;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class SquarePaintEdgeTransitions {

    private SquarePaintEdgeTransitions() {
    }

    static Set<EdgeRef> touchedEdges(List<DungeonSquarePaint> edits) {
        Set<EdgeRef> result = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : edits) {
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x() - 1, edit.y(), PassageDirection.EAST));
            result.add(new EdgeRef(edit.x(), edit.y(), PassageDirection.SOUTH));
            result.add(new EdgeRef(edit.x(), edit.y() - 1, PassageDirection.SOUTH));
        }
        return result;
    }
}
