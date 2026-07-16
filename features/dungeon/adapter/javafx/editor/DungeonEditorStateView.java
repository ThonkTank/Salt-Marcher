package features.dungeon.adapter.javafx.editor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class DungeonEditorStateView extends VBox {
    private static final String CORRIDOR_POINT_Q_ACCESSIBLE = "Korridorpunkt q";
    private static final String CORRIDOR_POINT_R_ACCESSIBLE = "Korridorpunkt r";
    private static final String TRANSITION_DESCRIPTION_ACCESSIBLE = "Übergang Beschreibung";
    private static final String STAIR_SHAPE_ACCESSIBLE = "Treppe Form";
    private static final String STAIR_DIRECTION_ACCESSIBLE = "Treppe Richtung";
    private static final String STAIR_DIMENSION_1_ACCESSIBLE = "Treppe Laenge";
    private static final String STAIR_DIMENSION_2_ACCESSIBLE = "Treppe Ebenenspanne";
    private static final String INCOMPLETE_NEGATIVE_TEXT = "-";
    private static final String CARD_SURFACE_STYLE = "card-surface";
    private static final String CONTENT_CARD_STYLE = "content-card";
    private static final String STATE_CARD_STACK_STYLE = "dungeon-state-card-stack";
    private static final String COORDINATE_ROW_STYLE = "coordinate-row";
    private static final String COORDINATE_FIELD_STYLE = "coordinate-field";
    private static final String SAVE_ACTION_SUFFIX = " speichern";
    private static final String STABLE_STATUS_PLACEHOLDER = " ";

    private final Label body = new Label();
    private final VBox corridorPointCards = new VBox();
    private final VBox transitionDestinationCards = new VBox();
    private final VBox transitionCards = new VBox();
    private final VBox stairGeometryCards = new VBox();
    private final VBox narrationCards = new VBox();
    private final VBox nameCards = new VBox();
    private final TextField corridorPointFocusState = new TextField();
    private final TextField transitionDestinationFocusState = new TextField();
    private final TextArea transitionDescriptionFocusState = new TextArea();
    private final TextArea narrationFocusState = new TextArea();
    private final TextField stairGeometryFocusState = new TextField();
    private Consumer<DungeonEditorStateInput> stateInputHandler = ignored -> {};

    public DungeonEditorStateView() {
        getStyleClass().addAll("surface-root", "control-stack", "dungeon-state-panel");
        corridorPointCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionDestinationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        transitionCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        stairGeometryCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        narrationCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        nameCards.getStyleClass().add(STATE_CARD_STACK_STYLE);
        getChildren().addAll(
                new StateCard(body),
                nameCards,
                corridorPointCards,
                transitionDestinationCards,
                transitionCards,
                stairGeometryCards,
                narrationCards);
    }

    void onStateInput(Consumer<DungeonEditorStateInput> handler) {
        stateInputHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonEditorStatePanelModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.stateProjectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contentModel.stateProjectionProperty().get());
    }

    private void showNarrationCards(
            List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> cards,
            boolean busy,
            String statusText,
            String narrationRenderStructureKey
    ) {
        List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> safeCards =
                cards == null ? List.of() : cards;
        String safeRenderStructureKey = narrationRenderStructureKey == null ? "" : narrationRenderStructureKey;
        if (safeRenderStructureKey.equals(narrationCards.getUserData())
                && focusedTextArea(narrationCards) != null
                && synchronizeExistingNarrationCards(safeCards)) {
            return;
        }
        if (!narrationFocusPending()) {
            rememberCurrentNarrationFocus();
        }
        narrationCards.getChildren().clear();
        for (DungeonEditorStatePanelModel.RoomNarrationCardProjection card : safeCards) {
            narrationCards.getChildren().add(new NarrationCard(card, busy, statusText));
        }
        narrationCards.setUserData(safeRenderStructureKey);
        restoreNarrationFocus();
        clearNarrationFocus();
    }

    private void showProjection(DungeonEditorStatePanelModel.StateProjection projection) {
        body.setText(projection.stateText());
        showCorridorPoint(projection.corridorPoint(), projection.busy());
        showTransitionDestination(projection.transitionDestination(), projection.busy(), projection.statusText());
        showTransitionDescription(projection.transitionDescription(), projection.busy(), projection.statusText());
        showStairGeometry(projection.stairGeometry(), projection.busy(), projection.statusText());
        showNarrationCards(
                projection.narrationCards(),
                projection.busy(),
                projection.statusText(),
                projection.narrationRenderStructureKey());
        showName(projection.name(), projection.busy());
    }

    private void showCorridorPoint(
            DungeonEditorStatePanelModel.CorridorPointProjection corridorPoint,
            boolean busy
    ) {
        if (!corridorPointFocusPending()) {
            rememberCurrentCorridorPointFocus();
        }
        corridorPointCards.getChildren().clear();
        if (corridorPoint != null) {
            corridorPointCards.getChildren().add(new CorridorPointCard(corridorPoint, busy));
        }
        restoreCorridorPointFocus();
        clearCorridorPointFocus();
    }

    private void showTransitionDescription(
            DungeonEditorStatePanelModel.TransitionDescriptionProjection transitionDescription,
            boolean busy,
            String statusText
    ) {
        if (!transitionDescriptionFocusPending()) {
            rememberCurrentTransitionDescriptionFocus();
        }
        transitionCards.getChildren().clear();
        if (transitionDescription != null) {
            transitionCards.getChildren().add(new TransitionDescriptionCard(
                    transitionDescription,
                    busy,
                    statusText));
        }
        restoreTransitionDescriptionFocus();
        clearTransitionDescriptionFocus();
    }

    private void showTransitionDestination(
            DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
            boolean busy,
            String statusText
    ) {
        if (!transitionDestinationFocusPending()) {
            rememberCurrentTransitionDestinationFocus();
        }
        transitionDestinationCards.getChildren().clear();
        if (transitionDestination != null) {
            transitionDestinationCards.getChildren().add(new TransitionDestinationCard(
                    transitionDestination,
                    busy,
                    statusText));
        }
        restoreTransitionDestinationFocus();
        clearTransitionDestinationFocus();
    }

    private void showStairGeometry(
            DungeonEditorStatePanelModel.StairGeometryProjection stairGeometry,
            boolean busy,
            String statusText
    ) {
        if (!stairGeometryFocusPending()) {
            rememberCurrentStairGeometryFocus();
        }
        stairGeometryCards.getChildren().clear();
        if (stairGeometry != null) {
            stairGeometryCards.getChildren().add(new StairGeometryCard(stairGeometry, busy, statusText));
        }
        restoreStairGeometryFocus();
        clearStairGeometryFocus();
    }

    private void showName(
            DungeonEditorStatePanelModel.NameProjection name,
            boolean busy
    ) {
        nameCards.getChildren().clear();
        if (name != null) {
            nameCards.getChildren().add(new NameCard(name, busy));
        }
    }

    private static Label muted(String text) {
        Label label = new MutedLabel(text);
        label.setWrapText(true);
        return label;
    }

    private static Label stableStatusLabel(String statusText) {
        boolean hasStatus = statusText != null && !statusText.isBlank();
        Label label = muted(hasStatus ? statusText : STABLE_STATUS_PLACEHOLDER);
        label.setAccessibleText(hasStatus ? statusText : "");
        label.setOpacity(hasStatus ? 1.0 : 0.0);
        return label;
    }

    private static TextArea textArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
    }

    private static TextField textField(String text) {
        TextField field = new TextField(text == null ? "" : text);
        field.getStyleClass().add(COORDINATE_FIELD_STYLE);
        return field;
    }

    private static ComboBox<String> comboBox(List<String> values, String selected) {
        ComboBox<String> comboBox = new ComboBox<>();
        comboBox.getItems().addAll(values);
        comboBox.getSelectionModel().select(selected == null || selected.isBlank() ? values.getFirst() : selected);
        return comboBox;
    }

    private static ComboBox<String> destinationTypeBox(List<String> values, String selected) {
        ComboBox<String> comboBox = new ComboBox<>();
        comboBox.getItems().addAll(values);
        comboBox.getSelectionModel().select(selected == null || selected.isBlank() ? values.getFirst() : selected);
        return comboBox;
    }

    private static boolean integerFieldText(String text) {
        if (text == null || text.isEmpty()) {
            return true;
        }
        if (INCOMPLETE_NEGATIVE_TEXT.equals(text)) {
            return true;
        }
        try {
            Integer.parseInt(text);
            return true;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static boolean completeIntegerText(String text) {
        return text != null && !text.isBlank() && !INCOMPLETE_NEGATIVE_TEXT.equals(text);
    }

    private void emitNarrationInput(
            long roomId,
            TextArea visualArea,
            List<TextArea> exitAreas,
            boolean saveRequested
    ) {
        List<String> exitDescriptions = new ArrayList<>();
        for (TextArea exitArea : exitAreas) {
            exitDescriptions.add(exitArea.getText());
        }
        stateInputHandler.accept(DungeonEditorStateInput.narration(
                roomId,
                visualArea.getText(),
                exitDescriptions,
                saveRequested));
    }

    private void emitCorridorPointInput(
            TextField qField,
            TextField rField,
            boolean submitRequested
    ) {
        stateInputHandler.accept(DungeonEditorStateInput.corridorPoint(
                qField.getText(),
                rField.getText(),
                submitRequested));
    }

    private void emitNameInput(
            TextField nameField,
            boolean saveRequested
    ) {
        stateInputHandler.accept(DungeonEditorStateInput.labelName(
                nameField.getText(),
                true,
                saveRequested));
    }

    private void emitTransitionDescriptionInput(
            long transitionId,
            TextArea descriptionArea,
            boolean saveRequested
    ) {
        stateInputHandler.accept(DungeonEditorStateInput.transitionDescription(
                transitionId,
                descriptionArea.getText(),
                saveRequested));
    }

    private void emitTransitionDestinationInput(
            ComboBox<String> destinationTypeBox,
            TextField mapIdField,
            TextField tileIdField,
            TextField transitionIdField,
            CheckBox bidirectionalBox,
            boolean saveRequested
        ) {
        stateInputHandler.accept(DungeonEditorStateInput.transitionDestination(
                destinationTypeBox.getSelectionModel().getSelectedIndex(),
                mapIdField.getText(),
                tileIdField.getText(),
                transitionIdField.getText(),
                bidirectionalBox.isSelected(),
                saveRequested));
    }

    private void emitStairGeometryInput(
            long stairId,
            ComboBox<String> shapeBox,
            ComboBox<String> directionBox,
            TextField dimension1Field,
            TextField dimension2Field,
            boolean saveRequested
    ) {
        stateInputHandler.accept(DungeonEditorStateInput.stairGeometry(
                stairId,
                shapeBox.getValue(),
                directionBox.getValue(),
                dimension1Field.getText(),
                dimension2Field.getText(),
                saveRequested));
    }

    private final class CorridorPointCard extends VBox {

        private CorridorPointCard(
                DungeonEditorStatePanelModel.CorridorPointProjection corridorPoint,
                boolean busy
        ) {
            TextField qField = corridorPointCoordinateField(corridorPoint.q(), CORRIDOR_POINT_Q_ACCESSIBLE);
            TextField rField = corridorPointCoordinateField(corridorPoint.r(), CORRIDOR_POINT_R_ACCESSIBLE);
            Label levelValue = muted(corridorPoint.level());
            levelValue.getStyleClass().add("coordinate-value");
            levelValue.setAccessibleText("Korridorpunkt z");
            HBox row = new HBox(
                    coordinateLabel("q", qField),
                    qField,
                    coordinateLabel("r", rField),
                    rField,
                    coordinateLabel("z", levelValue),
                    levelValue);
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            Button move = new ToolbarActionButton("Verschieben");
            move.setAccessibleText(corridorPoint.label() + " verschieben");
            Runnable updateMoveDisabled = () -> move.setDisable(
                    busy || !completeIntegerText(qField.getText()) || !completeIntegerText(rField.getText()));
            qField.textProperty().addListener((ignored, before, after) -> {
                emitCorridorPointInput(qField, rField, false);
                updateMoveDisabled.run();
            });
            rField.textProperty().addListener((ignored, before, after) -> {
                emitCorridorPointInput(qField, rField, false);
                updateMoveDisabled.run();
            });
            updateMoveDisabled.run();
            move.setOnAction(event -> emitCorridorPointInput(qField, rField, true));
            getChildren().addAll(new PanelTitle(corridorPoint.label()), row, move);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label coordinateLabel(String text, Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }
    }

    private TextField corridorPointCoordinateField(String text, String accessibleText) {
        TextField field = new TextField(text == null ? "" : text);
        field.getStyleClass().add(COORDINATE_FIELD_STYLE);
        field.setAccessibleText(accessibleText);
        field.setTextFormatter(new TextFormatter<>(corridorPointIntegerTextFilter(accessibleText)));
        return field;
    }

    private UnaryOperator<TextFormatter.Change> corridorPointIntegerTextFilter(String accessibleText) {
        return change -> {
            if (!integerFieldText(change.getControlNewText())) {
                return null;
            }
            if (change.getControl().isFocused()) {
                rememberCorridorPointFocus(accessibleText, change.getCaretPosition());
            }
            return change;
        };
    }

    private UnaryOperator<TextFormatter.Change> transitionDescriptionTextFilter() {
        return change -> {
            if (change.getControl().isFocused()) {
                rememberTransitionDescriptionFocus(change.getCaretPosition());
            }
            return change;
        };
    }

    private UnaryOperator<TextFormatter.Change> narrationTextFilter(String accessibleText) {
        return change -> {
            if (change.getControl().isFocused()) {
                rememberNarrationFocus(accessibleText, change.getCaretPosition());
            }
            return change;
        };
    }

    private UnaryOperator<TextFormatter.Change> transitionDestinationIntegerTextFilter(String accessibleText) {
        return change -> {
            if (!integerFieldText(change.getControlNewText())) {
                return null;
            }
            if (change.getControl().isFocused()) {
                rememberTransitionDestinationFocus(accessibleText, change.getCaretPosition());
            }
            return change;
        };
    }

    private UnaryOperator<TextFormatter.Change> stairGeometryIntegerTextFilter(String accessibleText) {
        return change -> {
            if (!integerFieldText(change.getControlNewText())) {
                return null;
            }
            if (change.getControl().isFocused()) {
                rememberStairGeometryFocus(accessibleText, change.getCaretPosition());
            }
            return change;
        };
    }

    private void rememberCurrentCorridorPointFocus() {
        TextField qField = corridorPointField(CORRIDOR_POINT_Q_ACCESSIBLE);
        if (qField != null && qField.isFocused()) {
            rememberCorridorPointFocus(qField.getAccessibleText(), qField.getCaretPosition());
            return;
        }
        TextField rField = corridorPointField(CORRIDOR_POINT_R_ACCESSIBLE);
        if (rField != null && rField.isFocused()) {
            rememberCorridorPointFocus(rField.getAccessibleText(), rField.getCaretPosition());
            return;
        }
        clearCorridorPointFocus();
    }

    private void rememberCorridorPointFocus(String accessibleText, int caretPosition) {
        int clampedCaret = Math.max(caretPosition, 0);
        corridorPointFocusState.setAccessibleText(accessibleText);
        corridorPointFocusState.setText(" ".repeat(clampedCaret));
        corridorPointFocusState.positionCaret(clampedCaret);
    }

    private boolean corridorPointFocusPending() {
        String accessibleText = corridorPointFocusState.getAccessibleText();
        return accessibleText != null && !accessibleText.isBlank();
    }

    private void restoreCorridorPointFocus() {
        String accessibleText = corridorPointFocusState.getAccessibleText();
        if (accessibleText == null || accessibleText.isBlank()) {
            return;
        }
        TextField field = corridorPointField(accessibleText);
        if (field != null) {
            field.requestFocus();
            field.positionCaret(Math.min(corridorPointFocusState.getCaretPosition(), field.getLength()));
        }
    }

    private void clearCorridorPointFocus() {
        corridorPointFocusState.setAccessibleText("");
        corridorPointFocusState.clear();
    }

    private @org.jspecify.annotations.Nullable TextField corridorPointField(String accessibleText) {
        return findTextField(corridorPointCards, accessibleText);
    }

    private static @org.jspecify.annotations.Nullable TextField findTextField(Node node, String accessibleText) {
        if (node instanceof TextField field && accessibleText.equals(field.getAccessibleText())) {
            return field;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            TextField found = findTextField(child, accessibleText);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private void rememberCurrentTransitionDescriptionFocus() {
        TextArea area = transitionDescriptionArea();
        if (area != null && area.isFocused()) {
            rememberTransitionDescriptionFocus(area.getCaretPosition());
            return;
        }
        clearTransitionDescriptionFocus();
    }

    private void rememberTransitionDescriptionFocus(int caretPosition) {
        int clampedCaret = Math.max(caretPosition, 0);
        transitionDescriptionFocusState.setAccessibleText(TRANSITION_DESCRIPTION_ACCESSIBLE);
        transitionDescriptionFocusState.setText(" ".repeat(clampedCaret));
        transitionDescriptionFocusState.positionCaret(clampedCaret);
    }

    private boolean transitionDescriptionFocusPending() {
        String accessibleText = transitionDescriptionFocusState.getAccessibleText();
        return accessibleText != null && !accessibleText.isBlank();
    }

    private void restoreTransitionDescriptionFocus() {
        if (!transitionDescriptionFocusPending()) {
            return;
        }
        TextArea area = transitionDescriptionArea();
        if (area != null) {
            area.requestFocus();
            area.positionCaret(Math.min(transitionDescriptionFocusState.getCaretPosition(), area.getLength()));
        }
    }

    private void clearTransitionDescriptionFocus() {
        transitionDescriptionFocusState.setAccessibleText("");
        transitionDescriptionFocusState.clear();
    }

    private @org.jspecify.annotations.Nullable TextArea transitionDescriptionArea() {
        return findTextArea(transitionCards, TRANSITION_DESCRIPTION_ACCESSIBLE);
    }

    private void rememberCurrentTransitionDestinationFocus() {
        Node control = focusedTransitionDestinationControl(transitionDestinationCards);
        if (control instanceof TextField field) {
            rememberTransitionDestinationFocus(field.getAccessibleText(), field.getCaretPosition());
            return;
        }
        if (control != null) {
            rememberTransitionDestinationFocus(control.getAccessibleText(), 0);
            return;
        }
        clearTransitionDestinationFocus();
    }

    private void rememberTransitionDestinationFocus(String accessibleText, int caretPosition) {
        if (accessibleText == null || accessibleText.isBlank()) {
            clearTransitionDestinationFocus();
            return;
        }
        int clampedCaret = Math.max(caretPosition, 0);
        transitionDestinationFocusState.setAccessibleText(accessibleText);
        transitionDestinationFocusState.setText(" ".repeat(clampedCaret));
        transitionDestinationFocusState.positionCaret(clampedCaret);
    }

    private boolean transitionDestinationFocusPending() {
        String accessibleText = transitionDestinationFocusState.getAccessibleText();
        return accessibleText != null && !accessibleText.isBlank();
    }

    private void restoreTransitionDestinationFocus() {
        String accessibleText = transitionDestinationFocusState.getAccessibleText();
        if (accessibleText == null || accessibleText.isBlank()) {
            return;
        }
        Node control = findTransitionDestinationControl(transitionDestinationCards, accessibleText);
        if (control != null) {
            control.requestFocus();
        }
        if (control instanceof TextField field) {
            field.positionCaret(Math.min(transitionDestinationFocusState.getCaretPosition(), field.getLength()));
        }
    }

    private void clearTransitionDestinationFocus() {
        transitionDestinationFocusState.setAccessibleText("");
        transitionDestinationFocusState.clear();
    }

    private static @org.jspecify.annotations.Nullable Node focusedTransitionDestinationControl(Node node) {
        if (supportedTransitionDestinationControl(node) && node.isFocused()) {
            return node;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            Node found = focusedTransitionDestinationControl(child);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private static @org.jspecify.annotations.Nullable Node findTransitionDestinationControl(
            Node node,
            String accessibleText
    ) {
        if (supportedTransitionDestinationControl(node) && accessibleText.equals(node.getAccessibleText())) {
            return node;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            Node found = findTransitionDestinationControl(child, accessibleText);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private static boolean supportedTransitionDestinationControl(Node node) {
        return node instanceof TextField
                || node instanceof ComboBox<?>
                || node instanceof CheckBox;
    }

    private static @org.jspecify.annotations.Nullable TextArea findTextArea(Node node, String accessibleText) {
        if (node instanceof TextArea area && accessibleText.equals(area.getAccessibleText())) {
            return area;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            TextArea found = findTextArea(child, accessibleText);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private void rememberCurrentStairGeometryFocus() {
        Node control = focusedStairGeometryControl(stairGeometryCards);
        if (control instanceof TextField field) {
            rememberStairGeometryFocus(field.getAccessibleText(), field.getCaretPosition());
            return;
        }
        if (control != null) {
            rememberStairGeometryFocus(control.getAccessibleText(), 0);
            return;
        }
        clearStairGeometryFocus();
    }

    private void rememberStairGeometryFocus(String accessibleText, int caretPosition) {
        if (accessibleText == null || accessibleText.isBlank()) {
            clearStairGeometryFocus();
            return;
        }
        int clampedCaret = Math.max(caretPosition, 0);
        stairGeometryFocusState.setAccessibleText(accessibleText);
        stairGeometryFocusState.setText(" ".repeat(clampedCaret));
        stairGeometryFocusState.positionCaret(clampedCaret);
    }

    private boolean stairGeometryFocusPending() {
        String accessibleText = stairGeometryFocusState.getAccessibleText();
        return accessibleText != null && !accessibleText.isBlank();
    }

    private void restoreStairGeometryFocus() {
        String accessibleText = stairGeometryFocusState.getAccessibleText();
        if (accessibleText == null || accessibleText.isBlank()) {
            return;
        }
        Node control = findStairGeometryControl(stairGeometryCards, accessibleText);
        if (control != null) {
            control.requestFocus();
        }
        if (control instanceof TextField field) {
            field.positionCaret(Math.min(stairGeometryFocusState.getCaretPosition(), field.getLength()));
        }
    }

    private void clearStairGeometryFocus() {
        stairGeometryFocusState.setAccessibleText("");
        stairGeometryFocusState.clear();
    }

    private static @org.jspecify.annotations.Nullable Node focusedStairGeometryControl(Node node) {
        if (supportedStairGeometryControl(node) && node.isFocused()) {
            return node;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            Node found = focusedStairGeometryControl(child);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private static @org.jspecify.annotations.Nullable Node findStairGeometryControl(
            Node node,
            String accessibleText
    ) {
        if (supportedStairGeometryControl(node) && accessibleText.equals(node.getAccessibleText())) {
            return node;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            Node found = findStairGeometryControl(child, accessibleText);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private static boolean supportedStairGeometryControl(Node node) {
        return node instanceof TextField || node instanceof ComboBox<?>;
    }

    private void rememberCurrentNarrationFocus() {
        TextArea area = focusedTextArea(narrationCards);
        if (area == null) {
            clearNarrationFocus();
            return;
        }
        rememberNarrationFocus(area.getAccessibleText(), area.getCaretPosition());
    }

    private void rememberNarrationFocus(String accessibleText, int caretPosition) {
        if (accessibleText == null || accessibleText.isBlank()) {
            clearNarrationFocus();
            return;
        }
        int clampedCaret = Math.max(caretPosition, 0);
        narrationFocusState.setAccessibleText(accessibleText);
        narrationFocusState.setText(" ".repeat(clampedCaret));
        narrationFocusState.positionCaret(clampedCaret);
    }

    private boolean narrationFocusPending() {
        String accessibleText = narrationFocusState.getAccessibleText();
        return accessibleText != null && !accessibleText.isBlank();
    }

    private void restoreNarrationFocus() {
        String accessibleText = narrationFocusState.getAccessibleText();
        if (accessibleText == null || accessibleText.isBlank()) {
            return;
        }
        TextArea area = findTextArea(narrationCards, accessibleText);
        if (area != null) {
            area.requestFocus();
            area.positionCaret(Math.min(narrationFocusState.getCaretPosition(), area.getLength()));
        }
    }

    private void clearNarrationFocus() {
        narrationFocusState.setAccessibleText("");
        narrationFocusState.clear();
    }

    private boolean synchronizeExistingNarrationCards(
            List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> cards
    ) {
        Map<String, String> nextTextByAccessibleText = narrationTextByAccessibleText(cards);
        Map<String, TextArea> existingAreas = narrationTextAreasByAccessibleText();
        if (nextTextByAccessibleText.isEmpty() || !existingAreas.keySet().equals(nextTextByAccessibleText.keySet())) {
            return false;
        }
        for (Map.Entry<String, String> entry : nextTextByAccessibleText.entrySet()) {
            TextArea area = existingAreas.get(entry.getKey());
            if (area != null && !area.isFocused() && !entry.getValue().equals(area.getText())) {
                area.setText(entry.getValue());
            }
        }
        return true;
    }

    private static Map<String, String> narrationTextByAccessibleText(
            List<DungeonEditorStatePanelModel.RoomNarrationCardProjection> cards
    ) {
        Map<String, String> result = new HashMap<>();
        for (DungeonEditorStatePanelModel.RoomNarrationCardProjection card : cards) {
            result.put(narrationVisualAccessibleText(card.roomId()), card.visualDescription());
            for (DungeonEditorStatePanelModel.RoomExitNarrationProjection exit : card.exits()) {
                result.put(narrationExitAccessibleText(card.roomId(), exit), exit.description());
            }
        }
        return result;
    }

    private Map<String, TextArea> narrationTextAreasByAccessibleText() {
        Map<String, TextArea> result = new HashMap<>();
        collectTextAreas(narrationCards, result);
        return result;
    }

    private static void collectTextAreas(Node node, Map<String, TextArea> result) {
        if (node instanceof TextArea area) {
            String accessibleText = area.getAccessibleText();
            if (accessibleText != null && !accessibleText.isBlank()) {
                result.put(accessibleText, area);
            }
            return;
        }
        if (!(node instanceof Parent parent)) {
            return;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            collectTextAreas(child, result);
        }
    }

    private static @org.jspecify.annotations.Nullable TextArea focusedTextArea(Node node) {
        if (node instanceof TextArea area && area.isFocused()) {
            return area;
        }
        if (!(node instanceof Parent parent)) {
            return null;
        }
        for (Node child : parent.getChildrenUnmodifiable()) {
            TextArea found = focusedTextArea(child);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private final class NameCard extends VBox {

        private NameCard(DungeonEditorStatePanelModel.NameProjection name, boolean busy) {
            TextField nameField = textField(name.name());
            nameField.setAccessibleText(name.label());
            Label fieldLabel = labeled("Name", nameField);
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText(name.label() + SAVE_ACTION_SUFFIX);
            Runnable updateDisabled = () -> save.setDisable(busy || nameField.getText().isBlank());
            nameField.textProperty().addListener((ignored, before, after) -> {
                emitNameInput(nameField, false);
                updateDisabled.run();
            });
            updateDisabled.run();
            save.setOnAction(event -> emitNameInput(nameField, true));
            getChildren().addAll(new PanelTitle(name.label()), fieldLabel, nameField, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label labeled(String text, Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }
    }

    private final class TransitionDescriptionCard extends VBox {

        private TransitionDescriptionCard(
                DungeonEditorStatePanelModel.TransitionDescriptionProjection transitionDescription,
                boolean busy,
            String statusText
        ) {
            TextArea descriptionArea = textArea(transitionDescription.description());
            descriptionArea.setAccessibleText(TRANSITION_DESCRIPTION_ACCESSIBLE);
            descriptionArea.setTextFormatter(new TextFormatter<>(transitionDescriptionTextFilter()));
            getChildren().addAll(
                    new PanelTitle(transitionDescription.label()),
                    narrationLabel("Beschreibung", descriptionArea),
                    descriptionArea);
            descriptionArea.textProperty().addListener((ignored, before, after) -> emitTransitionDescriptionInput(
                    transitionDescription.transitionId(),
                    descriptionArea,
                    false));
            Label status = stableStatusLabel(statusText);
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText(transitionDescription.label() + SAVE_ACTION_SUFFIX);
            save.setDisable(busy);
            save.setOnAction(event -> emitTransitionDescriptionInput(
                    transitionDescription.transitionId(),
                    descriptionArea,
                    true));
            getChildren().addAll(status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label narrationLabel(String text, TextArea area) {
            Label label = muted(text);
            label.setLabelFor(area);
            return label;
        }
    }

    private final class TransitionDestinationCard extends VBox {

        private TransitionDestinationCard(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                boolean busy,
                String statusText
        ) {
            TransitionDestinationControls controls = createControls(transitionDestination, statusText);
            HBox destinationRow = destinationRow(controls);
            HBox targetRow = targetRow(controls);
            Runnable updateDestinationMode = () -> updateDestinationMode(transitionDestination, controls);
            installInputListeners(controls, updateDestinationMode);
            updateDestinationMode.run();
            configureLinkControls(transitionDestination.controlState(), controls);
            controls.save().setOnAction(event -> emitTransitionDestinationInput(controls, true));
            addCardChildren(transitionDestination, transitionDestination.controlState(), controls, destinationRow, targetRow);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private TransitionDestinationControls createControls(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                String statusText
        ) {
            return transitionDestination.controlState().linkMode()
                    ? createLinkControls(transitionDestination, statusText)
                    : createDestinationControls(transitionDestination, statusText);
        }

        private TransitionDestinationControls createLinkControls(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                String statusText
        ) {
            ComboBox<String> destinationTypeBox = destinationTypeBox(
                    transitionDestination.destinationTypeLabels(),
                    transitionDestination.selectedDestinationTypeLabel());
            TextField mapIdField = transitionDestinationField(transitionDestination.mapId(), "Eingangslink Zielkarte");
            TextField tileIdField = transitionDestinationField(
                    transitionDestination.tileId(),
                    "Eingangslink Zielkachel");
            TextField transitionIdField = transitionDestinationField(
                    transitionDestination.transitionId(),
                    "Eingangslink Zieluebergang");
            CheckBox bidirectionalBox = new CheckBox("Ruecklink zum ausgewaehlten Eingang speichern");
            bidirectionalBox.setSelected(transitionDestination.bidirectional());
            destinationTypeBox.setAccessibleText("Eingangslink Zieltyp");
            bidirectionalBox.setAccessibleText("Ruecklink zum ausgewaehlten Eingang speichern");
            Label sourceLabel = muted("Quelle: ausgewaehlter Übergang");
            Label targetHintLabel = muted(transitionDestination.linkTargetHintText());
            Label destinationTypeLabel = labeled("Zieltyp", destinationTypeBox);
            Label mapIdLabel = labeled("Zielkarte", mapIdField);
            Label tileIdLabel = labeled("Zielkachel", tileIdField);
            Label transitionIdLabel = labeled("Ziel-Eingang", transitionIdField);
            Label status = stableStatusLabel(statusText);
            Button save = new ToolbarActionButton("Eingangslink speichern");
            save.setAccessibleText(transitionDestination.label() + SAVE_ACTION_SUFFIX);
            return new TransitionDestinationControls(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    sourceLabel,
                    targetHintLabel,
                    destinationTypeLabel,
                    mapIdLabel,
                    tileIdLabel,
                    transitionIdLabel,
                    status,
                    save);
        }

        private TransitionDestinationControls createDestinationControls(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                String statusText
        ) {
            ComboBox<String> destinationTypeBox = destinationTypeBox(
                    transitionDestination.destinationTypeLabels(),
                    transitionDestination.selectedDestinationTypeLabel());
            TextField mapIdField = transitionDestinationField(transitionDestination.mapId(), "Übergang Zielkarte");
            TextField tileIdField = transitionDestinationField(transitionDestination.tileId(), "Übergang Zielkachel");
            TextField transitionIdField = transitionDestinationField(
                    transitionDestination.transitionId(),
                    "Übergang Zieluebergang");
            CheckBox bidirectionalBox = new CheckBox("Bidirektional");
            bidirectionalBox.setSelected(transitionDestination.bidirectional());
            destinationTypeBox.setAccessibleText("Übergang Zieltyp");
            bidirectionalBox.setAccessibleText("Übergang bidirektional verknuepfen");
            Label status = stableStatusLabel(statusText);
            Button save = new ToolbarActionButton("Verknüpfen");
            save.setAccessibleText(transitionDestination.label() + SAVE_ACTION_SUFFIX);
            return new TransitionDestinationControls(
                    destinationTypeBox,
                    mapIdField,
                    tileIdField,
                    transitionIdField,
                    bidirectionalBox,
                    muted(""),
                    muted(""),
                    labeled("Typ", destinationTypeBox),
                    labeled("Karte", mapIdField),
                    labeled("Kachel", tileIdField),
                    labeled("Übergang", transitionIdField),
                    status,
                    save);
        }

        private HBox destinationRow(TransitionDestinationControls controls) {
            HBox row = new HBox(
                    controls.destinationTypeLabel(),
                    controls.destinationTypeBox(),
                    controls.mapIdLabel(),
                    controls.mapIdField());
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            return row;
        }

        private HBox targetRow(TransitionDestinationControls controls) {
            HBox row = new HBox(
                    controls.tileIdLabel(),
                    controls.tileIdField(),
                    controls.transitionIdLabel(),
                    controls.transitionIdField());
            row.getStyleClass().add(COORDINATE_ROW_STYLE);
            return row;
        }

        private void updateDestinationMode(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                TransitionDestinationControls controls
        ) {
            applyControlState(transitionDestination.controlStateForOptionIndex(
                    controls.destinationTypeBox().getSelectionModel().getSelectedIndex(),
                    controls.mapIdField().getText(),
                    controls.transitionIdField().getText()), controls);
        }

        private void applyControlState(
                DungeonEditorStatePanelModel.TransitionDestinationControlState controlState,
                TransitionDestinationControls controls
        ) {
            controls.destinationTypeBox().setDisable(controlState.destinationTypeDisabled());
            controls.mapIdField().setDisable(controlState.mapIdDisabled());
            controls.tileIdField().setDisable(controlState.tileIdDisabled());
            controls.transitionIdField().setDisable(controlState.transitionIdDisabled());
            controls.bidirectionalBox().setDisable(controlState.bidirectionalDisabled());
            controls.mapIdLabel().setDisable(controlState.mapIdLabelDisabled());
            controls.tileIdLabel().setDisable(controlState.tileIdLabelDisabled());
            controls.transitionIdLabel().setDisable(controlState.transitionIdLabelDisabled());
            controls.save().setDisable(controlState.saveDisabled());
        }

        private void installInputListeners(
                TransitionDestinationControls controls,
                Runnable updateDestinationMode
        ) {
            controls.destinationTypeBox().valueProperty().addListener((ignored, before, after) -> {
                rememberTransitionDestinationFocus(controls.destinationTypeBox().getAccessibleText(), 0);
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.mapIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.tileIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.transitionIdField().textProperty().addListener((ignored, before, after) -> {
                emitTransitionDestinationInput(controls, false);
                updateDestinationMode.run();
            });
            controls.bidirectionalBox().selectedProperty().addListener((ignored, before, after) -> {
                rememberTransitionDestinationFocus(controls.bidirectionalBox().getAccessibleText(), 0);
                emitTransitionDestinationInput(controls, false);
            });
        }

        private void configureLinkControls(
                DungeonEditorStatePanelModel.TransitionDestinationControlState controlState,
                TransitionDestinationControls controls
        ) {
            controls.save().setVisible(controlState.linkMode());
            controls.save().setManaged(controlState.linkMode());
            controls.bidirectionalBox().setVisible(controlState.linkMode());
            controls.bidirectionalBox().setManaged(controlState.linkMode());
        }

        private void addCardChildren(
                DungeonEditorStatePanelModel.TransitionDestinationProjection transitionDestination,
                DungeonEditorStatePanelModel.TransitionDestinationControlState controlState,
                TransitionDestinationControls controls,
                HBox destinationRow,
                HBox targetRow
        ) {
            getChildren().add(new PanelTitle(transitionDestination.label()));
            if (controlState.linkMode()) {
                getChildren().add(controls.sourceLabel());
            }
            getChildren().add(destinationRow);
            if (controlState.linkMode()) {
                getChildren().add(controls.targetHintLabel());
            }
            getChildren().addAll(targetRow, controls.bidirectionalBox(), controls.status(), controls.save());
        }

        private void emitTransitionDestinationInput(
                TransitionDestinationControls controls,
                boolean saveRequested
        ) {
            DungeonEditorStateView.this.emitTransitionDestinationInput(
                    controls.destinationTypeBox(),
                    controls.mapIdField(),
                    controls.tileIdField(),
                    controls.transitionIdField(),
                    controls.bidirectionalBox(),
                    saveRequested);
        }

        private Label labeled(String text, Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }

        private TextField transitionDestinationField(String text, String accessibleText) {
            TextField field = new TextField(text == null ? "" : text);
            field.getStyleClass().add(COORDINATE_FIELD_STYLE);
            field.setAccessibleText(accessibleText);
            field.setTextFormatter(new TextFormatter<>(transitionDestinationIntegerTextFilter(accessibleText)));
            return field;
        }

        private record TransitionDestinationControls(
                ComboBox<String> destinationTypeBox,
                TextField mapIdField,
                TextField tileIdField,
                TextField transitionIdField,
                CheckBox bidirectionalBox,
                Label sourceLabel,
                Label targetHintLabel,
                Label destinationTypeLabel,
                Label mapIdLabel,
                Label tileIdLabel,
                Label transitionIdLabel,
                Label status,
                Button save
        ) {
        }
    }

    private final class StairGeometryCard extends VBox {

        private StairGeometryCard(
                DungeonEditorStatePanelModel.StairGeometryProjection stairGeometry,
                boolean busy,
                String statusText
        ) {
            ComboBox<String> shapeBox = comboBox(List.of("STRAIGHT", "SQUARE", "CIRCULAR"), stairGeometry.shapeName());
            ComboBox<String> directionBox = comboBox(List.of("NORTH", "EAST", "SOUTH", "WEST"), stairGeometry.directionName());
            TextField dimension1Field = stairGeometryField(stairGeometry.dimension1(), STAIR_DIMENSION_1_ACCESSIBLE);
            TextField dimension2Field = stairGeometryField(stairGeometry.dimension2(), STAIR_DIMENSION_2_ACCESSIBLE);
            shapeBox.setAccessibleText(STAIR_SHAPE_ACCESSIBLE);
            directionBox.setAccessibleText(STAIR_DIRECTION_ACCESSIBLE);
            HBox specRow = new HBox(
                    labeled("Form", shapeBox),
                    shapeBox,
                    labeled("Richtung", directionBox),
                    directionBox);
            specRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            HBox dimensionRow = new HBox(
                    labeled("d1", dimension1Field),
                    dimension1Field,
                    labeled("d2", dimension2Field),
                    dimension2Field);
            dimensionRow.getStyleClass().add(COORDINATE_ROW_STYLE);
            Label status = stableStatusLabel(statusText);
            Button save = new ToolbarActionButton("Treppe aktualisieren");
            save.setAccessibleText(stairGeometry.label() + " Geometrie" + SAVE_ACTION_SUFFIX);
            Runnable updateDisabled = () -> save.setDisable(
                    busy
                            || !completeIntegerText(dimension1Field.getText())
                            || !completeIntegerText(dimension2Field.getText()));
            shapeBox.valueProperty().addListener((ignored, before, after) -> {
                rememberStairGeometryFocus(shapeBox.getAccessibleText(), 0);
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field,
                        dimension2Field, false);
            });
            directionBox.valueProperty().addListener((ignored, before, after) -> {
                rememberStairGeometryFocus(directionBox.getAccessibleText(), 0);
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field,
                        dimension2Field, false);
            });
            dimension1Field.textProperty().addListener((ignored, before, after) -> {
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field, dimension2Field, false);
                updateDisabled.run();
            });
            dimension2Field.textProperty().addListener((ignored, before, after) -> {
                emitStairGeometryInput(stairGeometry.stairId(), shapeBox, directionBox, dimension1Field, dimension2Field, false);
                updateDisabled.run();
            });
            updateDisabled.run();
            save.setOnAction(event -> emitStairGeometryInput(
                    stairGeometry.stairId(),
                    shapeBox,
                    directionBox,
                    dimension1Field,
                    dimension2Field,
                    true));
            getChildren().addAll(new PanelTitle(stairGeometry.label()), specRow, dimensionRow, status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label labeled(String text, Node field) {
            Label label = muted(text);
            label.setLabelFor(field);
            return label;
        }

        private TextField stairGeometryField(String text, String accessibleText) {
            TextField field = new TextField(text == null ? "" : text);
            field.getStyleClass().add(COORDINATE_FIELD_STYLE);
            field.setAccessibleText(accessibleText);
            field.setTextFormatter(new TextFormatter<>(stairGeometryIntegerTextFilter(accessibleText)));
            return field;
        }
    }

    private final class NarrationCard extends VBox {

        private NarrationCard(
                DungeonEditorStatePanelModel.RoomNarrationCardProjection card,
                boolean busy,
                String statusText
        ) {
            TextArea visualArea = textArea(card.visualDescription());
            visualArea.setAccessibleText(narrationVisualAccessibleText(card.roomId()));
            visualArea.setTextFormatter(new TextFormatter<>(narrationTextFilter(visualArea.getAccessibleText())));
            List<TextArea> exitAreas = new ArrayList<>();
            getChildren().addAll(new PanelTitle(card.roomName()), narrationLabel("Visueller Eindruck", visualArea), visualArea);
            for (DungeonEditorStatePanelModel.RoomExitNarrationProjection exit : card.exits()) {
                TextArea exitArea = textArea(exit.description());
                exitArea.setAccessibleText(narrationExitAccessibleText(card.roomId(), exit));
                exitArea.setTextFormatter(new TextFormatter<>(narrationTextFilter(exitArea.getAccessibleText())));
                exitAreas.add(exitArea);
                getChildren().addAll(narrationLabel(exit.label(), exitArea), exitArea);
            }
            visualArea.textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                    card.roomId(),
                    visualArea,
                    exitAreas,
                    false));
            for (TextArea exitArea : exitAreas) {
                exitArea.textProperty().addListener((ignored, before, after) -> emitNarrationInput(
                        card.roomId(),
                        visualArea,
                        exitAreas,
                        false));
            }
            Label status = stableStatusLabel(statusText);
            Button save = new ToolbarActionButton("Speichern");
            save.setAccessibleText("Narration fuer " + card.roomName() + SAVE_ACTION_SUFFIX);
            save.setDisable(busy);
            save.setOnAction(event -> emitNarrationInput(card.roomId(), visualArea, exitAreas, true));
            getChildren().addAll(status, save);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }

        private Label narrationLabel(String text, TextArea area) {
            Label label = muted(text);
            label.setLabelFor(area);
            return label;
        }
    }

    private static String narrationVisualAccessibleText(long roomId) {
        return "Raum " + Math.max(0L, roomId) + " visueller Eindruck";
    }

    private static String narrationExitAccessibleText(
            long roomId,
            DungeonEditorStatePanelModel.RoomExitNarrationProjection exit
    ) {
        String label = exit == null ? "" : exit.label();
        int q = exit == null ? 0 : exit.q();
        int r = exit == null ? 0 : exit.r();
        int level = exit == null ? 0 : exit.level();
        String direction = exit == null ? "" : exit.direction();
        return "Raum " + Math.max(0L, roomId)
                + " Ausgang " + label
                + " q=" + q
                + " r=" + r
                + " z=" + level
                + " " + direction;
    }

    private static final class StateCard extends VBox {

        private StateCard(Label body) {
            getChildren().addAll(new PanelTitle("Editor state"), body);
            body.setWrapText(true);
            getStyleClass().addAll(CARD_SURFACE_STYLE, CONTENT_CARD_STYLE);
        }
    }

    private static final class PanelTitle extends Label {

        private PanelTitle(String text) {
            super(text);
            getStyleClass().add("panel-title");
        }
    }

    private static final class MutedLabel extends Label {

        private MutedLabel(String text) {
            super(text == null ? "" : text);
            getStyleClass().add("text-muted");
        }
    }

    private static final class ToolbarActionButton extends Button {

        private ToolbarActionButton(String text) {
            super(text);
            getStyleClass().add("toolbar-action-button");
        }
    }
}
