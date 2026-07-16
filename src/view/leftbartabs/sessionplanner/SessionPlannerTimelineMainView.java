package src.view.leftbartabs.sessionplanner;

import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import src.domain.sessionplanner.published.SessionPlannerGenerationModel;
import src.domain.sessionplanner.published.SessionPlannerGenerationProjection;

public final class SessionPlannerTimelineMainView extends ScrollPane {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_FLAT = "flat";
    private final VBox content = new VBox(12);
    private final VBox rows = new VBox(8);
    private Consumer<SessionPlannerViewModel.TimelineInput> viewInputEventHandler = ignored -> { };
    private Consumer<GenerationInput> generationInputHandler = ignored -> { };
    private SessionPlannerGenerationProjection generationProjection = SessionPlannerGenerationProjection.idle();
    private SessionPlannerViewModel.TimelineProjection latestTimeline = SessionPlannerViewModel.TimelineProjection.empty();

    public SessionPlannerTimelineMainView() {
        addStyles(content, "session-planner-main");
        setContent(content);
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    public void onTimelineInput(Consumer<SessionPlannerViewModel.TimelineInput> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void onGenerationInput(Consumer<GenerationInput> handler) {
        generationInputHandler = handler == null ? ignored -> { } : handler;
    }

    void bindGeneration(SessionPlannerGenerationModel model) {
        if (model == null) return;
        model.subscribe(this::showGeneration);
        showGeneration(model.current());
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.timelineProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.timelineProjectionProperty().get());
    }

    private void show(SessionPlannerViewModel.TimelineProjection projection) {
        if (projection == null) {
            return;
        }
        latestTimeline = projection;
        clearNodes(rows);
        content.getChildren().setAll(setupBox(projection.setup()), generatorBox(projection.setup()), rows);
        if (projection.scenes().isEmpty()) {
            addNode(rows, label("Noch keine Szenen.", STYLE_TEXT_SECONDARY, "session-planner-empty"));
        } else {
            for (int index = 0; index < projection.scenes().size(); index++) {
                SessionPlannerViewModel.TimelineProjection.SceneModel scene =
                        projection.scenes().get(index);
                addNode(rows, sceneCard(scene, index + 1));
                if (index < projection.restGaps().size()) {
                    addNode(rows, restGapCard(projection.restGaps().get(index), index + 1, index + 2));
                }
            }
        }
        Button addScene = actionButton(
                "Szene hinzufuegen",
                event -> rawPublish(event, projection.setup().sceneAddWidgetToken()),
                STYLE_ACCENT);
        addScene.setDisable(projection.setup().sessionActionsDisabled());
        addNode(rows, addScene);
    }

    private void showGeneration(SessionPlannerGenerationProjection projection) {
        generationProjection = projection == null ? SessionPlannerGenerationProjection.idle() : projection;
        show(latestTimeline);
    }

    private Node setupBox(SessionPlannerViewModel.TimelineProjection.SetupModel setup) {
        ComboBox<String> partyMemberSelector = new ComboBox<>();
        partyMemberSelector.getItems().setAll(setup.partyMemberChoiceLabels());
        partyMemberSelector.setPromptText("Spieler");
        if (!partyMemberSelector.getItems().isEmpty()) {
            partyMemberSelector.getSelectionModel().selectFirst();
        }
        partyMemberSelector.setDisable(setup.sessionActionsDisabled() || partyMemberSelector.getItems().isEmpty());
        Button addPlayer = actionButton(
                "Hinzufuegen",
                event -> rawPublishParticipantAdd(
                        event,
                        setup.participantAddWidgetToken(),
                        partyMemberSelector),
                STYLE_ACCENT);
        addPlayer.setDisable(partyMemberSelector.isDisabled());
        TextField encounterDays = new TextField(setup.encounterDaysText());
        encounterDays.setPromptText("Tage");
        encounterDays.getStyleClass().add(STYLE_COMPACT);
        encounterDays.setDisable(setup.sessionActionsDisabled());
        Button applyDays = actionButton(
                "Setzen",
                event -> rawPublishEncounterDays(
                        event,
                        setup.encounterDaysWidgetToken(),
                        encounterDays.getText()),
                STYLE_FLAT);
        applyDays.setDisable(setup.sessionActionsDisabled());

        HBox inputRow = actionRow(
                label("Spieler", "session-planner-card-title"),
                partyMemberSelector,
                addPlayer,
                label("Tage", "session-planner-card-title"),
                encounterDays,
                applyDays,
                label(setup.sceneTargetText(), "session-planner-scene-target"));
        HBox.setHgrow(partyMemberSelector, Priority.ALWAYS);
        HBox.setHgrow(encounterDays, Priority.ALWAYS);

        HBox participantRow = new HBox(6);
        participantRow.getChildren().add(label("In Session", "session-planner-card-title"));
        for (SessionPlannerViewModel.TimelineProjection.SessionParticipantModel participant
                : setup.sessionParticipantRows()) {
            Button remove = actionButton(
                    participant.removeText(),
                    event -> rawPublishParticipantRemove(
                            event,
                            participant.removeWidgetToken(),
                            participant.characterId()),
                    STYLE_FLAT);
            remove.setDisable(participant.actionDisabled());
            remove.setVisible(participant.removeVisible());
            remove.setManaged(participant.removeVisible());
            participantRow.getChildren().add(new ActionRow(
                    4,
                    label(participant.name(), "session-planner-plan-name", participant.detailStyleClass()),
                    remove));
        }
        participantRow.getChildren().add(spacer());
        participantRow.getChildren().add(label(setup.budgetText(), STYLE_TEXT_SECONDARY));
        participantRow.getChildren().add(label(setup.restText(), STYLE_TEXT_SECONDARY));

        VBox box = new VBox(6, inputRow, participantRow);
        addStyles(box, "session-planner-setup-strip");
        return box;
    }

    private Node generatorBox(SessionPlannerViewModel.TimelineProjection.SetupModel setup) {
        TextField encounterCount = new TextField();
        encounterCount.setPromptText("Auto");
        encounterCount.getStyleClass().add(STYLE_COMPACT);
        encounterCount.setPrefColumnCount(4);
        TextField seed = new TextField("179974");
        seed.setPromptText("Seed");
        seed.getStyleClass().add(STYLE_COMPACT);
        seed.setPrefColumnCount(8);
        Button generate = actionButton(
                "Vorschau erzeugen",
                event -> generationInputHandler.accept(new GenerationInput(
                        GenerationAction.GENERATE, encounterCount.getText(), seed.getText(), 0L)),
                STYLE_ACCENT);
        generate.setDisable(setup.sessionActionsDisabled());
        HBox controls = actionRow(
                label("Encounter & Loot", "session-planner-card-title"),
                label("Anzahl", STYLE_TEXT_SECONDARY), encounterCount,
                label("Seed", STYLE_TEXT_SECONDARY), seed,
                generate);
        VBox preview = new VBox(6);
        SessionPlannerGenerationProjection projection = generationProjection;
        if (projection.status() == SessionPlannerGenerationProjection.Status.IDLE) {
            addNode(preview, label(
                    "Erzeugt reproduzierbare Encounter und Loot aus den Session-Spielern.",
                    STYLE_TEXT_SECONDARY));
        } else if (projection.status() == SessionPlannerGenerationProjection.Status.ERROR) {
            addNode(preview, label(projection.message(), "session-planner-generator-error"));
        } else {
            addNode(preview, new ActionRow(
                    8,
                    label(projection.summary(), "session-planner-plan-name"),
                    spacer(),
                    label(projection.provenance(), "session-planner-generator-stamp")));
            appendEncounterPreviews(preview, projection);
            appendTreasurePreviews(preview, projection);
            long failedAudits = projection.audits().stream().filter(audit -> !audit.passed()).count();
            addNode(preview, label(
                    failedAudits == 0 ? "Audits: OK" : "Audits fehlgeschlagen: " + failedAudits,
                    failedAudits == 0 ? "session-planner-generator-audit-ok" : "session-planner-generator-error"));
            Button apply = actionButton(
                    "Session-Inhalt ersetzen",
                    event -> confirmApply(projection.generationId()),
                    STYLE_ACCENT);
            apply.setDisable(!projection.applyEnabled());
            addNode(preview, apply);
        }
        VBox box = new VBox(8, controls, preview);
        addStyles(box, "session-planner-generator");
        return box;
    }

    private static void appendEncounterPreviews(
            VBox preview,
            SessionPlannerGenerationProjection projection
    ) {
        for (SessionPlannerGenerationProjection.EncounterPreview encounter : projection.encounters()) {
            VBox card = new VBox(
                    2,
                    label(encounter.encounterNumber() + ". " + encounter.line(), "session-planner-encounter-title"),
                    label(encounter.roles(), STYLE_TEXT_SECONDARY));
            addStyles(card, "session-planner-generator-preview-card");
            addNode(preview, card);
        }
    }

    private static void appendTreasurePreviews(
            VBox preview,
            SessionPlannerGenerationProjection projection
    ) {
        for (SessionPlannerGenerationProjection.TreasurePreview treasure : projection.treasures()) {
            VBox card = new VBox(2,
                    label(treasure.placement() + " · " + treasure.value(), "session-planner-gap-title"));
            for (String line : treasure.lines()) addNode(card, label(line, STYLE_TEXT_SECONDARY));
            addStyles(card, "session-planner-generator-loot-card");
            addNode(preview, card);
        }
    }

    private void confirmApply(long generationId) {
        Alert confirmation = new Alert(
                Alert.AlertType.CONFIRMATION,
                "Alle bisherigen Szenen, Rasten und Loot-Eintraege dieser Session werden ersetzt. "
                        + "Gespeicherte Encounter-Plaene bleiben erhalten.",
                ButtonType.CANCEL,
                ButtonType.OK);
        confirmation.setTitle("Session-Inhalt ersetzen");
        confirmation.setHeaderText("Generierte Encounter und Loot uebernehmen?");
        confirmation.showAndWait().filter(ButtonType.OK::equals).ifPresent(ignored ->
                generationInputHandler.accept(new GenerationInput(
                        GenerationAction.APPLY, "", "", generationId)));
    }

    private Node sceneCard(
            SessionPlannerViewModel.TimelineProjection.SceneModel scene,
            int position
    ) {
        Label title = label("Szene " + position + ": " + scene.sceneTitle(), "session-planner-encounter-title");
        Label stateHint = label(
                scene.selected()
                        ? "Diese Szene speist aktuell das State-Panel."
                        : "Wird im State-Panel sichtbar, sobald er ausgewaehlt ist.",
                scene.selected() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button select = actionButton(
                scene.selected() ? "Ausgewaehlt" : "Auswaehlen",
                event -> rawPublishScene(event, scene.selectWidgetToken(), scene.sceneToken()),
                scene.selected() ? STYLE_FLAT : STYLE_ACCENT);
        select.setDisable(scene.selected());

        Button decreaseAllocation = actionButton(
                "-10%",
                event -> rawPublishScene(event, scene.allocationDecreaseWidgetToken(), scene.sceneToken()),
                STYLE_FLAT);
        Button increaseAllocation = actionButton(
                "+10%",
                event -> rawPublishScene(event, scene.allocationIncreaseWidgetToken(), scene.sceneToken()),
                STYLE_FLAT);

        Button up = actionButton(
                "Hoch",
                event -> rawPublishScene(event, scene.moveUpWidgetToken(), scene.sceneToken()),
                STYLE_FLAT);
        up.setDisable(!scene.canMoveUp());

        Button down = actionButton(
                "Runter",
                event -> rawPublishScene(event, scene.moveDownWidgetToken(), scene.sceneToken()),
                STYLE_FLAT);
        down.setDisable(!scene.canMoveDown());

        Button remove = actionButton(
                "X",
                event -> rawPublishScene(event, scene.removeWidgetToken(), scene.sceneToken()),
                STYLE_FLAT);

        VBox card = new VBox(6,
                new ActionRow(8, title, spacer(), remove),
                linkedEncounterSummary(scene),
                stateHint,
                sceneSection(scene),
                actionRow(select, decreaseAllocation, increaseAllocation),
                actionRow(up, down),
                lootSection(scene));
        addStyles(card, "session-planner-encounter-card");
        return card;
    }

    private Node linkedEncounterSummary(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
        if (!scene.linkedEncounterPlan()) {
            return label("Keine Begegnung verknuepft.", STYLE_TEXT_SECONDARY);
        }
        VBox summary = new VBox(
                4,
                label(scene.linkedEncounterName(), "session-planner-plan-name"),
                label(scene.linkedEncounterCreatureCount() + " Kreaturen" + generatedLabelSuffix(scene), STYLE_TEXT_SECONDARY),
                label(scene.budgetPercentageText() + " Budget · Ziel " + scene.targetXpText() + " XP",
                        "session-planner-encounter-budget"),
                label(scene.comparisonText() + " · " + scene.linkedEncounterDifficultyLabel(), STYLE_TEXT_SECONDARY),
                label("Base " + scene.linkedEncounterTotalBaseXp()
                                + " XP · Multiplikator x"
                                + String.format(Locale.US, "%.2f", scene.linkedEncounterXpMultiplier()),
                        STYLE_TEXT_SECONDARY));
        addStyles(summary, "session-planner-scene-encounter-summary");
        return summary;
    }

    private Node sceneSection(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
        TextField title = new TextField(scene.sceneTitle());
        title.setPromptText("Szenentitel");
        title.getStyleClass().add(STYLE_COMPACT);
        LocationComboBox location = new LocationComboBox(scene.locationChoices(), scene.locationId());
        TextArea notes = new TextArea(scene.sceneNotes());
        notes.setPromptText("Szenennotizen");
        notes.setPrefRowCount(2);
        notes.getStyleClass().add(STYLE_COMPACT);
        Runnable publishDraft = () -> rawPublishSceneDraft(
                scene.sceneDraftWidgetToken(),
                scene.sceneToken(),
                title.getText(),
                notes.getText(),
                location.selectedLocationId());
        title.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        notes.textProperty().addListener((ignored, before, after) -> publishDraft.run());
        location.valueProperty().addListener((ignored, before, after) -> publishDraft.run());

        Button save = actionButton(
                "Szene speichern",
                event -> rawPublishSceneText(
                        event,
                        scene.sceneSaveWidgetToken(),
                        scene.sceneToken(),
                        title.getText(),
                        notes.getText(),
                        location.selectedLocationId()),
                STYLE_ACCENT);

        return new VBox(
                6,
                label("Szene", "session-planner-gap-title"),
                label(scene.locationLabel(), STYLE_TEXT_SECONDARY),
                title,
                notes,
                actionRow(location, save));
    }

    private Node lootSection(SessionPlannerViewModel.TimelineProjection.SceneModel scene) {
        Button addButton = actionButton(
                "Loot-Platzhalter",
                event -> rawPublishScene(event, scene.addLootWidgetToken(), scene.sceneToken()),
                STYLE_ACCENT);
        VBox rows = new VBox(6);
        if (scene.lootPlaceholders().isEmpty()) {
            addNode(rows, label(
                    "Keine Loot-Platzhalter fuer diese Szene.",
                    STYLE_TEXT_SECONDARY,
                    "session-planner-empty"));
        } else {
            for (SessionPlannerViewModel.TimelineProjection.LootModel loot : scene.lootPlaceholders()) {
                addNode(rows, lootCard(loot));
            }
        }
        return new VBox(
                6,
                new ActionRow(8, label("Loot", "session-planner-gap-title"), addButton),
                rows);
    }

    private Node lootCard(SessionPlannerViewModel.TimelineProjection.LootModel loot) {
        Label label = label(loot.label());
        Button remove = actionButton(
                "Entfernen",
                event -> rawPublishLoot(event, loot.removeWidgetToken(), loot.token()),
                STYLE_FLAT);
        ActionRow row = new ActionRow(8, label, remove);
        row.addStyles("session-planner-loot-card");
        return row;
    }

    private Node restGapCard(
            SessionPlannerViewModel.TimelineProjection.RestGapModel gap,
            int leftScene,
            int rightScene
    ) {
        Label title = label(
                "Zwischen Szene " + leftScene + " und " + rightScene,
                "session-planner-gap-title");
        Label current = label(gap.label(), gap.hasAssignedRest() ? "session-planner-gap-active" : STYLE_TEXT_SECONDARY);

        Button shortRest = actionButton("Kurze Rast",
                event -> rawPublishRestGap(
                        event,
                        gap.shortRestWidgetToken(),
                        gap.leftSceneToken(),
                        gap.rightSceneToken()),
                STYLE_FLAT);
        Button longRest = actionButton("Lange Rast",
                event -> rawPublishRestGap(
                        event,
                        gap.longRestWidgetToken(),
                        gap.leftSceneToken(),
                        gap.rightSceneToken()),
                STYLE_FLAT);
        Button clear = actionButton("Leeren",
                event -> rawPublishRestGap(
                        event,
                        gap.clearRestWidgetToken(),
                        gap.leftSceneToken(),
                        gap.rightSceneToken()),
                STYLE_FLAT);
        clear.setDisable(!gap.hasAssignedRest());

        VBox card = new VBox(6, title, current, actionRow(shortRest, longRest, clear));
        addStyles(card, "session-planner-gap-card");
        return card;
    }

    private void rawPublish(ActionEvent event, long widgetToken) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                0L,
                0L,
                0L,
                0L,
                -1,
                "",
                "",
                "",
                0L));
    }

    private void rawPublishScene(ActionEvent event, long widgetToken, long sceneToken) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                sceneToken,
                0L,
                0L,
                0L,
                0L,
                -1,
                "",
                "",
                "",
                0L));
    }

    private void rawPublishRestGap(ActionEvent event, long widgetToken, long leftSceneToken, long rightSceneToken) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                leftSceneToken,
                rightSceneToken,
                0L,
                0L,
                -1,
                "",
                "",
                "",
                0L));
    }

    private void rawPublishLoot(ActionEvent event, long widgetToken, long lootToken) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                0L,
                0L,
                lootToken,
                0L,
                -1,
                "",
                "",
                "",
                0L));
    }

    private void rawPublishSceneText(
            ActionEvent event,
            long widgetToken,
            long sceneToken,
            String sceneTitle,
            String sceneNotes,
            long locationId
    ) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                sceneToken,
                0L,
                0L,
                0L,
                0L,
                -1,
                "",
                sceneTitle,
                sceneNotes,
                locationId));
    }

    private void rawPublishSceneDraft(
            long widgetToken,
            long sceneToken,
            String sceneTitle,
            String sceneNotes,
            long locationId
    ) {
        publish(new SessionPlannerViewModel.TimelineInput(
                widgetToken,
                sceneToken,
                0L,
                0L,
                0L,
                0L,
                -1,
                "",
                sceneTitle,
                sceneNotes,
                locationId));
    }

    private void rawPublishParticipantAdd(
            ActionEvent event,
            long widgetToken,
            ComboBox<String> participantSelector
    ) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                0L,
                0L,
                0L,
                0L,
                participantSelector.getSelectionModel().getSelectedIndex(),
                "",
                "",
                "",
                0L));
    }

    private void rawPublishParticipantRemove(ActionEvent event, long widgetToken, long participantId) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                0L,
                0L,
                0L,
                participantId,
                -1,
                "",
                "",
                "",
                0L));
    }

    private void rawPublishEncounterDays(ActionEvent event, long widgetToken, String encounterDays) {
        publish(new SessionPlannerViewModel.TimelineInput(
                rawWidgetToken(event, widgetToken),
                0L,
                0L,
                0L,
                0L,
                0L,
                -1,
                encounterDays,
                "",
                "",
                0L));
    }

    private long rawWidgetToken(ActionEvent event, long widgetToken) {
        return event.getSource() instanceof Node ? Math.max(0L, widgetToken) : 0L;
    }

    private void publish(SessionPlannerViewModel.TimelineInput event) {
        viewInputEventHandler.accept(event);
    }

    private static String generatedLabelSuffix(
            SessionPlannerViewModel.TimelineProjection.SceneModel scene
    ) {
        return scene.linkedEncounterGeneratedLabel().isBlank() ? "" : " · " + scene.linkedEncounterGeneratedLabel();
    }

    private static Label label(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private static Button actionButton(
            String text,
            EventHandler<ActionEvent> action,
            String emphasisStyle
    ) {
        Button button = new StyledButton(text, STYLE_COMPACT, emphasisStyle);
        button.setOnAction(action);
        return button;
    }

    private static HBox actionRow(Node... actions) {
        return new ActionRow(6, actions);
    }

    private static Region spacer() {
        Region region = new Region();
        HBox.setHgrow(region, Priority.ALWAYS);
        return region;
    }

    private static void clearNodes(VBox box) {
        box.getChildren().clear();
    }

    private static void addNode(VBox box, Node child) {
        box.getChildren().add(child);
    }

    private static void addStyles(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    enum GenerationAction {
        GENERATE,
        APPLY
    }

    record GenerationInput(
            GenerationAction action,
            String encounterCountText,
            String seedText,
            long generationId
    ) {
        GenerationInput {
            action = action == null ? GenerationAction.GENERATE : action;
            encounterCountText = encounterCountText == null ? "" : encounterCountText;
            seedText = seedText == null ? "" : seedText;
            generationId = Math.max(0L, generationId);
        }
    }

    private static final class ActionRow extends HBox {

        private ActionRow(double spacing, Node... actions) {
            super(spacing, actions);
            setAlignment(Pos.CENTER_LEFT);
        }

        private void addStyles(String... styleClasses) {
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class LocationComboBox
            extends ComboBox<SessionPlannerViewModel.TimelineProjection.LocationChoice> {

        private LocationComboBox(
                List<SessionPlannerViewModel.TimelineProjection.LocationChoice> choices,
                long selectedLocationId
        ) {
            getItems().setAll(choices == null ? List.of() : choices);
            getSelectionModel().select(choiceForLocationId(selectedLocationId));
            setPromptText("Location");
            getStyleClass().add(STYLE_COMPACT);
            setConverter(new StringConverter<>() {
                @Override
                public String toString(SessionPlannerViewModel.TimelineProjection.LocationChoice value) {
                    return value == null ? "" : value.toString();
                }

                @Override
                public SessionPlannerViewModel.TimelineProjection.LocationChoice fromString(String text) {
                    return null;
                }
            });
        }

        private long selectedLocationId() {
            SessionPlannerViewModel.TimelineProjection.LocationChoice selected = getValue();
            return selected == null ? 0L : selected.id();
        }

        private SessionPlannerViewModel.TimelineProjection.LocationChoice choiceForLocationId(
                long selectedLocationId
        ) {
            for (SessionPlannerViewModel.TimelineProjection.LocationChoice choice : getItems()) {
                if (choice.id() == selectedLocationId) {
                    return choice;
                }
            }
            return getItems().isEmpty() ? null : getItems().getFirst();
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

}
