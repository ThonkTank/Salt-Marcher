package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Optional;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditCandidate;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditProjection;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditState;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditorPresentation;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.Viewport;

final class DungeonMapInlineLabelUiStateContentPartModel {
    private final ReadOnlyObjectWrapper<InlineLabelEditState> inlineLabelEditState =
            new ReadOnlyObjectWrapper<>(InlineLabelEditState.inactive());

    ReadOnlyObjectProperty<InlineLabelEditState> inlineLabelEditStateProperty() {
        return inlineLabelEditState.getReadOnlyProperty();
    }

    InlineLabelEditState currentInlineLabelEditState() {
        return inlineLabelEditState.get();
    }

    InlineLabelEditorPresentation currentInlineLabelEditorPresentation(Viewport viewport) {
        return presentationFrom(inlineLabelEditState.get(), viewport);
    }

    Optional<InlineLabelEditCandidate> inlineLabelEditCandidate(
            PointerTarget target,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels
    ) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (!safeTarget.isLabelTarget()) {
            return Optional.empty();
        }
        return labelForTarget(safeTarget, labels).map(label -> new InlineLabelEditCandidate(
                safeTarget,
                label.label(),
                label.q(),
                label.r(),
                DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelWidthScene(label),
                DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelHeightScene(label),
                label.rotationDegrees()));
    }

    void applyInlineLabelEditProjection(InlineLabelEditProjection projection) {
        inlineLabelEditState.set(stateFromProjection(projection));
    }

    private static Optional<DungeonMapContentModel.DungeonMapRenderState.Label> labelForTarget(
            PointerTarget target,
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels
    ) {
        List<DungeonMapContentModel.DungeonMapRenderState.Label> safeLabels =
                labels == null ? List.of() : labels;
        for (DungeonMapContentModel.DungeonMapRenderState.Label label : safeLabels) {
            if (sameLabelTarget(label, target)) {
                return Optional.of(label);
            }
        }
        return Optional.empty();
    }

    private static boolean sameLabelTarget(
            DungeonMapContentModel.DungeonMapRenderState.Label label,
            PointerTarget target
    ) {
        return label != null
                && target != null
                && label.ownerId() == target.ownerId()
                && label.clusterId() == target.clusterId()
                && DungeonMapContentModel.preparedRenderLabelKind(label.labelKind()) == target.labelKind()
                && label.topologyRef().equals(target.topologyRef());
    }

    private static PointerTarget pointerTargetFromProjection(InlineLabelEditProjection projection) {
        return PointerTarget.label(
                projection.labelKind(),
                projection.ownerId(),
                projection.clusterId(),
                new DungeonMapContentModel.DungeonMapRenderState.TopologyRef(
                        projection.topologyKind(),
                        projection.topologyId()));
    }

    private static InlineLabelEditState stateFromProjection(InlineLabelEditProjection projection) {
        InlineLabelEditProjection safeProjection = projection == null
                ? InlineLabelEditProjection.inactive()
                : projection;
        if (!safeProjection.active()) {
            return InlineLabelEditState.inactive();
        }
        return InlineLabelEditState.active(
                pointerTargetFromProjection(safeProjection),
                safeProjection.text(),
                safeProjection.centerX(),
                safeProjection.centerY(),
                safeProjection.width(),
                safeProjection.height(),
                safeProjection.rotationDegrees());
    }

    private static InlineLabelEditorPresentation presentationFrom(
            InlineLabelEditState editState,
            Viewport viewport
    ) {
        InlineLabelEditState safeState = editState == null ? InlineLabelEditState.inactive() : editState;
        Viewport safeViewport = viewport == null ? Viewport.initial() : viewport;
        if (!safeState.active()) {
            return InlineLabelEditorPresentation.hidden();
        }
        double screenWidth = safeState.width() * safeViewport.gridSize();
        double screenHeight = Math.max(24.0, safeState.height() * safeViewport.gridSize());
        return new InlineLabelEditorPresentation(
                true,
                safeState.text(),
                safeViewport.sceneToScreenX(safeState.centerX()) - screenWidth / 2.0,
                safeViewport.sceneToScreenY(safeState.centerY()) - screenHeight / 2.0,
                screenWidth,
                screenHeight,
                safeState.rotationDegrees());
    }
}
