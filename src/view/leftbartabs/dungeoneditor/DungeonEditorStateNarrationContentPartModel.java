package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorStatePanelRoomNarrationDrafts;

final class DungeonEditorStateNarrationContentPartModel {

    List<DungeonEditorStateContentModel.RoomNarrationCardProjection> narrationCards(
            @Nullable DungeonInspectorSnapshot inspector,
            DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts narrationDrafts
    ) {
        DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts safeDrafts = narrationDrafts == null
                ? DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty()
                : narrationDrafts;
        Map<Long, DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft> roomDrafts = safeDrafts.rooms().stream()
                .collect(java.util.stream.Collectors.toMap(
                        DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft::roomId,
                        draft -> draft,
                        (first, second) -> second));
        if (inspector == null) {
            return List.of();
        }
        return inspector.roomNarrations().stream()
                .map(card -> narrationCard(card, roomDrafts.get(card.roomId())))
                .toList();
    }

    DungeonEditorStateContentModel.@Nullable RoomNarrationCardProjection currentNarrationCard(
            DungeonEditorStateContentModel.StateProjection projection,
            long roomId
    ) {
        DungeonEditorStateContentModel.StateProjection safeProjection = projection == null
                ? DungeonEditorStateContentModel.StateProjection.initial()
                : projection;
        for (DungeonEditorStateContentModel.RoomNarrationCardProjection card : safeProjection.narrationCards()) {
            if (card.roomId() == roomId) {
                return card;
            }
        }
        return null;
    }

    String renderStructureKey(
            List<DungeonEditorStateContentModel.RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText
    ) {
        StringBuilder key = new StringBuilder();
        key.append(busy).append('|').append(statusText == null ? "" : statusText);
        for (DungeonEditorStateContentModel.RoomNarrationCardProjection card
                : cards == null ? List.<DungeonEditorStateContentModel.RoomNarrationCardProjection>of() : cards) {
            key.append("|room=").append(card.roomId()).append(':').append(card.roomName());
            for (DungeonEditorStateContentModel.RoomExitNarrationProjection exit : card.exits()) {
                key.append("|exit=")
                        .append(exit.label())
                        .append('@')
                        .append(exit.q())
                        .append(',')
                        .append(exit.r())
                        .append(',')
                        .append(exit.level())
                        .append(':')
                        .append(exit.direction());
            }
        }
        return key.toString();
    }

    private static DungeonEditorStateContentModel.RoomNarrationCardProjection narrationCard(
            DungeonInspectorSnapshot.RoomNarrationCard card,
            DungeonEditorStatePanelRoomNarrationDrafts.RoomDraft roomDraft
    ) {
        Map<RoomExitKey, DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft> exitDrafts = roomDraft == null
                ? Map.of()
                : roomDraft.exits().stream()
                .collect(java.util.stream.Collectors.toMap(
                        RoomExitKey::from,
                        draft -> draft,
                        (first, second) -> second));
        return new DungeonEditorStateContentModel.RoomNarrationCardProjection(
                card.roomId(),
                card.roomName(),
                roomDraft != null && roomDraft.visualPresent()
                        ? roomDraft.visualDescription()
                        : card.visualDescription(),
                card.exits().stream()
                        .map(exit -> narrationExit(exit, exitDrafts.get(RoomExitKey.from(exit))))
                        .toList());
    }

    private static DungeonEditorStateContentModel.RoomExitNarrationProjection narrationExit(
            DungeonInspectorSnapshot.RoomExitNarration exit,
            DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft exitDraft
    ) {
        return new DungeonEditorStateContentModel.RoomExitNarrationProjection(
                exit.label(),
                exit.cell().q(),
                exit.cell().r(),
                exit.cell().level(),
                exit.direction(),
                exitDraft != null && exitDraft.present()
                        ? exitDraft.description()
                        : exit.description());
    }

    private record RoomExitKey(
            String label,
            int q,
            int r,
            int level,
            String direction
    ) {
        RoomExitKey {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
        }

        static RoomExitKey from(DungeonInspectorSnapshot.RoomExitNarration exit) {
            if (exit == null || exit.cell() == null) {
                return new RoomExitKey("", 0, 0, 0, "");
            }
            return new RoomExitKey(
                    exit.label(),
                    exit.cell().q(),
                    exit.cell().r(),
                    exit.cell().level(),
                    exit.direction());
        }

        static RoomExitKey from(DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft exit) {
            DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft safeExit = exit == null
                    ? new DungeonEditorStatePanelRoomNarrationDrafts.ExitDraft("", 0, 0, 0, "", "", false)
                    : exit;
            return new RoomExitKey(
                    safeExit.label(),
                    safeExit.q(),
                    safeExit.r(),
                    safeExit.level(),
                    safeExit.direction());
        }
    }
}
