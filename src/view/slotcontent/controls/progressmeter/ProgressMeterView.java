package src.view.slotcontent.controls.progressmeter;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;

public final class ProgressMeterView extends StackPane {

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public ProgressMeterView(
            double fraction,
            String text,
            String accessibleText,
            String fillStyleClass,
            String sizeStyleClass
    ) {
        double normalizedFraction = Math.max(0.0, Math.min(1.0, fraction));
        getStyleClass().add("progress-meter");
        if (!safe(sizeStyleClass).isBlank()) {
            getStyleClass().add(sizeStyleClass);
        }

        HBox fillHost = new HBox();
        fillHost.setMouseTransparent(true);
        Region fill = new Region();
        fill.getStyleClass().add("progress-meter-fill");
        if (!safe(fillStyleClass).isBlank()) {
            fill.getStyleClass().add(fillStyleClass);
        }
        fill.prefWidthProperty().bind(widthProperty().multiply(normalizedFraction));
        fillHost.getChildren().add(fill);

        Label overlayText = new Label(safe(text));
        overlayText.getStyleClass().add("progress-meter-text");
        overlayText.setMouseTransparent(true);

        getChildren().addAll(fillHost, overlayText);
        StackPane.setAlignment(fillHost, Pos.CENTER_LEFT);
        StackPane.setAlignment(overlayText, Pos.CENTER);
        setAccessibleText(safe(accessibleText).isBlank() ? safe(text) : safe(accessibleText));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
