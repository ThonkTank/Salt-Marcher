package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import javafx.application.Platform;
import javafx.geometry.Pos;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterCombatStateView extends VBox {

    static final String STYLE_ACCENT = "accent";
    static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final Label combatRoundLabel = new CombatStyledLabel("", "title");
    private final Label combatStatusLabel = new CombatStyledLabel("", STYLE_TEXT_SECONDARY);
    private final CombatStyledVBox combatCardList = new CombatStyledVBox(6, "encounter-combat-card-list");
    private final CombatActionBar endCombatActions = new CombatActionBar();
    private final Button addPartyButton = new CombatStyledButton("SC hinzufuegen", "compact", "neutral-action");
    private final VBox dialog = buildPane();
    private Consumer<EncounterCombatStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterCombatStateView() {
        addPartyButton.setId("encounter-add-party-button");
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterCombatStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(EncounterCombatStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        showPanel(contentModel, contentModel.panelProperty().get());
        contentModel.panelProperty().addListener((ignored, before, after) -> showPanel(contentModel, after));
    }

    private void showPanel(
            EncounterCombatStateContentModel contentModel,
            EncounterCombatStateContentModel.PanelModel panel
    ) {
        EncounterCombatStateContentModel.PanelModel safePanel = contentModel.safePanel(panel);
        combatRoundLabel.setText("Runde " + safePanel.round());
        combatStatusLabel.setText(safePanel.status());
        showPartyCandidates(
                safePanel.missingPartyMembers(),
                this::publishPartyMemberJoin);
        showCombatCards(safePanel.cards(), contentModel, new CombatCardActionSink());
        showEndCombatState(safePanel.allEnemiesDefeated());
    }

    private VBox buildPane() {
        HBox actions = new HBox(addPartyButton);
        actions.setAlignment(Pos.CENTER_RIGHT);
        VBox header = new VBox(2, combatRoundLabel, combatStatusLabel, actions);

        CombatStyledButton nextTurnButton = new CombatStyledButton("\u25B6 _Weiter", STYLE_ACCENT);
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(event -> publish(new EncounterCombatStateViewInputEvent.AdvanceTurnInput()));
        endCombatActions.setAlignment(Pos.CENTER);
        HBox.setHgrow(nextTurnButton, Priority.ALWAYS);
        HBox.setHgrow(endCombatActions, Priority.ALWAYS);
        HBox footer = new HBox(8, nextTurnButton, endCombatActions);
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new CombatStyledVBox(10, "dialog-surface", header, combatCardList, footer);
        setVgrow(combatCardList, Priority.ALWAYS);
        return nextDialog;
    }

    private void showCombatCards(
            List<EncounterCombatStateContentModel.CardView> cards,
            EncounterCombatStateContentModel contentModel,
            EncounterCombatCardActions actions
    ) {
        List<Node> cardNodes = new ArrayList<>();
        for (EncounterCombatStateContentModel.CardView card : cards == null ? List.<EncounterCombatStateContentModel.CardView>of() : cards) {
            cardNodes.add(new EncounterCombatCardPane(card, contentModel, actions));
        }
        combatCardList.setContent(cardNodes);
    }

    private void showEndCombatState(boolean allEnemiesDefeated) {
        CombatStyledButton end = new CombatStyledButton(
                "_Kampf beenden",
                allEnemiesDefeated ? STYLE_ACCENT : "");
        end.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(end, Priority.ALWAYS);
        end.setOnAction(event -> showEndCombatConfirmState(allEnemiesDefeated));
        endCombatActions.setContent(end);
    }

    private void showEndCombatConfirmState(boolean allEnemiesDefeated) {
        CombatStyledButton cancel = new CombatStyledButton("Abbruch");
        CombatStyledButton confirm = allEnemiesDefeated
                ? new CombatStyledButton("_Bestaetigen!", STYLE_ACCENT)
                : new CombatStyledButton("_Bestaetigen!");
        cancel.setMaxWidth(Double.MAX_VALUE);
        confirm.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(cancel, Priority.ALWAYS);
        HBox.setHgrow(confirm, Priority.ALWAYS);
        cancel.setOnAction(event -> showEndCombatState(allEnemiesDefeated));
        confirm.setOnAction(event -> publish(new EncounterCombatStateViewInputEvent.EndCombatInput()));
        endCombatActions.setContent(cancel, confirm);
    }

    private void showPartyCandidates(
            List<EncounterCombatStateContentModel.PartyMemberCandidate> candidates,
            EncounterPartyMemberSelectionListener selectionListener
    ) {
        List<EncounterCombatStateContentModel.PartyMemberCandidate> safeCandidates =
                candidates == null ? List.of() : List.copyOf(candidates);
        addPartyButton.setDisable(safeCandidates.isEmpty());
        addPartyButton.setTooltip(new Tooltip(safeCandidates.isEmpty()
                ? "Alle aktiven SCs sind im Kampf."
                : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
        addPartyButton.setOnAction(event -> showPartyMemberPopup(
                addPartyButton,
                safeCandidates,
                selectionListener == null ? (memberId, initiative) -> { } : selectionListener));
    }

    private void publish(EncounterCombatStateViewInputEvent.Interaction input) {
        viewInputEventHandler.accept(new EncounterCombatStateViewInputEvent(input));
    }

    private void publishPartyMemberJoin(long partyMemberId, int initiativeValue) {
        publish(new EncounterCombatStateViewInputEvent.PartyMemberJoinInput(partyMemberId, initiativeValue));
    }

    private final class CombatCardActionSink implements EncounterCombatCardActions {

        @Override
        public void changeHitPoints(String cardId, String actionId, int amount) {
            publish(new EncounterCombatStateViewInputEvent.HpChangeInput(cardId, amount, actionId == null || !actionId.startsWith("-")));
        }

        @Override
        public void editInitiative(String cardId, int initiative) {
            publish(new EncounterCombatStateViewInputEvent.InitiativeEditInput(cardId, initiative));
        }
    }

    private static final class EncounterCombatCardPane extends VBox {

        private static final int MULTI_COUNT_MINIMUM = 1;
        private static final int HP_POPUP_STEP = 1;

        EncounterCombatCardPane(
                EncounterCombatStateContentModel.CardView card,
                EncounterCombatStateContentModel contentModel,
                EncounterCombatCardActions actions
        ) {
            super(4, buildHeader(card, contentModel, actions), buildDetail(card.detail()));
            getStyleClass().add("combat-card");
            applyCardStateStyle(card);
        }

        private void applyCardStateStyle(EncounterCombatStateContentModel.CardView card) {
            if (card.active()) {
                getStyleClass().add("combat-card-active");
                return;
            }
            if (!card.alive()) {
                getStyleClass().add("combat-card-dead");
                return;
            }
            if (card.playerCharacter()) {
                getStyleClass().add("combat-card-pc");
            }
        }

        private static Node buildHeader(
                EncounterCombatStateContentModel.CardView card,
                EncounterCombatStateContentModel contentModel,
                EncounterCombatCardActions actions
        ) {
            List<Node> nodes = new ArrayList<>();
            nodes.add(new CombatStyledLabel(
                    card.active() ? "\u25B6" : "",
                    card.active() ? "combat-turn-indicator" : "combat-turn-indicator-inactive"));
            nodes.add(buildName(card.name(), card.alive()));
            nodes.add(headerSpacer());
            if (!card.playerCharacter()) {
                nodes.add(buildHpMeter(card, contentModel, actions));
                if (card.count() > MULTI_COUNT_MINIMUM) {
                    nodes.add(new CombatStyledLabel("x" + card.count(), "ac-badge"));
                }
                nodes.add(new CombatStyledLabel("AC " + card.armorClass(), "ac-badge"));
            }
            nodes.add(buildInitiativeButton(card, actions));
            HBox header = new HBox(8, nodes.toArray(Node[]::new));
            header.setAlignment(Pos.CENTER_LEFT);
            return header;
        }

        private static CombatStyledLabel buildName(String name, boolean alive) {
            CombatStyledLabel label = new CombatStyledLabel(alive ? name : "\u2020 " + name, "combat-name");
            if (!alive) {
                label.addStyles("combat-name-dead");
            }
            return label;
        }

        private static Node headerSpacer() {
            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            return spacer;
        }

        private static Node buildHpMeter(
                EncounterCombatStateContentModel.CardView card,
                EncounterCombatStateContentModel contentModel,
                EncounterCombatCardActions actions
        ) {
            return new EncounterCombatHpMeter(
                    card.id(),
                    contentModel.hpMeterDisplay(card),
                    actions);
        }

        private static Button buildInitiativeButton(
                EncounterCombatStateContentModel.CardView card,
                EncounterCombatCardActions actions
        ) {
            EncounterInitiativeEditorPopup popup = new EncounterInitiativeEditorPopup();
            CombatStyledButton button = new CombatStyledButton("Init " + card.initiative(), "compact", "init-badge");
            button.setOnAction(event -> popup.show(
                    button,
                    card.initiative(),
                    value -> actions.editInitiative(card.id(), value)));
            return button;
        }

        private static Node buildDetail(String detail) {
            CombatStyledLabel label = new CombatStyledLabel(detail, "combat-detail");
            label.setWrapText(true);
            return label;
        }
    }

    private interface EncounterCombatCardActions {

        void changeHitPoints(String cardId, String actionId, int amount);

        void editInitiative(String cardId, int initiative);
    }

    private static final class EncounterCombatHpMeter extends StackPane {

        EncounterCombatHpMeter(
                String cardId,
                EncounterCombatStateContentModel.HpMeterDisplay display,
                EncounterCombatCardActions actions
        ) {
            String safeCardId = cardId == null ? "" : cardId;
            getStyleClass().add("progress-meter");
            getStyleClass().add("progress-meter-combat");
            getStyleClass().add("clickable");
            Region fill = new CombatProgressFill(display.fillStyleClass());
            fill.prefWidthProperty().bind(widthProperty().multiply(display.fraction()));
            Label overlay = new CombatProgressOverlayLabel(display.text());
            overlay.setMouseTransparent(true);
            getChildren().addAll(fill, overlay);
            setAlignment(fill, Pos.CENTER_LEFT);
            setAlignment(overlay, Pos.CENTER);
            setAccessibleText(display.accessibleText());
            setOnMouseClicked(event -> {
                if (actions != null) {
                    showHpPopup(this, safeCardId, actions);
                }
            });
        }

        private static void showHpPopup(
                Node anchor,
                String cardId,
                EncounterCombatCardActions actions
        ) {
            EncounterPopupNumberField amountField =
                    new EncounterPopupNumberField(String.valueOf(EncounterCombatCardPane.HP_POPUP_STEP));
            CombatStyledHBox popupContent = new CombatStyledHBox(4, "anchored-popup");
            ContextMenu popup = contextMenu(popupContent);
            CombatStyledButton decrease = actionButton(
                    "-",
                    "-hp",
                    true,
                    () -> {
                        popup.hide();
                        actions.changeHitPoints(cardId, "-hp", amountField.parse(EncounterCombatCardPane.HP_POPUP_STEP));
                    });
            CombatStyledButton increase = actionButton(
                    "+",
                    "+hp",
                    false,
                    () -> {
                        popup.hide();
                        actions.changeHitPoints(cardId, "+hp", amountField.parse(EncounterCombatCardPane.HP_POPUP_STEP));
                    });
            popupContent.setContent(
                    amountField,
                    spinnerButton("\u25BC", amountField, -1),
                    spinnerButton("\u25B2", amountField, 1),
                    decrease,
                    increase);
            popup.show(anchor, Side.BOTTOM, 0.0, 8.0);
            Platform.runLater(amountField::requestFocus);
        }

        private static CombatStyledButton actionButton(
                String label,
                String actionId,
                boolean defaultButton,
                Runnable action
        ) {
            CombatStyledButton button = new CombatStyledButton(label);
            button.setId(actionId);
            button.setDefaultButton(defaultButton);
            button.setOnAction(event -> action.run());
            return button;
        }

        private static Button spinnerButton(
                String label,
                EncounterPopupNumberField amountField,
                int delta
        ) {
            CombatStyledButton button = new CombatStyledButton(label, "spinner-btn");
            button.setFocusTraversable(false);
            button.setOnAction(event -> amountField.adjust(EncounterCombatCardPane.HP_POPUP_STEP, delta));
            return button;
        }
    }

    @FunctionalInterface
    private interface EncounterPartyMemberSelectionListener {
        void onPartyMemberSelected(long memberId, int initiative);
    }

    private static void showPartyMemberPopup(
            Node anchor,
            List<EncounterCombatStateContentModel.PartyMemberCandidate> candidates,
            EncounterPartyMemberSelectionListener selectionListener
    ) {
            if (anchor == null || candidates == null || candidates.isEmpty()) {
                return;
            }
            EncounterPopupNumberField firstField = null;
            CombatStyledVBox popupContent = new CombatStyledVBox(6, "anchored-popup");
            ContextMenu popup = contextMenu(popupContent);
            List<Node> rows = new ArrayList<>();
            for (EncounterCombatStateContentModel.PartyMemberCandidate candidate : candidates) {
                EncounterPopupNumberField initiativeField = new EncounterPopupNumberField("10");
                initiativeField.setAccessibleText("Initiative fuer " + candidate.name());
                Button down = spinnerButton("\u25BC");
                Button up = spinnerButton("\u25B2");
                down.setOnAction(event -> initiativeField.adjust(10, -1));
                up.setOnAction(event -> initiativeField.adjust(10, 1));

                CombatStyledButton add = new CombatStyledButton("Hinzufuegen", STYLE_ACCENT);
                add.setOnAction(event -> {
                    popup.hide();
                    selectionListener.onPartyMemberSelected(candidate.memberId(), initiativeField.parse(10));
                });
                initiativeField.setOnAction(event -> add.fire());

                CombatStyledLabel name = new CombatStyledLabel(
                        candidate.name() + " (Lv. " + candidate.level() + ")",
                        "combat-name");
                HBox.setHgrow(name, Priority.ALWAYS);
                HBox row = new HBox(6, name, down, initiativeField, up, add);
                row.setAlignment(Pos.CENTER_LEFT);
                rows.add(row);
                if (firstField == null) {
                    firstField = initiativeField;
                }
            }
            popupContent.setContent(rows);
            popup.show(anchor, Side.BOTTOM, 0.0, 8.0);
            if (firstField != null) {
                EncounterPopupNumberField focusTarget = firstField;
                Platform.runLater(focusTarget::requestFocus);
            }
    }

    private static Button spinnerButton(String text) {
        CombatStyledButton button = new CombatStyledButton(text, "spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }

    private static final class EncounterInitiativeEditorPopup {

        void show(Node anchor, int currentInitiative, IntConsumer onApply) {
            if (anchor == null || onApply == null) {
                return;
            }
            EncounterPopupNumberField field = new EncounterPopupNumberField(String.valueOf(currentInitiative));
            CombatStyledHBox popupContent = new CombatStyledHBox(4, "anchored-popup");
            ContextMenu popup = contextMenu(popupContent);
            Button down = spinnerButton("\u25BC");
            Button up = spinnerButton("\u25B2");
            down.setOnAction(event -> field.adjust(currentInitiative, -1));
            up.setOnAction(event -> field.adjust(currentInitiative, 1));
            CombatStyledButton set = new CombatStyledButton("\u2713 Setzen", STYLE_ACCENT);
            set.setDefaultButton(true);
            set.setOnAction(event -> {
                popup.hide();
                onApply.accept(field.parse(currentInitiative));
            });
            field.setOnAction(event -> set.fire());
            popupContent.setContent(down, field, up, set);
            popup.show(anchor, Side.BOTTOM, 0.0, 8.0);
            Platform.runLater(field::requestFocus);
        }

        private static Button spinnerButton(String text) {
            CombatStyledButton button = new CombatStyledButton(text, "spinner-btn");
            button.setFocusTraversable(false);
            return button;
        }
    }

    private static ContextMenu contextMenu(Node content) {
        CustomMenuItem menuItem = new CustomMenuItem(content, false);
        ContextMenu menu = new ContextMenu(menuItem);
        menu.setAutoHide(true);
        return menu;
    }

    private static final class EncounterPopupNumberField extends TextField {

        EncounterPopupNumberField(String initial) {
            super(initial);
            getStyleClass().add("text-field");
            getStyleClass().add("encounter-popup-number-field");
            setTextFormatter(new TextFormatter<>(change ->
                    change.getText().matches("[0-9-]*") ? change : null));
        }

        void adjust(int fallback, int delta) {
            setText(String.valueOf(parse(fallback) + delta));
        }

        int parse(int fallback) {
            try {
                return Integer.parseInt(getText().trim());
            } catch (NumberFormatException exception) {
                return fallback;
            }
        }
    }

    private static final class CombatStyledLabel extends Label {

        CombatStyledLabel(String text, String... styleClasses) {
            super(text);
            addStyles(styleClasses);
        }

        void addStyles(String... styleClasses) {
            for (String styleClass : styleClasses) {
                if (styleClass != null && !styleClass.isBlank()) {
                    getStyleClass().add(styleClass);
                }
            }
        }
    }

    private static final class CombatStyledButton extends Button {

        CombatStyledButton(String text, String... styleClasses) {
            super(text);
            addStyles(styleClasses);
        }

        void addStyles(String... styleClasses) {
            for (String styleClass : styleClasses) {
                if (styleClass != null && !styleClass.isBlank()) {
                    getStyleClass().add(styleClass);
                }
            }
        }
    }

    private static final class CombatStyledHBox extends HBox {

        CombatStyledHBox(double spacing, String styleClass, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
            setAlignment(Pos.CENTER_LEFT);
        }

        void setContent(Node... nodes) {
            getChildren().setAll(nodes);
        }
    }

    private static final class CombatStyledVBox extends VBox {

        CombatStyledVBox(double spacing, String styleClass, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
        }

        void setContent(List<Node> rows) {
            getChildren().setAll(rows);
        }
    }

    private static final class CombatActionBar extends HBox {

        CombatActionBar() {
            super(6);
        }

        void setContent(Node... nodes) {
            getChildren().setAll(nodes);
        }
    }

    private static final class CombatProgressFill extends Region {

        CombatProgressFill(String displayStyleClass) {
            getStyleClass().add("progress-meter-fill");
            if (!displayStyleClass.isBlank()) {
                getStyleClass().add(displayStyleClass);
            }
        }
    }

    private static final class CombatProgressOverlayLabel extends Label {

        CombatProgressOverlayLabel(String text) {
            super(text);
            getStyleClass().add("progress-meter-text");
        }
    }
}
