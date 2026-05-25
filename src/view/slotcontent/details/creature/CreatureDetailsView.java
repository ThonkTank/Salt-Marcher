package src.view.slotcontent.details.creature;

import java.util.ArrayList;
import java.util.List;
import javafx.geometry.HPos;
import javafx.geometry.Pos;
import javafx.scene.Node;
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
    }

    public void bind(CreatureDetailsContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        showMessage(presentationModel.loadingTextProperty().get());
        showMessage(presentationModel.errorTextProperty().get());
        CreatureDetailsContentModel.DetailState current = presentationModel.detailProperty().get();
        if (current != null) {
            showDetail(current);
        }
        presentationModel.loadingTextProperty().addListener((obs, oldValue, newValue) -> showMessage(newValue));
        presentationModel.errorTextProperty().addListener((obs, oldValue, newValue) -> showMessage(newValue));
        presentationModel.detailProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue != null) {
                showDetail(newValue);
            }
        });
    }

    private void showDetail(CreatureDetailsContentModel.DetailState detail) {
        if (detail == null) {
            return;
        }
        getChildren().setAll(DetailNodes.detailNodes(detail));
    }

    private void showMessage(@Nullable String text) {
        if (hasText(text)) {
            getChildren().setAll(new MessageLabel(text));
        }
    }

    private static class WrappedLabel extends Label {

        WrappedLabel(String text, String styleClass) {
            super(text);
            getStyleClass().add(styleClass);
            setWrapText(true);
        }
    }

    private static final class MessageLabel extends WrappedLabel {

        MessageLabel(String text) {
            super(text, "stat-block-loading");
        }
    }

    private static final class MetaLabel extends WrappedLabel {

        MetaLabel(String text) {
            super(text, "stat-block-meta");
        }
    }

    private static final class SectionTitleLabel extends Label {

        SectionTitleLabel(String text) {
            super(text);
            getStyleClass().add("stat-block-section-header");
        }
    }

    private static final class StyledText extends Text {

        StyledText(String text, String styleClass) {
            super(text);
            getStyleClass().add(styleClass);
        }
    }

    private static final class HeaderView extends VBox {

        HeaderView(CreatureDetailsContentModel.DetailState detail) {
            getChildren().addAll(
                    new WrappedLabel(detail.name(), "stat-block-name"),
                    new MetaLabel(detail.meta()));
        }
    }

    private static final class PropertyFlow extends TextFlow {

        PropertyFlow(CreatureDetailsContentModel.PropertyLine property) {
            getStyleClass().add("stat-block-property-line");
            getChildren().addAll(
                    new StyledText(property.label() + "  ", "stat-block-prop-label"),
                    new StyledText(property.value(), "stat-block-prop-value"));
        }
    }

    private static final class AbilityGrid extends GridPane {

        AbilityGrid(@Nullable List<CreatureDetailsContentModel.PropertyLine> scores) {
            List<CreatureDetailsContentModel.PropertyLine> safeScores = safeList(scores);
            getStyleClass().add("stat-block-abilities");
            setAlignment(Pos.CENTER);
            for (int index = 0; index < safeScores.size(); index++) {
                addAbility(index, safeScores.get(index), safeScores.size());
            }
        }

        private void addAbility(
                int index,
                CreatureDetailsContentModel.PropertyLine score,
                int scoreCount
        ) {
            ColumnConstraints constraints = new ColumnConstraints();
            constraints.setPercentWidth(100.0 / scoreCount);
            constraints.setHalignment(HPos.CENTER);
            getColumnConstraints().add(constraints);
            add(new AbilityHeaderLabel(score.label()), index, 0);
            add(new AbilityValueLabel(score.value()), index, 1);
        }
    }

    private static final class AbilityHeaderLabel extends Label {

        AbilityHeaderLabel(String text) {
            super(text);
            getStyleClass().add("stat-block-ability-header");
        }
    }

    private static final class AbilityValueLabel extends Label {

        AbilityValueLabel(String text) {
            super(text);
            getStyleClass().add("stat-block-ability-value");
        }
    }

    private static final class ActionFlow extends TextFlow {

        ActionFlow(CreatureDetailsContentModel.ActionLine action) {
            getStyleClass().add("stat-block-action-line");
            if (hasText(action.name())) {
                getChildren().add(new StyledText(action.name() + ". ", "stat-block-action-name"));
            }
            if (hasText(action.description())) {
                getChildren().add(new StyledText(action.description(), "stat-block-action-desc"));
            }
        }
    }

    private static boolean hasText(@Nullable String text) {
        return text != null && !text.isBlank();
    }

    private static <T> List<T> safeList(@Nullable List<T> values) {
        return values == null ? List.of() : values;
    }

    private static final class Separator extends Region {

        Separator() {
            getStyleClass().add("stat-block-separator");
        }
    }

    private static final class DetailNodes {

        private static List<Node> detailNodes(CreatureDetailsContentModel.DetailState detail) {
            List<Node> nodes = new ArrayList<>();
            nodes.add(new HeaderView(detail));
            addProperties(nodes, detail.coreProperties());
            addSeparator(nodes);
            nodes.add(new AbilityGrid(detail.abilities()));
            addSeparator(nodes);
            addProperties(nodes, detail.properties());
            addSeparator(nodes);
            addSections(nodes, detail.sections());
            return nodes;
        }

        private static void addProperties(
                List<Node> nodes,
                @Nullable List<CreatureDetailsContentModel.PropertyLine> properties
        ) {
            for (CreatureDetailsContentModel.PropertyLine property : safeList(properties)) {
                nodes.add(new PropertyFlow(property));
            }
        }

        private static void addSections(
                List<Node> nodes,
                @Nullable List<CreatureDetailsContentModel.ActionGroup> sections
        ) {
            for (CreatureDetailsContentModel.ActionGroup section : safeList(sections)) {
                addSectionHeader(nodes, section);
                for (CreatureDetailsContentModel.ActionLine action : safeList(section.actions())) {
                    Node actionView = actionFlow(action);
                    if (actionView != null) {
                        nodes.add(actionView);
                    }
                }
            }
        }

        private static void addSectionHeader(
                List<Node> nodes,
                CreatureDetailsContentModel.ActionGroup section
        ) {
            if (hasText(section.title())) {
                nodes.add(new SectionTitleLabel(section.title()));
            }
            if (hasText(section.description())) {
                nodes.add(new MetaLabel(section.description()));
            }
        }

        private static void addSeparator(List<Node> nodes) {
            nodes.add(new Separator());
        }

        private static @Nullable Node actionFlow(CreatureDetailsContentModel.ActionLine action) {
            if (!hasText(action.name()) && !hasText(action.description())) {
                return null;
            }
            return new ActionFlow(action);
        }
    }
}
