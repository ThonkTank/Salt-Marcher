package features.world.dungeonmap.service.topology;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class TopologyEntitySelectionSupport {

    private TopologyEntitySelectionSupport() {
    }

    static Long selectPreferredEntityId(
            List<Long> candidateEntityIds,
            Map<Long, Integer> entitySquareCounts,
            TopologyIntent intent
    ) {
        if (candidateEntityIds == null || candidateEntityIds.isEmpty()) {
            return null;
        }
        Map<Long, Integer> preferredOrder = preferredOrder(intent);
        Long selected = null;
        for (Long entityId : candidateEntityIds) {
            if (entityId == null) {
                continue;
            }
            if (selected == null) {
                selected = entityId;
                continue;
            }
            int selectedOrder = preferredOrder.getOrDefault(selected, Integer.MAX_VALUE);
            int candidateOrder = preferredOrder.getOrDefault(entityId, Integer.MAX_VALUE);
            if (candidateOrder < selectedOrder) {
                selected = entityId;
                continue;
            }
            if (candidateOrder == selectedOrder) {
                int selectedCount = entitySquareCounts.getOrDefault(selected, 0);
                int candidateCount = entitySquareCounts.getOrDefault(entityId, 0);
                if (candidateCount > selectedCount || candidateCount == selectedCount && entityId < selected) {
                    selected = entityId;
                }
            }
        }
        return selected;
    }

    static Comparator<Long> mergeComparator(Map<Long, Integer> entitySquareCounts, TopologyIntent intent) {
        Map<Long, Integer> preferredOrder = preferredOrder(intent);
        return Comparator
                .comparingInt((Long entityId) -> preferredOrder.getOrDefault(entityId, Integer.MAX_VALUE))
                .thenComparing((Long entityId) -> -entitySquareCounts.getOrDefault(entityId, 0))
                .thenComparingLong(Long::longValue);
    }

    static Map<Long, Integer> preferredOrder(TopologyIntent intent) {
        Map<Long, Integer> order = new HashMap<>();
        if (intent == null) {
            return order;
        }
        List<Long> preferredPrimaryRoomIds = intent.primaryRoomPriority();
        for (int i = 0; i < preferredPrimaryRoomIds.size(); i++) {
            Long roomId = preferredPrimaryRoomIds.get(i);
            if (roomId != null) {
                order.putIfAbsent(roomId, i);
            }
        }
        return order;
    }
}
