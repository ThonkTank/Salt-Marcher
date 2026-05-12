package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterContentModel;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;

public final class EncounterCombatStateView extends VBox {

    static final String STYLE_ACCENT = "accent";
    static final String STYLE_TEXT_SECONDARY = "text-secondary";
    static final String ACTION_HP_DECREASE = "hp-decrease";
    static final String ACTION_HP_INCREASE = "hp-increase";

    private final CombatStyledLabel combatRoundLabel = new CombatStyledLabel("", "title");
    private final CombatStyledLabel combatStatusLabel = new CombatStyledLabel("", STYLE_TEXT_SECONDARY);
    private final EncounterCombatCardList combatCardList = new EncounterCombatCardList();
    private final EncounterEndCombatActions endCombatActions = new EncounterEndCombatActions(this::publish);
    private final EncounterPartyMemberAction addPartyButton = new EncounterPartyMemberAction();
    private final DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
    private final DialogSurfaceView dialog = buildPane();
    private Consumer<EncounterCombatStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterCombatStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterCombatStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showCombat(EncounterCombatStateViewModel state) {
        EncounterCombatStateViewModel safeState = state == null
                ? EncounterCombatStateViewModel.empty()
                : state;
        combatRoundLabel.setText("Runde " + safeState.round());
        combatStatusLabel.setText(safeState.status());
        addPartyButton.showCandidates(
                safeState.missingPartyMembers(),
                this::publishPartyMemberJoin);
        combatCardList.showCards(safeState.cards(), this::publish);
        endCombatActions.showState(safeState.allEnemiesDefeated());
    }

