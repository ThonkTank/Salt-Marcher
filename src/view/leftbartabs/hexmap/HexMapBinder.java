package src.view.leftbartabs.hexmap;

import java.util.Map;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

final class HexMapBinder {

    ShellBinding bind() {
        HexMapMainContentModel mainContentModel = new HexMapMainContentModel();
        HexMapContributionModel contributionModel = new HexMapContributionModel(mainContentModel);
        HexMapMainView main = new HexMapMainView();
        main.bind(contributionModel.mainContentModel());
        return new Binding(main);
    }

    private record Binding(Node main) implements ShellBinding {

        @Override
        public String title() {
            return "Hex-Karte";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
