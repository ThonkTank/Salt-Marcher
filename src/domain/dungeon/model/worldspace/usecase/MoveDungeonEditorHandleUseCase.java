package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.model.worldspace.DungeonEditorHandleType;
import src.domain.dungeon.model.worldspace.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class MoveDungeonEditorHandleUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public MoveDungeonEditorHandleUseCase(
            DungeonEditorSessionWorkflow workflow,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(HandleMoveInput input) {
        HandleMoveInput safeInput = input == null ? HandleMoveInput.empty() : input;
        if (!workflow.session().hasSelectedMap()) {
            return;
        }
        Optional<DungeonEditorWorkspaceValues.HandleRef> inputHandleRef = safeInput.handleRef();
        if (inputHandleRef.isEmpty()) {
            return;
        }
        DungeonEditorWorkspaceValues.HandleRef handleRef = inputHandleRef.orElseThrow();
        DungeonEditorWorkspaceValues.Cell sourceCell = handleRef.cell();
        int deltaQ = safeInput.targetQ() - sourceCell.q();
        int deltaR = safeInput.targetR() - sourceCell.r();
        int deltaLevel = 0;
        if (deltaQ == 0 && deltaR == 0) {
            return;
        }
        effectUseCase.applyEffect(DungeonEditorMainViewEffect.apply(
                new DungeonEditorSessionValues.MoveHandlePreview(
                        handleRef,
                        deltaQ,
                        deltaR,
                        deltaLevel)));
    }

    public record HandleMoveInput(
            String handleKindName,
            String topologyKindName,
            long topologyId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            int sourceQ,
            int sourceR,
            int sourceLevel,
            String direction,
            int targetQ,
            int targetR
    ) {
        public HandleMoveInput {
            handleKindName = handleKindName == null ? "" : handleKindName;
            topologyKindName = topologyKindName == null ? "" : topologyKindName;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            direction = direction == null ? "" : direction;
        }

        static HandleMoveInput empty() {
            return new HandleMoveInput("", "", 0L, 0L, 0L, 0L, 0L, 0, 0, 0, 0, "", 0, 0);
        }

        private Optional<DungeonEditorWorkspaceValues.HandleRef> handleRef() {
            Optional<DungeonEditorHandleType> handleKind = handleKind();
            Optional<DungeonTopologyRef> ref = topologyRef();
            if (handleKind.isEmpty() || ref.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(new DungeonEditorWorkspaceValues.HandleRef(
                    handleKind.orElseThrow(),
                    ref.orElseThrow(),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    index,
                    new DungeonEditorWorkspaceValues.Cell(sourceQ, sourceR, sourceLevel),
                    direction));
        }

        private Optional<DungeonEditorHandleType> handleKind() {
            return switch (handleKindName) {
                case "CLUSTER_LABEL" -> Optional.of(DungeonEditorHandleType.CLUSTER_LABEL);
                case "CLUSTER_CORNER" -> Optional.of(DungeonEditorHandleType.CLUSTER_CORNER);
                case "DOOR" -> Optional.of(DungeonEditorHandleType.DOOR);
                case "CORRIDOR_ANCHOR" -> Optional.of(DungeonEditorHandleType.CORRIDOR_ANCHOR);
                case "CORRIDOR_WAYPOINT" -> Optional.of(DungeonEditorHandleType.CORRIDOR_WAYPOINT);
                case "STAIR_ANCHOR" -> Optional.of(DungeonEditorHandleType.STAIR_ANCHOR);
                default -> Optional.empty();
            };
        }

        private Optional<DungeonTopologyRef> topologyRef() {
            Optional<DungeonTopologyElementKind> kind = topologyKind();
            if (kind.isEmpty() || kind.orElseThrow() == DungeonTopologyElementKind.EMPTY || topologyId == 0L) {
                return Optional.empty();
            }
            return Optional.of(new DungeonTopologyRef(kind.orElseThrow(), topologyId));
        }

        private Optional<DungeonTopologyElementKind> topologyKind() {
            return switch (topologyKindName) {
                case "EMPTY" -> Optional.of(DungeonTopologyElementKind.EMPTY);
                case "ROOM" -> Optional.of(DungeonTopologyElementKind.ROOM);
                case "CORRIDOR" -> Optional.of(DungeonTopologyElementKind.CORRIDOR);
                case "CORRIDOR_ANCHOR" -> Optional.of(DungeonTopologyElementKind.CORRIDOR_ANCHOR);
                case "DOOR" -> Optional.of(DungeonTopologyElementKind.DOOR);
                case "WALL" -> Optional.of(DungeonTopologyElementKind.WALL);
                case "STAIR" -> Optional.of(DungeonTopologyElementKind.STAIR);
                case "TRANSITION" -> Optional.of(DungeonTopologyElementKind.TRANSITION);
                default -> Optional.empty();
            };
        }
    }
}
