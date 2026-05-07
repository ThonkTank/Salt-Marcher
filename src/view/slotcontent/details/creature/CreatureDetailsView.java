package src.view.slotcontent.details.creature;

import java.util.ArrayList;
import java.util.List;
import javafx.geometry.HPos;
import javafx.geometry.Insets;
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

    private static final Insets VIEW_PADDING = new Insets(16);
    private static final Insets PROPERTY_PADDING = new Insets(1, 0, 1, 0);
    private static final Insets ABILITY_PADDING = new Insets(4, 0, 4, 0);
    private static final Insets SECTION_TITLE_PADDING = new Insets(8, 0, 2, 0);
    private static final Insets ACTION_PADDING = new Insets(2, 0, 2, 0);
    private static final Insets SEPARATOR_MARGIN = new Insets(6, 0, 6, 0);

    public CreatureDetailsView() {
        getStyleClass().add("stat-block-pane");
        setSpacing(0);
        setPadding(VIEW_PADDING);
        setMaxWidth(580);
    }

    public void setLoadingText(@Nullable String text) {
        showMessage(text);
    }

    public void setErrorText(@Nullable String text) {
        showMessage(text);
    }

    public void bind(CreatureDetailsContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        setLoadingText(presentationModel.loadingTextProperty().get());
        setErrorText(presentationModel.errorTextProperty().get());
        CreatureDetailsContentModel.DetailState current = presentationModel.detailProperty().get();
        if (current != null) {
            showDetail(current);
        }
        presentationModel.loadingTextProperty().addListener((obs, oldValue, newValue) -> setLoadingText(newValue));
        presentationModel.errorTextProperty().addListener((obs, oldValue, newValue) -> setErrorText(newValue));
        presentationModel.detailProperty().addListener((obs, oldValue, newValue) -> {
            if (newValue != null) {
                showDetail(newValue);
            }
        });
    }

    public void showDetail(CreatureDetailsContentModel.DetailState detail) {
        if (detail == null) {
            return;
        }
        getChildren().setAll(detailNodes(detail));
    }

    private void showMessage(@Nullable String text) {
        if (NodeSupport.hasText(text)) {
            getChildren().setAll(new MessageLabel(text));
        }
    }

    private List<Node> detailNodes(CreatureDetailsContentModel.DetailState detail) {
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

    private void addProperties(
            List<Node> nodes,
            @Nullable List<CreatureDetailsContentModel.PropertyLine> properties
    ) {
        for (CreatureDetailsContentModel.PropertyLine property : NodeSupport.safeList(properties)) {
            nodes.add(new PropertyFlow(property));
        }
    }

    private void addSections(
            List<Node> nodes,
            @Nullable List<CreatureDetailsContentModel.ActionGroup> sections
    ) {
        for (CreatureDetailsContentModel.ActionGroup section : NodeSupport.safeList(sections)) {
            Node title = NodeSupport.sectionTitle(section.title());
            if (title != null) {
                nodes.add(title);
            }
            Node description = NodeSupport.sectionDescription(section.description());
            if (description != null) {
                nodes.add(description);
            }
            for (CreatureDetailsContentModel.ActionLine action : NodeSupport.safeList(section.actions())) {
                Node actionView = NodeSupport.actionFlow(action);
                if (actionView != null) {
                    nodes.add(actionView);
                }
            }
        }
    }

    private void addSeparator(List<Node> nodes) {
        Region separator = new Separator();
        setMargin(separator, SEPARATOR_MARGIN);
        nodes.add(separator);
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
            setPadding(SECTION_TITLE_PADDING);
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
            getChildren().addAll(
                    new StyledText(property.label() + "  ", "stat-block-prop-label"),
                    new StyledText(property.value(), "stat-block-prop-value"));
            setPadding(PROPERTY_PADDING);
        }
    }

    private static final class AbilityGrid extends GridPane {

        AbilityGrid(@Nullable List<CreatureDetailsContentModel.PropertyLine> scores) {
            List<CreatureDetailsContentModel.PropertyLine> safeScores = NodeSupport.safeList(scores);
            getStyleClass().add("stat-block-abilities");
            setAlignment(Pos.CENTER);
            setHgap(0);
            setPadding(ABILITY_PADDING);
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
            setPadding(ACTION_PADDING);
            if (NodeSupport.hasText(action.name())) {
                getChildren().add(new StyledText(action.name() + ". ", "stat-block-action-name"));
            }
            if (NodeSupport.hasText(action.description())) {
                getChildren().add(new StyledText(action.description(), "stat-block-action-desc"));
            }
        }
    }

    private static final class NodeSupport {
        private static @Nullable Node sectionTitle(@Nullable String text) {
            return hasText(text) ? new SectionTitleLabel(text) : null;
        }

        private static @Nullable Node sectionDescription(@Nullable String text) {
            return hasText(text) ? new MetaLabel(text) : null;
        }

        private static @Nullable Node actionFlow(CreatureDetailsContentModel.ActionLine action) {
            if (!hasText(action.name()) && !hasText(action.description())) {
                return null;
            }
            return new ActionFlow(action);
        }

        private static boolean hasText(@Nullable String text) {
            return text != null && !text.isBlank();
        }

        private static <T> List<T> safeList(@Nullable List<T> values) {
            return values == null ? List.of() : values;
        }
    }

    private static final class Separator extends Region {

        Separator() {
            getStyleClass().add("stat-block-separator");
            setMinHeight(2);
            setMaxHeight(2);
        }
    }
}
