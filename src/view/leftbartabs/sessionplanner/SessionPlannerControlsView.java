package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.ObservableList;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public final class SessionPlannerControlsView extends ScrollPane {

    private static final String PMD_LAW_OF_DEMETER = "PMD.LawOfDemeter";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String XP_SUFFIX = " XP";
    private static final String STYLE_BUDGET_OK = "session-planner-budget-ok";
    private static final String STYLE_BUDGET_OVER = "session-planner-budget-over";

    private final Label statusLabel = Factory.createStatusLabel();
    private final SessionSection sessionSection = new SessionSection();
    private final Label partyHeadlineLabel = Factory.createLabel("", true);
    private final Label partyDetailLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
    private final ParticipantSection activePartySection = new ParticipantSection("Aktive Party");
    private final SessionParticipantSection sessionParticipantSection = new SessionParticipantSection();
    private final BudgetSection budgetSection = new BudgetSection();
    private final Label restAdviceLabel = Factory.createLabel("", true);
    private final Label goldHeadlineLabel = Factory.createLabel("", true);
    private final Label goldDetailLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
    private final PlansSection plansSection = new PlansSection();
    private Consumer<SessionPlannerControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    @SuppressWarnings(PMD_LAW_OF_DEMETER)
    public SessionPlannerControlsView() {
        sessionSection.onCreateRequested(() -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.CREATE_SESSION,
                        0L,
                        0L,
                        "")));
        sessionSection.onRefreshRequested(() -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.REFRESH,
                        0L,
                        0L,
                        "")));
        sessionSection.onEncounterDaysRequested(encounterDaysText -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.SET_ENCOUNTER_DAYS,
                        0L,
                        0L,
                        encounterDaysText)));
        activePartySection.onActionRequested(characterId -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.ADD_PARTICIPANT,
                        characterId,
                        0L,
                        "")));
        sessionParticipantSection.onRemoveRequested(characterId -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.REMOVE_PARTICIPANT,
                        characterId,
                        0L,
                        "")));
        plansSection.onImportRequested(planId -> viewInputEventHandler.accept(
                new SessionPlannerControlsViewInputEvent(
                        SessionPlannerControlsViewInputEvent.Kind.ATTACH_PLAN,
                        0L,
                        planId,
                        "")));

        VBox content = new VBox(12);
        ObservableList<Node> contentChildren = content.getChildren();
        Factory.addStyles(content, "session-planner-controls");
        content.setPadding(new Insets(8));
        contentChildren.addAll(
                sessionSection.root(),
                statusLabel,
                Factory.createSectionCard("Session-Ueberblick", partyHeadlineLabel, partyDetailLabel),
                sessionParticipantSection.root(),
                activePartySection.root(),
                budgetSection.root,
                Factory.createSectionCard("Rastempfehlung", restAdviceLabel),
                Factory.createSectionCard("Gold & Loot", goldHeadlineLabel, goldDetailLabel),
                plansSection.root);
        setContent(content);
        Factory.addStyles(this, "session-planner-controls-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void show(ControlsProjection projection) {
        ControlsProjection safe = projection == null ? ControlsProjection.empty() : projection;
        statusLabel.setText(safe.statusText());
        sessionSection.show(safe.session());
        partyHeadlineLabel.setText(safe.party().headline());
        partyDetailLabel.setText(safe.party().detail());
        activePartySection.showMembers(safe.activePartyMembers());
        sessionParticipantSection.showParticipants(safe.sessionParticipants());
        budgetSection.show(safe.budget());
        restAdviceLabel.setText(safe.restAdvice().summaryText());
        goldHeadlineLabel.setText(safe.goldBudget().headline());
        goldDetailLabel.setText(safe.goldBudget().detail());
        plansSection.showPlans(safe.availablePlans());
    }

    public void onViewInputEvent(Consumer<SessionPlannerControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private static final class SessionSection {

        private final Label sessionIdLabel = Factory.createLabel("", true);
        private final Label selectionLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
        private final TextField encounterDaysField = new TextField();
        private final VBox root;
        private Runnable createRequested = () -> { };
        private Runnable refreshRequested = () -> { };
        private Consumer<String> encounterDaysRequested = ignored -> { };

        private SessionSection() {
            Label headerLabel = Factory.createLabel("SESSION PLANNER", false, "section-header", "text-muted");
            Button refreshButton = Factory.createButton("Aktualisieren", event -> refreshRequested.run(), "compact", "flat");
            Button createButton = Factory.createButton("Neue Session", event -> createRequested.run(), "compact", "accent");
            Button applyDaysButton = Factory.createButton("Tage setzen", event -> encounterDaysRequested.accept(encounterDaysField.getText()), "compact", "flat");
            encounterDaysField.setPromptText("1.0");
            HBox daysRow = new HBox(6,
                    Factory.createLabel("Encounter Days", false, "session-planner-card-title"),
                    encounterDaysField,
                    applyDaysButton);
            HBox.setHgrow(encounterDaysField, Priority.ALWAYS);
            root = new VBox(10,
                    Factory.createHeaderRow(headerLabel, refreshButton, createButton),
                    Factory.createSectionCard("Session",
                            sessionIdLabel,
                            selectionLabel,
                            daysRow));
        }

        private VBox root() {
            return root;
        }

        private void onCreateRequested(Runnable handler) {
            createRequested = handler == null ? () -> { } : handler;
        }

        private void onRefreshRequested(Runnable handler) {
            refreshRequested = handler == null ? () -> { } : handler;
        }

        private void onEncounterDaysRequested(Consumer<String> handler) {
            encounterDaysRequested = handler == null ? ignored -> { } : handler;
        }

        private void show(ControlsProjection.SessionModel model) {
            sessionIdLabel.setText("Session #" + Math.max(0L, model.sessionId()));
            selectionLabel.setText(model.selectionText());
            encounterDaysField.setText(model.encounterDaysText());
        }
    }

    private static final class ParticipantSection {

        private final VBox rows = new VBox(6);
        private final VBox root;
        private Consumer<Long> actionRequested = ignored -> { };

        private ParticipantSection(String title) {
            root = Factory.createSectionCard(title, rows);
            root.setSpacing(8);
        }

        private VBox root() {
            return root;
        }

        private void onActionRequested(Consumer<Long> handler) {
            actionRequested = handler == null ? ignored -> { } : handler;
        }

        private void showMembers(List<ControlsProjection.PartyMemberModel> members) {
            ObservableList<Node> children = rows.getChildren();
            if (members.isEmpty()) {
                children.setAll(Factory.createLabel(
                        "Keine aktiven Party-Mitglieder verfuegbar.",
                        true,
                        STYLE_TEXT_SECONDARY,
                        "session-planner-empty"));
                return;
            }
            children.setAll(members.stream()
                    .map(this::memberRow)
                    .toList());
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private Node memberRow(ControlsProjection.PartyMemberModel member) {
            Button addButton = Factory.createButton(
                    member.alreadyInSession() ? "Schon in Session" : "Hinzufuegen",
                    event -> actionRequested.accept(member.characterId()),
                    "compact",
                    member.alreadyInSession() ? "flat" : "accent");
            addButton.setDisable(member.alreadyInSession());
            VBox labels = new VBox(
                    Factory.createLabel(member.name(), false, "session-planner-plan-name"),
                    Factory.createLabel("Level " + member.level(), true, STYLE_TEXT_SECONDARY));
            HBox row = new HBox(8, labels, Factory.spacer(), addButton);
            row.setAlignment(Pos.CENTER_LEFT);
            Factory.addStyles(row, "session-planner-plan-card");
            return row;
        }
    }

    private static final class SessionParticipantSection {

        private final VBox rows = new VBox(6);
        private final VBox root = Factory.createSectionCard("Session-Teilnehmer", rows);
        private Consumer<Long> removeRequested = ignored -> { };

        private SessionParticipantSection() {
            root.setSpacing(8);
        }

        private VBox root() {
            return root;
        }

        private void onRemoveRequested(Consumer<Long> handler) {
            removeRequested = handler == null ? ignored -> { } : handler;
        }

        private void showParticipants(List<ControlsProjection.SessionParticipantModel> participants) {
            ObservableList<Node> children = rows.getChildren();
            if (participants.isEmpty()) {
                children.setAll(Factory.createLabel(
                        "Noch keine Teilnehmer in dieser Session.",
                        true,
                        STYLE_TEXT_SECONDARY,
                        "session-planner-empty"));
                return;
            }
            children.setAll(participants.stream()
                    .map(this::participantRow)
                    .toList());
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private Node participantRow(ControlsProjection.SessionParticipantModel participant) {
            Button removeButton = Factory.createButton(
                    "Entfernen",
                    event -> removeRequested.accept(participant.characterId()),
                    "compact",
                    "flat");
            removeButton.setDisable(!participant.removable());
            VBox labels = new VBox(
                    Factory.createLabel(participant.name(), false, "session-planner-plan-name"),
                    Factory.createLabel(participant.detail(), true, participant.available() ? STYLE_TEXT_SECONDARY : "session-planner-gap-active"));
            HBox row = new HBox(8, labels, Factory.spacer(), removeButton);
            row.setAlignment(Pos.CENTER_LEFT);
            Factory.addStyles(row, "session-planner-plan-card");
            return row;
        }
    }

    private static final class BudgetSection {

        private final Label totalBudgetLabel = Factory.createLabel("", true);
        private final Label plannedXpLabel = Factory.createLabel("", true);
        private final Label remainingXpLabel = Factory.createLabel("", true);
        private final Label milestonesLabel = Factory.createLabel("", true, STYLE_TEXT_SECONDARY);
        private final Label summaryLabel = Factory.createLabel("", true, "session-planner-budget-summary");
        private final ProgressBar budgetBar = createBudgetBar();
        private final VBox root = Factory.createSectionCard(
                "XP-Budget",
                totalBudgetLabel,
                plannedXpLabel,
                remainingXpLabel,
                budgetBar,
                summaryLabel,
                milestonesLabel);

        private BudgetSection() {
            root.setSpacing(6);
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private void show(ControlsProjection.BudgetModel model) {
            totalBudgetLabel.setText("Budget " + model.totalBudgetText() + XP_SUFFIX);
            plannedXpLabel.setText("Geplant " + model.plannedXpText() + XP_SUFFIX);
            remainingXpLabel.setText(model.overBudget()
                    ? model.overBudgetText() + XP_SUFFIX + " ueber"
                    : model.remainingXpText() + XP_SUFFIX + " frei");
            summaryLabel.setText(model.summaryText());
            milestonesLabel.setText(model.milestonesText());
            budgetBar.setProgress(Math.max(0.0, Math.min(1.0, model.progressFraction())));
            ObservableList<String> styleClasses = budgetBar.getStyleClass();
            styleClasses.removeAll(STYLE_BUDGET_OK, STYLE_BUDGET_OVER);
            styleClasses.add(model.overBudget() ? STYLE_BUDGET_OVER : STYLE_BUDGET_OK);
        }

        private static ProgressBar createBudgetBar() {
            ProgressBar progressBar = new ProgressBar(0.0);
            Factory.addStyles(progressBar, "session-planner-budget-bar");
            return progressBar;
        }
    }

    private static final class PlansSection {

        private final VBox plansBox = new VBox(6);
        private final VBox root = Factory.createSectionCard("Gespeicherte Encounter", plansBox);
        private Consumer<Long> importHandler = ignored -> { };

        private PlansSection() {
            root.setSpacing(8);
        }

        private void onImportRequested(Consumer<Long> handler) {
            importHandler = handler == null ? ignored -> { } : handler;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private void showPlans(List<ControlsProjection.AvailablePlanModel> plans) {
            ObservableList<Node> children = plansBox.getChildren();
            children.setAll(planNodes(plans));
        }

        private List<Node> planNodes(List<ControlsProjection.AvailablePlanModel> plans) {
            if (plans.isEmpty()) {
                return List.of(Factory.createLabel(
                        "Keine gespeicherten Encounter-Plaene.",
                        true,
                        STYLE_TEXT_SECONDARY,
                        "session-planner-empty"));
            }
            return plans.stream()
                    .map(this::planCard)
                    .toList();
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private Node planCard(ControlsProjection.AvailablePlanModel plan) {
            VBox card = new VBox(4);
            ObservableList<Node> children = card.getChildren();
            Button importButton = Factory.createButton(
                    "An Session anhaengen",
                    event -> importHandler.accept(plan.planId()),
                    "compact",
                    "accent");
            importButton.setDisable(!plan.importEnabled());
            Factory.addStyles(card, "session-planner-plan-card");
            children.addAll(
                    Factory.createLabel(plan.name(), false, "session-planner-plan-name"),
                    Factory.createLabel(
                            plan.creatureCount() + " Kreaturen"
                                    + (plan.generatedLabel().isBlank() ? "" : " · " + plan.generatedLabel()),
                            true,
                            STYLE_TEXT_SECONDARY),
                    Factory.createLabel(plan.statusText(), true, STYLE_TEXT_SECONDARY),
                    importButton);
            return card;
        }
    }

    private static final class Factory {

        private static Label createLabel(String text, boolean wrap, String... styleClasses) {
            Label label = new Label(text);
            label.setWrapText(wrap);
            addStyles(label, styleClasses);
            return label;
        }

        private static Button createButton(String text, EventHandler<ActionEvent> action, String... styleClasses) {
            Button button = new Button(text);
            addStyles(button, styleClasses);
            button.setOnAction(action);
            return button;
        }

        private static Label createStatusLabel() {
            Label label = createLabel("", true, STYLE_TEXT_SECONDARY, "session-planner-status");
            StringProperty text = label.textProperty();
            BooleanProperty managed = label.managedProperty();
            label.setVisible(false);
            text.addListener((ignored, before, after) -> label.setVisible(after != null && !after.isBlank()));
            managed.bind(label.visibleProperty());
            return label;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static HBox createHeaderRow(Node titleLabel, Node... actionButtons) {
            HBox row = new HBox(8);
            ObservableList<Node> children = row.getChildren();
            children.add(titleLabel);
            children.add(spacer());
            children.addAll(actionButtons);
            row.setAlignment(Pos.CENTER_LEFT);
            return row;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static VBox createSectionCard(String title, Node... body) {
            VBox card = new VBox(4);
            ObservableList<Node> children = card.getChildren();
            children.add(createLabel(title, false, "session-planner-card-title"));
            children.addAll(body);
            addStyles(card, "session-planner-card");
            card.setPadding(new Insets(10));
            return card;
        }

        @SuppressWarnings(PMD_LAW_OF_DEMETER)
        private static void addStyles(Node node, String... styleClasses) {
            ObservableList<String> appliedStyles = node.getStyleClass();
            appliedStyles.addAll(styleClasses);
        }

        private static Region spacer() {
            Region region = new Region();
            HBox.setHgrow(region, Priority.ALWAYS);
            return region;
        }
    }
}
