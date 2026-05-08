package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;

public record DungeonEditorMainViewInputEvent(
        PointerPhase pointerPhase,
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        String hitRef,
        int levelDelta
) {

    public DungeonEditorMainViewInputEvent {
        pointerPhase = PointerPhase.defaultPhase(pointerPhase);
        hitRef = hitRef == null ? "" : hitRef;
    }

    public enum PointerPhase {
        PRESS,
        DRAG,
        RELEASE,
        MOVE,
        LEVEL_SCROLLED;

        static PointerPhase defaultPhase(@Nullable PointerPhase pointerPhase) {
            return pointerPhase == null ? fromCanvasPhaseName(null) : pointerPhase;
        }

        static PointerPhase fromCanvasPhaseName(@Nullable String phaseName) {
            return valueOf(phaseName == null || phaseName.isBlank() ? "MOVE" : phaseName);
        }

        static PointerPhase levelScrolledPhase() {
            return valueOf("LEVEL_SCROLLED");
        }

        boolean isLevelScrolled() {
            return "LEVEL_SCROLLED".equals(name());
        }

        String publishedSourceName() {
            return switch (this) {
                case PRESS -> "POINTER_PRESSED";
                case DRAG -> "POINTER_DRAGGED";
                case RELEASE -> "POINTER_RELEASED";
                case MOVE -> "POINTER_MOVED";
                case LEVEL_SCROLLED -> "LEVEL_SCROLLED";
            };
        }
    }
}
