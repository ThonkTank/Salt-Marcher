package features.world.dungeonmap.service.topology;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class PreferredRoomSelector {

    private PreferredRoomSelector() {
    }

    static Long selectPreferredRoomId(
            List<Long> candidateRoomIds,
            Map<Long, Integer> roomSquareCounts,
            TopologyIntent intent
    ) {
        if (candidateRoomIds == null || candidateRoomIds.isEmpty()) {
            return null;
        }
        Map<Long, Integer> preferredOrder = preferredOrder(intent);
        Long selected = null;
        for (Long roomId : candidateRoomIds) {
            if (roomId == null) {
                continue;
            }
            if (selected == null) {
                selected = roomId;
                continue;
            }
            int selectedOrder = preferredOrder.getOrDefault(selected, Integer.MAX_VALUE);
            int candidateOrder = preferredOrder.getOrDefault(roomId, Integer.MAX_VALUE);
            if (candidateOrder < selectedOrder) {
                selected = roomId;
                continue;
            }
            if (candidateOrder == selectedOrder) {
                int selectedCount = roomSquareCounts.getOrDefault(selected, 0);
                int candidateCount = roomSquareCounts.getOrDefault(roomId, 0);
                if (candidateCount > selectedCount || candidateCount == selectedCount && roomId < selected) {
                    selected = roomId;
                }
            }
        }
        return selected;
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
