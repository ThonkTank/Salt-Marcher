package src.view.creatures.View;

import javafx.beans.property.ObjectProperty;
import javafx.geometry.Pos;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;

import java.util.List;

final class ChallengeRatingRangeControl extends HBox {

    private final ComboBox<String> minimumBox;
    private final ComboBox<String> maximumBox;

    ChallengeRatingRangeControl(
            List<String> options,
            ObjectProperty<String> selectedMinimum,
            ObjectProperty<String> selectedMaximum,
            Runnable onChange
    ) {
        super(6);
        setAlignment(Pos.CENTER_LEFT);

        minimumBox = new ComboBox<>();
        minimumBox.getItems().setAll(options);
        minimumBox.setPromptText("CR Min");
        minimumBox.setMaxWidth(Double.MAX_VALUE);
        minimumBox.valueProperty().bindBidirectional(selectedMinimum);
        minimumBox.valueProperty().addListener((ignored, before, after) -> {
            if (onChange != null) {
                onChange.run();
            }
        });

        maximumBox = new ComboBox<>();
        maximumBox.getItems().setAll(options);
        maximumBox.setPromptText("CR Max");
        maximumBox.setMaxWidth(Double.MAX_VALUE);
        maximumBox.valueProperty().bindBidirectional(selectedMaximum);
        maximumBox.valueProperty().addListener((ignored, before, after) -> {
            if (onChange != null) {
                onChange.run();
            }
        });

        Label dash = new Label("\u2013");
        dash.getStyleClass().add("text-muted");

        setHgrow(minimumBox, Priority.ALWAYS);
        setHgrow(maximumBox, Priority.ALWAYS);
        getChildren().addAll(minimumBox, dash, maximumBox);
    }
}
