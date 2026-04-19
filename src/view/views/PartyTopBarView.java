package src.view.views;

import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;

public final class PartyTopBarView extends HBox {

    private final Label summary = new Label();
    private final Button refreshButton = new Button("Party");

    public PartyTopBarView() {
        setSpacing(8);
        setPadding(new Insets(4, 8, 4, 8));
        getStyleClass().add("topbar-party");
        getChildren().addAll(refreshButton, summary);
    }

    public void onRefresh(Runnable action) {
        refreshButton.setOnAction(event -> action.run());
    }

    public void showSummary(String text) {
        summary.setText(text);
    }
}
