package src.view.creatures.View;

import java.util.Objects;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.creatures.ViewModel.CreatureInspectorViewData;

public final class CreatureInspectorContentFactory {

    private CreatureInspectorContentFactory() {
    }

    public static Node build(CreatureInspectorViewData detail) {
        Objects.requireNonNull(detail, "detail");
        VBox content = new VBox(10);
        content.setPadding(new Insets(12));
        for (CreatureInspectorViewData.Section section : detail.sections()) {
            content.getChildren().add(section(section));
        }
        return content;
    }

    private static VBox section(CreatureInspectorViewData.Section section) {
        Label titleLabel = new Label(section.title());
        titleLabel.getStyleClass().add("panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().addAll("card-surface", "content-card");
        box.getChildren().add(titleLabel);
        for (CreatureInspectorViewData.Field field : section.fields()) {
            box.getChildren().add(labeled(field.label(), field.value()));
        }
        return box;
    }

    private static Node labeled(String label, @Nullable String value) {
        VBox box = new VBox(2);
        Label labelNode = new Label(label);
        labelNode.getStyleClass().add("text-muted");
        Label valueNode = new Label(value == null || value.isBlank() ? "-" : value);
        valueNode.setWrapText(true);
        box.getChildren().addAll(labelNode, valueNode);
        return box;
    }
}
