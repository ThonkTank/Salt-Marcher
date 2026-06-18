package src.view.leftbartabs.hexmap;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class HexMapMainView extends ScrollPane {

    private final VBox content = new VBox(16);
    private final Label titleLabel = label("", "title-large");
    private final Label subtitleLabel = label("", "text-secondary");
    private final Label statusLabel = label("", "text-muted");
    private final Label emptyLabel = label("Noch keine Hex-Karte geladen.", "text-secondary", "hex-map-empty");

    public HexMapMainView() {
        getStyleClass().addAll("surface-root", "hex-map-scroll");
        content.getStyleClass().add("hex-map-main");
        content.getChildren().addAll(header(), emptyLabel);
        setContent(content);
        setFitToWidth(true);
        setHbarPolicy(ScrollBarPolicy.NEVER);
    }

    public void bind(HexMapMainContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        show(contentModel.projectionProperty().get());
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
    }

    private void show(HexMapMainContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        titleLabel.setText(projection.title());
        subtitleLabel.setText(projection.subtitle());
        statusLabel.setText(projection.status());
    }

    private Node header() {
        VBox header = new VBox(4, titleLabel, subtitleLabel, statusLabel);
        header.getStyleClass().add("hex-map-header");
        return header;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }
}
