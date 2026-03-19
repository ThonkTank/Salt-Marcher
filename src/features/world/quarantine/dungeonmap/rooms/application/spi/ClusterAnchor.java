package features.world.quarantine.dungeonmap.rooms.application.spi;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

public record ClusterAnchor(long clusterId, Point2i center) {
}
