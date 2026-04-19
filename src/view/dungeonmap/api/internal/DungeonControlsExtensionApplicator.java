package src.view.dungeonmap.api.internal;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.view.dungeonmap.View.DungeonControlsExtensionTarget;
import src.view.dungeonmap.api.DungeonControlsExtensions;

final class DungeonControlsExtensionApplicator {

    private DungeonControlsExtensionApplicator() {
    }

    static void apply(DungeonControlsExtensionTarget controls, DungeonControlsExtensions extensions) {
        setIfPresent(controls::setMapRowActions, extensions.mapRowActions().get());
        setIfPresent(controls::setModeControls, extensions.modeControls().get());
        setIfPresent(controls::setSecondaryActions, extensions.secondaryActions().get());
        setIfPresent(controls::setFooterContent, extensions.footerContent().get());
    }

    private static void setIfPresent(NodeSlot slot, @Nullable Node node) {
        if (node != null) {
            slot.set(node);
        }
    }

    @FunctionalInterface
    private interface NodeSlot {
        void set(Node node);
    }
}