    private DialogSurfaceView buildPane() {
        HBox actions = new HBox(addPartyButton.button());
        actions.setAlignment(Pos.CENTER_RIGHT);
        VBox header = new VBox(2, combatRoundLabel, combatStatusLabel, actions);

        combatCardList.setPadding(DialogSurfaceView.contentInsets());

        CombatStyledButton nextTurnButton = new CombatStyledButton("\u25B6 _Weiter", STYLE_ACCENT);
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(event -> publish(new EncounterCombatStateViewInputEvent.AdvanceTurnInput()));
        endCombatActions.setAlignment(Pos.CENTER);
        DialogSurfaceView.grow(nextTurnButton);
        DialogSurfaceView.grow(endCombatActions);
        HBox footer = new HBox(8, nextTurnButton, endCombatActions);
        footer.setAlignment(Pos.CENTER_LEFT);
        DialogSurfaceView nextDialog = new DialogSurfaceView(header, combatCardList, footer);
        nextDialog.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.SCROLL, true, true);
        return nextDialog;
    }

    private void publish(EncounterCombatStateViewInputEvent.Interaction input) {
        viewInputEventHandler.accept(new EncounterCombatStateViewInputEvent(input));
    }

    private void publishPartyMemberJoin(long partyMemberId, int initiativeValue) {
        publish(new EncounterCombatStateViewInputEvent.PartyMemberJoinInput(partyMemberId, initiativeValue));
    }

    static Button spinnerButton(String text) {
        CombatStyledButton button = new CombatStyledButton(text, "spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }
}

final class EncounterCombatCardList extends VBox {

        EncounterCombatCardList() {
            super(6);
        }

        void showCards(
                List<EncounterCombatCardView> cards,
                Consumer<EncounterCombatStateViewInputEvent.Interaction> publish
        ) {
            List<EncounterCombatCardView> safeCards = cards == null ? List.of() : cards;
            getChildren().setAll(safeCards.stream()
                    .map(card -> new EncounterCombatCardPane(card, publish))
                    .toList());
        }
    }

    final class EncounterCombatCardPane extends VBox {

        private static final int MULTI_COUNT_MINIMUM = 1;
        private static final double HEALTHY_THRESHOLD = 0.5;
        private static final double WOUNDED_THRESHOLD = 0.25;
        private static final int HP_POPUP_STEP = 1;

        EncounterCombatCardPane(
                EncounterCombatCardView card,
                Consumer<EncounterCombatStateViewInputEvent.Interaction> publish
        ) {
            super(4, buildHeader(card, publish), buildDetail(card.detail()));
            getStyleClass().add("combat-card");
            applyCardStateStyle(card);
        }

        private void applyCardStateStyle(EncounterCombatCardView card) {
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
                EncounterCombatCardView card,
                Consumer<EncounterCombatStateViewInputEvent.Interaction> publish
        ) {
            List<Node> nodes = new ArrayList<>();
            nodes.add(new CombatStyledLabel(
                    card.active() ? "\u25B6" : "",
                    card.active() ? "combat-turn-indicator" : "combat-turn-indicator-inactive"));
            nodes.add(buildName(card.name(), card.alive()));
            nodes.add(headerSpacer());
            if (!card.playerCharacter()) {
                nodes.add(buildHpMeter(card, publish));
                if (card.count() > MULTI_COUNT_MINIMUM) {
                    nodes.add(new CombatStyledLabel("x" + card.count(), "ac-badge"));
                }
                nodes.add(new CombatStyledLabel("AC " + card.armorClass(), "ac-badge"));
            }
            nodes.add(buildInitiativeButton(card, publish));
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
                EncounterCombatCardView card,
                Consumer<EncounterCombatStateViewInputEvent.Interaction> publish
        ) {
            double fraction = card.maxHp() > 0
                    ? Math.max(0.0, Math.min(1.0, (double) card.currentHp() / card.maxHp()))
                    : 0.0;
            ProgressMeterContentModel progressMeterContentModel = new ProgressMeterContentModel();
            progressMeterContentModel.showMeter(new ProgressMeterContentModel.MeterDisplay(
                    fraction,
                    (fraction <= WOUNDED_THRESHOLD ? "! " : "") + card.currentHp() + " / " + card.maxHp(),
                    card.name() + " HP " + card.currentHp() + "/" + card.maxHp(),
                    hpFillStyle(fraction),
                    "progress-meter-combat"));
            progressMeterContentModel.configurePopup(
                            "HP bearbeiten",
                            HP_POPUP_STEP,
                            List.of(
                                    new ProgressMeterContentModel.PopupActionModel(
                                            EncounterCombatStateView.ACTION_HP_DECREASE,
                                            "-",
                                            "",
                                            true),
                                    new ProgressMeterContentModel.PopupActionModel(
                                            EncounterCombatStateView.ACTION_HP_INCREASE,
                                            "+",
                                            "",
                                            false)));
            ProgressMeterView progressMeterView = new ProgressMeterView();
            progressMeterView.bind(progressMeterContentModel);
            progressMeterView.onViewInputEvent(event -> publish.accept(hpInput(card.id(), event)));
            return progressMeterView;
        }

        private static String hpFillStyle(double fraction) {
            if (fraction > HEALTHY_THRESHOLD) {
                return "hp-fill-healthy";
            }
            if (fraction > WOUNDED_THRESHOLD) {
                return "hp-fill-wounded";
            }
            return "hp-fill-critical";
        }

        private static EncounterCombatStateViewInputEvent.HpChangeInput hpInput(
                String cardId,
                src.view.slotcontent.primitives.progressmeter.ProgressMeterViewInputEvent event
        ) {
            boolean increase = EncounterCombatStateView.ACTION_HP_INCREASE.equals(event.actionId());
            return new EncounterCombatStateViewInputEvent.HpChangeInput(cardId, event.amount(), increase);
        }

        private static Button buildInitiativeButton(
                EncounterCombatCardView card,
                Consumer<EncounterCombatStateViewInputEvent.Interaction> publish
        ) {
            EncounterInitiativeEditorPopup popup = new EncounterInitiativeEditorPopup();
            CombatStyledButton button = new CombatStyledButton("Init " + card.initiative(), "compact", "init-badge");
            button.setOnAction(event -> popup.show(
                    button,
                    card.initiative(),
                    value -> publish.accept(new EncounterCombatStateViewInputEvent.InitiativeEditInput(card.id(), value))));
            return button;
        }

        private static Node buildDetail(String detail) {
            CombatStyledLabel label = new CombatStyledLabel(detail, "combat-detail");
            label.setWrapText(true);
            return label;
        }
    }

    final class EncounterInitiativeEditorPopup {

        private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
        private final CombatStyledHBox popupContent = new CombatStyledHBox(4, "anchored-popup");
        private final AnchoredPopupView popup = new AnchoredPopupView(popupContent, this::anchor, this::focusTarget);
        private Node anchor;
        private EncounterPopupNumberField focusTarget;

        EncounterInitiativeEditorPopup() {
            popup.bind(popupContentModel);
        }

        void show(Node anchor, int currentInitiative, IntConsumer onApply) {
            this.anchor = anchor;
            EncounterPopupNumberField field = new EncounterPopupNumberField(String.valueOf(currentInitiative));
            focusTarget = field;
            Button down = EncounterCombatStateView.spinnerButton("\u25BC");
            Button up = EncounterCombatStateView.spinnerButton("\u25B2");
            down.setOnAction(event -> field.adjust(currentInitiative, -1));
            up.setOnAction(event -> field.adjust(currentInitiative, 1));
            CombatStyledButton set = new CombatStyledButton("\u2713 Setzen", STYLE_ACCENT);
            set.setDefaultButton(true);
            set.setOnAction(event -> {
                popupContentModel.hide();
                onApply.accept(field.parse(currentInitiative));
            });
            field.setOnAction(event -> set.fire());
            popupContent.setContent(down, field, up, set);
            popupContentModel.showBelow(8.0, true);
        }

        private Node anchor() {
            return anchor;
        }

        private Node focusTarget() {
            return focusTarget;
        }
    }

    final class EncounterPopupNumberField extends TextField {

        EncounterPopupNumberField(String initial) {
            super(initial);
            getStyleClass().add("text-field");
            setPrefWidth(56);
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

    final class EncounterEndCombatActions extends HBox {

        private final Consumer<EncounterCombatStateViewInputEvent.Interaction> publish;

        EncounterEndCombatActions(Consumer<EncounterCombatStateViewInputEvent.Interaction> publish) {
            super(6);
            this.publish = publish;
        }

        void showState(boolean allEnemiesDefeated) {
            CombatStyledButton end = new CombatStyledButton(
                    "_Kampf beenden",
                    allEnemiesDefeated ? STYLE_ACCENT : "");
            end.setMaxWidth(Double.MAX_VALUE);
            setHgrow(end, Priority.ALWAYS);
            end.setOnAction(event -> showConfirmState(allEnemiesDefeated));
            getChildren().setAll(end);
        }

        private void showConfirmState(boolean allEnemiesDefeated) {
            CombatStyledButton cancel = new CombatStyledButton("Abbruch");
            CombatStyledButton confirm = allEnemiesDefeated
                    ? new CombatStyledButton("_Bestätigen!", STYLE_ACCENT)
                    : new CombatStyledButton("_Bestätigen!");
            cancel.setMaxWidth(Double.MAX_VALUE);
            confirm.setMaxWidth(Double.MAX_VALUE);
            setHgrow(cancel, Priority.ALWAYS);
            setHgrow(confirm, Priority.ALWAYS);
            cancel.setOnAction(event -> showState(allEnemiesDefeated));
            confirm.setOnAction(event -> publish.accept(new EncounterCombatStateViewInputEvent.EndCombatInput()));
            getChildren().setAll(cancel, confirm);
        }
    }

    @FunctionalInterface
    interface EncounterPartyMemberSelectionListener {
        void onPartyMemberSelected(long memberId, int initiative);
    }

    final class EncounterPartyMemberAction {

        private static final String CONTROL_ID = "encounter-add-party-button";
        private static final EncounterPartyMemberSelectionListener NO_SELECTION = (memberId, initiative) -> { };

        private final CombatStyledButton button = new CombatStyledButton("SC hinzuf\u00fcgen", "compact", "neutral-action");
        private final EncounterPartyMemberPopup popup = new EncounterPartyMemberPopup();
        private List<EncounterPartyMemberCandidate> candidates = List.of();
        private EncounterPartyMemberSelectionListener selectionListener = NO_SELECTION;

        EncounterPartyMemberAction() {
            button.setId(CONTROL_ID);
            popup.onPartyMemberSelected(this::forwardSelection);
            showCandidates(List.of(), NO_SELECTION);
            button.setOnAction(event -> popup.show(button, candidates));
        }

        Button button() {
            return button;
        }

        void showCandidates(
                List<EncounterPartyMemberCandidate> value,
                EncounterPartyMemberSelectionListener listener
        ) {
            candidates = value == null ? List.of() : List.copyOf(value);
            selectionListener = listener == null ? NO_SELECTION : listener;
            button.setDisable(candidates.isEmpty());
            button.setTooltip(new Tooltip(candidates.isEmpty()
                    ? "Alle aktiven SCs sind im Kampf."
                    : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
        }

        private void forwardSelection(long memberId, int initiative) {
            selectionListener.onPartyMemberSelected(memberId, initiative);
        }
    }

    final class EncounterPartyMemberPopup {

        private static final EncounterPartyMemberSelectionListener NO_SELECTION = (memberId, initiative) -> { };

        private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
        private final CombatStyledVBox popupContent = new CombatStyledVBox(6, "anchored-popup", new Insets(8));
        private final AnchoredPopupView popup = new AnchoredPopupView(popupContent, this::anchor, this::focusTarget);
        private EncounterPartyMemberSelectionListener selectionListener = NO_SELECTION;
        private Node anchor;
        private EncounterPopupNumberField focusTarget;

        EncounterPartyMemberPopup() {
            popup.bind(popupContentModel);
        }

        void onPartyMemberSelected(EncounterPartyMemberSelectionListener listener) {
            selectionListener = listener == null ? NO_SELECTION : listener;
        }

        void show(Node anchor, List<EncounterPartyMemberCandidate> candidates) {
            if (anchor == null || candidates == null || candidates.isEmpty()) {
                return;
            }
            this.anchor = anchor;
            popupContentModel.hide();
            EncounterPopupNumberField firstField = null;
            List<Node> rows = new ArrayList<>();
            for (EncounterPartyMemberCandidate candidate : candidates) {
                EncounterPopupNumberField initiativeField = new EncounterPopupNumberField("10");
                initiativeField.setAccessibleText("Initiative für " + candidate.name());
                Button down = EncounterCombatStateView.spinnerButton("\u25BC");
                Button up = EncounterCombatStateView.spinnerButton("\u25B2");
                down.setOnAction(event -> initiativeField.adjust(10, -1));
                up.setOnAction(event -> initiativeField.adjust(10, 1));

                CombatStyledButton add = new CombatStyledButton("Hinzufügen", STYLE_ACCENT);
                add.setOnAction(event -> selectCandidate(candidate, initiativeField.parse(10)));
                initiativeField.setOnAction(event -> selectCandidate(candidate, initiativeField.parse(10)));

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
            focusTarget = firstField;
            popupContent.setContent(rows);
            popupContentModel.showBelow(8.0, firstField != null);
        }

        private void selectCandidate(
                EncounterPartyMemberCandidate candidate,
                int initiative
        ) {
            popupContentModel.hide();
            selectionListener.onPartyMemberSelected(candidate.memberId(), initiative);
        }

        private Node anchor() {
            return anchor;
        }

        private Node focusTarget() {
            return focusTarget;
        }
    }

    final class CombatStyledLabel extends Label {

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

    final class CombatStyledButton extends Button {

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

    final class CombatStyledHBox extends HBox {

        CombatStyledHBox(double spacing, String styleClass, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
            setAlignment(Pos.CENTER_LEFT);
        }

        void setContent(Node... nodes) {
            getChildren().setAll(nodes);
        }
    }

    final class CombatStyledVBox extends VBox {

        CombatStyledVBox(double spacing, String styleClass, Insets padding, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
            setPadding(padding);
        }

        void setContent(List<Node> rows) {
            getChildren().setAll(rows);
        }
    }
