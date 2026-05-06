package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.function.Consumer;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;

final class CatalogFilterChipsView extends FlowPane {

    private final Consumer<String> removeChipAction;

    CatalogFilterChipsView(Consumer<String> removeChipAction) {
        super(4, 2);
        this.removeChipAction = removeChipAction;
        prefWrapLengthProperty().bind(widthProperty().subtract(16));
        setMinHeight(24);
    }

    void setChips(List<CatalogContributionModel.FilterChip> chips) {
        getChildren().clear();
        List<CatalogContributionModel.FilterChip> safeChips = chips == null ? List.of() : List.copyOf(chips);
        for (CatalogContributionModel.FilterChip chip : safeChips) {
            getChildren().add(new ChipView(chip, removeChipAction));
        }
    }

    private static final class ChipView extends HBox {

        ChipView(CatalogContributionModel.FilterChip chip, Consumer<String> removeChipAction) {
            super(2);
            getStyleClass().addAll("chip", chip.styleClass());
            getChildren().setAll(new Label(chip.label()), new RemoveChipButton(chip, removeChipAction));
        }
    }

    private static final class RemoveChipButton extends Button {

        RemoveChipButton(CatalogContributionModel.FilterChip chip, Consumer<String> removeChipAction) {
            super("×");
            getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            setAccessibleText("Entfernen: " + chip.label());
            setOnAction(event -> removeChipAction.accept(chip.key()));
        }
    }
}
