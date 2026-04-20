package src.view.details.creature;

import java.util.List;
import javafx.geometry.HPos;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.ColumnConstraints;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;
import org.jspecify.annotations.Nullable;

public final class CreatureDetailsView extends VBox {

    public CreatureDetailsView() {
        getStyleClass().add("stat-block-pane");
        setSpacing(0);
        setPadding(new Insets(16));
        setMaxWidth(580);
    }

    public void setLoadingText(@Nullable String text) {
        if (text != null && !text.isBlank()) {
            Label loading = new Label(text);
            loading.getStyleClass().add("stat-block-loading");
            getChildren().setAll(loading);
        }
    }

    public void setErrorText(@Nullable String text) {
        if (text != null && !text.isBlank()) {
            Label error = new Label(text);
            error.getStyleClass().add("stat-block-loading");
            getChildren().setAll(error);
        }
    }

    public void showDetail(@Nullable DetailContent detail) {
        if (detail == null) {
            return;
        }
        getChildren().clear();
        buildHeader(detail);
        addProperties(detail.coreProperties());
        getChildren().add(separator());
        buildAbilityGrid(detail.abilities());
        getChildren().add(separator());
        addProperties(detail.properties());
        getChildren().add(separator());
        buildSections(detail.sections());
    }

    private void buildHeader(DetailContent detail) {
        Label name = new Label(detail.name());
        name.getStyleClass().add("stat-block-name");
        name.setWrapText(true);
        Label meta = new Label(detail.meta());
        meta.getStyleClass().add("stat-block-meta");
        meta.setWrapText(true);
        getChildren().addAll(name, meta, separator());
    }

    private void addProperties(List<PropertyLine> properties) {
        for (PropertyLine property : properties == null ? List.<PropertyLine>of() : properties) {
            TextFlow flow = new TextFlow();
            Text label = new Text(property.label() + "  ");
            label.getStyleClass().add("stat-block-prop-label");
            Text value = new Text(property.value());
            value.getStyleClass().add("stat-block-prop-value");
            flow.getChildren().addAll(label, value);
            flow.setPadding(new Insets(1, 0, 1, 0));
            getChildren().add(flow);
        }
    }

    private void buildAbilityGrid(List<AbilityScore> scores) {
        GridPane abilities = new GridPane();
        abilities.getStyleClass().add("stat-block-abilities");
        abilities.setAlignment(Pos.CENTER);
        abilities.setHgap(0);
        abilities.setPadding(new Insets(4, 0, 4, 0));
        List<AbilityScore> safeScores = scores == null ? List.of() : scores;
        for (int index = 0; index < safeScores.size(); index++) {
            ColumnConstraints constraints = new ColumnConstraints();
            constraints.setPercentWidth(100.0 / safeScores.size());
            constraints.setHalignment(HPos.CENTER);
            abilities.getColumnConstraints().add(constraints);
            AbilityScore score = safeScores.get(index);
            Label header = new Label(score.label());
            header.getStyleClass().add("stat-block-ability-header");
            Label value = new Label(score.value());
            value.getStyleClass().add("stat-block-ability-value");
            abilities.add(header, index, 0);
            abilities.add(value, index, 1);
        }
        getChildren().add(abilities);
    }

    private void buildSections(List<ActionSection> sections) {
        for (ActionSection section : sections == null ? List.<ActionSection>of() : sections) {
            if (section.title() != null && !section.title().isBlank()) {
                Label title = new Label(section.title());
                title.getStyleClass().add("stat-block-section-header");
                title.setPadding(new Insets(8, 0, 2, 0));
                getChildren().add(title);
            }
            if (section.description() != null && !section.description().isBlank()) {
                Label description = new Label(section.description());
                description.getStyleClass().add("stat-block-meta");
                description.setWrapText(true);
                getChildren().add(description);
            }
            for (ActionLine action : section.actions()) {
                TextFlow flow = new TextFlow();
                flow.setPadding(new Insets(2, 0, 2, 0));
                if (action.name() != null && !action.name().isBlank()) {
                    Text name = new Text(action.name() + ". ");
                    name.getStyleClass().add("stat-block-action-name");
                    flow.getChildren().add(name);
                }
                if (action.description() != null && !action.description().isBlank()) {
                    Text description = new Text(action.description());
                    description.getStyleClass().add("stat-block-action-desc");
                    flow.getChildren().add(description);
                }
                getChildren().add(flow);
            }
        }
    }

    private Region separator() {
        Region separator = new Region();
        separator.getStyleClass().add("stat-block-separator");
        separator.setMinHeight(2);
        separator.setMaxHeight(2);
        VBox.setMargin(separator, new Insets(6, 0, 6, 0));
        return separator;
    }

    public record DetailContent(
            String name,
            String meta,
            List<PropertyLine> coreProperties,
            List<AbilityScore> abilities,
            List<PropertyLine> properties,
            List<ActionSection> sections
    ) {
        public DetailContent {
            coreProperties = coreProperties == null ? List.of() : List.copyOf(coreProperties);
            abilities = abilities == null ? List.of() : List.copyOf(abilities);
            properties = properties == null ? List.of() : List.copyOf(properties);
            sections = sections == null ? List.of() : List.copyOf(sections);
        }
    }

    public record PropertyLine(String label, String value) {
    }

    public record AbilityScore(String label, String value) {
    }

    public record ActionSection(String title, String description, List<ActionLine> actions) {
        public ActionSection {
            actions = actions == null ? List.of() : List.copyOf(actions);
        }
    }

    public record ActionLine(String name, String description) {
    }
}
