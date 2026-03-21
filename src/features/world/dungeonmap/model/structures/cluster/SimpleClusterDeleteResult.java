package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.List;

public sealed interface SimpleClusterDeleteResult permits SimpleClusterDeleteResult.Unchanged,
        SimpleClusterDeleteResult.Deleted,
        SimpleClusterDeleteResult.Reduced,
        SimpleClusterDeleteResult.Split {

    record Unchanged() implements SimpleClusterDeleteResult {
    }

    record Deleted() implements SimpleClusterDeleteResult {
    }

    record Reduced(
            TileShape clusterShape,
            Point2i roomAnchor
    ) implements SimpleClusterDeleteResult {
    }

    record Split(
            List<SimpleClusterFragment> fragments
    ) implements SimpleClusterDeleteResult {
        public Split {
            fragments = fragments == null ? List.of() : List.copyOf(fragments);
        }
    }
}
