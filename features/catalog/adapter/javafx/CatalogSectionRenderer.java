package features.catalog.adapter.javafx;

import features.catalog.application.CatalogActionSpec;
import features.catalog.application.CatalogChoice;
import features.catalog.application.CatalogColumnSpec;
import features.catalog.application.CatalogConfirmation;
import features.catalog.application.CatalogFilterSpec;
import features.catalog.application.CatalogPresentationSpec;
import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionDefinition;
import features.catalog.application.CatalogSectionCommands;
import features.catalog.application.CatalogSectionId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckMenuItem;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/** The only Catalog section control, result, action, status, selection, and paging renderer. */
final class CatalogSectionRenderer {

    private final CatalogControlFactory controls = new CatalogControlFactory();
    private final VBox controlRoot = new VBox();
    private final VBox activeControls = new VBox();
    private final BorderPane contentRoot = new BorderPane();
    private final Map<CatalogSectionId, ToggleButton> sectionButtons = new EnumMap<>(CatalogSectionId.class);
    private ActiveSection<?, ?, ?> active;
    private boolean applyingSection;

    CatalogSectionRenderer(Consumer<CatalogSectionId> sectionSelection) {
        Consumer<CatalogSectionId> select = Objects.requireNonNull(sectionSelection, "sectionSelection");
        controlRoot.getStyleClass().addAll("catalog-controls-host", "catalog-renderer-controls");
        activeControls.getStyleClass().add("catalog-active-controls");
        contentRoot.getStyleClass().addAll("catalog-content-host", "catalog-renderer-content");
        ToggleGroup group = new ToggleGroup();
        FlowPane rail = new FlowPane();
        rail.getStyleClass().add("catalog-section-rail");
        for (CatalogSectionId section : CatalogSectionId.values()) {
            ToggleButton button = controls.section(section.label(), "Katalogbereich " + section.label());
            button.setUserData(section);
            button.setToggleGroup(group);
            sectionButtons.put(section, button);
            rail.getChildren().add(button);
        }
        group.selectedToggleProperty().addListener((ignored, before, after) -> {
            if (applyingSection) {
                return;
            }
            if (after == null) {
                if (before != null) {
                    before.setSelected(true);
                }
                return;
            }
            select.accept((CatalogSectionId) after.getUserData());
        });
        javafx.scene.control.ScrollPane scroll = new javafx.scene.control.ScrollPane(activeControls);
        scroll.getStyleClass().add("catalog-section-controls-scroll");
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(javafx.scene.control.ScrollPane.ScrollBarPolicy.NEVER);
        controlRoot.getChildren().setAll(rail, scroll);
        VBox.setVgrow(scroll, Priority.ALWAYS);
    }

    Node controls() {
        return controlRoot;
    }

    Node content() {
        return contentRoot;
    }

    void selectSection(CatalogSectionId id) {
        ToggleButton button = sectionButtons.get(Objects.requireNonNull(id, "id"));
        if (button != null && !button.isSelected()) {
            applyingSection = true;
            try {
                button.setSelected(true);
            } finally {
                applyingSection = false;
            }
        }
    }

    <Q, R, K> void render(
            CatalogSectionDefinition<Q, R, K> definition,
            CatalogRenderState<Q, R, K> state,
            CatalogSectionCommands<Q, K> commands
    ) {
        CatalogPresentationSpec<Q, R, K> spec = Objects.requireNonNull(
                definition, "definition").presentation();
        Objects.requireNonNull(spec, "spec");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(commands, "commands");
        if (active == null || active.definition != definition) {
            ActiveSection<Q, R, K> next = new ActiveSection<>(definition, spec, commands);
            active = next;
            activeControls.getChildren().setAll(next.controlPane);
            contentRoot.setCenter(next.contentPane);
            next.render(state, commands);
            return;
        }
        @SuppressWarnings("unchecked")
        ActiveSection<Q, R, K> current = (ActiveSection<Q, R, K>) active;
        current.render(state, commands);
    }

    private final class ActiveSection<Q, R, K> {
        private final CatalogPresentationSpec<Q, R, K> spec;
        private final CatalogSectionDefinition<Q, R, K> definition;
        private CatalogSectionCommands<Q, K> commands;
        private final VBox controlPane = new VBox();
        private final FlowPane filterPane = new FlowPane();
        private final FlowPane chips = new FlowPane();
        private final FlowPane sectionActions = new FlowPane();
        private final Label actionMessage = new Label();
        private final Label confirmationMessage = new Label();
        private final HBox confirmationActions = new HBox();
        private final BorderPane contentPane = new BorderPane();
        private final Label count = new Label();
        private final Label status = new Label();
        private final Label page = new Label();
        private final Button previous = controls.action("Zurück", "Vorherige Seite", false);
        private final Button next = controls.action("Weiter", "Nächste Seite", false);
        private final Button selectedAction;
        private final TableView<R> table = new TableView<>();
        private final List<FilterBinding<Q>> filterBindings = new ArrayList<>();
        private Q draft;
        private CatalogRenderState<Q, R, K> state;
        private boolean rendering;
        private long renderedRevision = -1L;

        private ActiveSection(
                CatalogSectionDefinition<Q, R, K> definition,
                CatalogPresentationSpec<Q, R, K> spec,
                CatalogSectionCommands<Q, K> commands
        ) {
            this.definition = definition;
            this.spec = spec;
            this.commands = commands;
            filterPane.getStyleClass().add("catalog-filter-row");
            chips.getStyleClass().add("catalog-chip-row");
            sectionActions.getStyleClass().add("catalog-section-actions");
            confirmationActions.getStyleClass().add("catalog-confirmation-actions");
            for (CatalogFilterSpec<Q> filter : spec.filters()) {
                FilterBinding<Q> binding = createFilter(filter);
                filterBindings.add(binding);
                filterPane.getChildren().add(binding.node());
            }
            for (CatalogActionSpec action : spec.sectionActions()) {
                Button button = actionButton(action);
                button.setOnAction(ignored -> this.commands.sectionAction().accept(action.id()));
                sectionActions.getChildren().add(button);
            }
            actionMessage.setWrapText(true);
            actionMessage.setAccessibleText(spec.accessibleTableName() + " Aktionsstatus");
            actionMessage.getStyleClass().add("text-secondary");
            confirmationMessage.setWrapText(true);
            confirmationMessage.setAccessibleText("Ungespeicherte Änderungen bestätigen");
            Button confirm = controls.action(
                    "Verwerfen und öffnen", "Verwerfen und öffnen", true);
            confirm.setOnAction(ignored -> this.commands.confirm().accept(state.confirmation()));
            Button cancel = controls.action("Abbrechen", "Öffnen abbrechen", false);
            cancel.setOnAction(ignored -> this.commands.cancel().accept(state.confirmation()));
            confirmationActions.getChildren().setAll(confirm, cancel);
            controlPane.getStyleClass().add("catalog-section-surface");
            controlPane.getChildren().setAll(filterPane, chips, sectionActions, actionMessage,
                    confirmationMessage, confirmationActions);

            table.setAccessibleText(spec.accessibleTableName());
            count.setAccessibleText(spec.accessibleTableName() + " Anzahl");
            status.setAccessibleText(spec.accessibleTableName() + " Status");
            table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
            table.getColumns().setAll(createColumns());
            table.getSelectionModel().selectedItemProperty().addListener((ignored, before, selected) -> {
                if (!rendering) {
                    this.commands.select().accept(Optional.ofNullable(selected).map(definition::key));
                }
            });
            spec.primaryAction().ifPresent(ignored -> {
                table.setOnMouseClicked(event -> {
                    if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                        invokePrimary(table.getSelectionModel().getSelectedItem());
                    }
                });
                table.setOnKeyPressed(event -> {
                    if (event.getCode() == KeyCode.ENTER) {
                        invokePrimary(table.getSelectionModel().getSelectedItem());
                        event.consume();
                    }
                });
            });
            selectedAction = spec.primaryAction().map(action -> {
                Button button = actionButton(action);
                button.setAccessibleText(action.tooltip());
                button.setOnAction(ignored -> state.selectedKey().ifPresent(
                        key -> this.commands.rowAction().accept(action.id(), key)));
                return button;
            }).orElse(null);
            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            List<Node> headerNodes = new ArrayList<>(List.of(count, spacer, status));
            if (selectedAction != null) {
                headerNodes.add(selectedAction);
            }
            HBox header = new HBox(headerNodes.toArray(Node[]::new));
            header.getStyleClass().add("catalog-main-topbar");
            contentPane.setTop(header);
            contentPane.setCenter(table);
            if (spec.paging()) {
                String pageName = accessibilityNoun() + "-Seite";
                previous.setAccessibleText("Vorherige " + pageName);
                next.setAccessibleText("Nächste " + pageName);
                page.setAccessibleText(pageName);
                previous.setOnAction(ignored -> this.commands.shiftPage().accept(-1));
                next.setOnAction(ignored -> this.commands.shiftPage().accept(1));
                HBox footer = new HBox(previous, page, next);
                footer.getStyleClass().add("catalog-main-pagination");
                contentPane.setBottom(footer);
            }
        }

        private void render(
                CatalogRenderState<Q, R, K> nextState,
                CatalogSectionCommands<Q, K> nextCommands
        ) {
            state = nextState;
            commands = Objects.requireNonNull(nextCommands, "nextCommands");
            if (nextState.revision() == renderedRevision) {
                return;
            }
            renderedRevision = nextState.revision();
            draft = nextState.draft();
            rendering = true;
            try {
                filterBindings.forEach(binding -> binding.render(draft));
                renderChips();
                table.getItems().setAll(nextState.result().rows());
                table.getSelectionModel().clearSelection();
                nextState.selectedKey().flatMap(key -> table.getItems().stream()
                        .filter(row -> key.equals(definition.key(row))).findFirst())
                        .ifPresent(table.getSelectionModel()::select);
            } finally {
                rendering = false;
            }
            count.setText(nextState.totalCount() + " " + spec.resultLabel() + " gefunden");
            status.setText(statusText(nextState.result()));
            table.setPlaceholder(new Label(placeholderText(nextState.result())));
            actionMessage.setText(nextState.actionMessage());
            renderConfirmation(nextState.confirmation());
            if (selectedAction != null) {
                selectedAction.setDisable(nextState.selectedKey().isEmpty());
            }
            if (spec.paging()) {
                int pageCount = nextState.totalCount() == 0 ? 1
                        : (int) Math.ceil((double) nextState.totalCount() / nextState.pageSize());
                int currentPage = nextState.totalCount() == 0 ? 1
                        : (nextState.pageOffset() / nextState.pageSize()) + 1;
                page.setText("Seite " + currentPage + " von " + pageCount);
                boolean busy = nextState.result().status() == CatalogResultState.Status.LOADING;
                previous.setDisable(nextState.pageOffset() <= 0 || busy);
                next.setDisable(nextState.pageOffset() + nextState.pageSize() >= nextState.totalCount() || busy);
            }
            hideEmptyControls();
        }

        private void renderChips() {
            chips.getChildren().clear();
            for (CatalogFilterSpec<Q> filter : spec.filters()) {
                String summary = Objects.requireNonNullElse(filter.activeSummary().apply(draft), "");
                if (!summary.isBlank()) {
                    Button chip = controls.chip(summary);
                    chip.setAccessibleText(summary + " entfernen");
                    chip.setOnAction(ignored -> commands.editDraft().accept(filter.clear().apply(draft)));
                    chips.getChildren().add(chip);
                }
            }
        }

        private void renderConfirmation(CatalogConfirmation<K> confirmation) {
            boolean visible = confirmation.required();
            confirmationMessage.setText(visible
                    ? confirmation.label() + " öffnen und ungespeicherte Änderungen verwerfen?" : "");
            confirmationMessage.setManaged(visible);
            confirmationMessage.setVisible(visible);
            confirmationActions.setManaged(visible);
            confirmationActions.setVisible(visible);
        }

        private void hideEmptyControls() {
            setManaged(filterPane, !filterPane.getChildren().isEmpty());
            setManaged(chips, !chips.getChildren().isEmpty());
            setManaged(sectionActions, !sectionActions.getChildren().isEmpty());
            setManaged(actionMessage, !actionMessage.getText().isBlank());
        }

        private List<TableColumn<R, ?>> createColumns() {
            List<TableColumn<R, ?>> columns = new ArrayList<>();
            for (int index = 0; index < spec.columns().size(); index++) {
                CatalogColumnSpec<R> column = spec.columns().get(index);
                columns.add(index == 0 && spec.primaryAction().isPresent()
                        ? primaryColumn(column, spec.primaryAction().orElseThrow()) : textColumn(column));
            }
            if (!spec.rowActions().isEmpty()) {
                columns.add(actionColumn());
            }
            return List.copyOf(columns);
        }

        private TableColumn<R, String> textColumn(CatalogColumnSpec<R> specColumn) {
            TableColumn<R, String> column = new TableColumn<>(specColumn.label());
            column.setCellValueFactory(data -> new SimpleStringProperty(
                    specColumn.value().apply(data.getValue())));
            return column;
        }

        private TableColumn<R, R> primaryColumn(
                CatalogColumnSpec<R> specColumn,
                CatalogActionSpec action
        ) {
            TableColumn<R, R> column = new TableColumn<>(specColumn.label());
            column.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            column.setCellFactory(ignored -> new TableCell<>() {
                private final Button open = actionButton(action);
                {
                    open.getStyleClass().addAll("creature-link", "flat");
                    open.setOnAction(event -> invokePrimary(getItem()));
                }
                @Override protected void updateItem(R row, boolean empty) {
                    super.updateItem(row, empty);
                    R shown = empty ? null : row;
                    open.setText(shown == null ? "" : specColumn.value().apply(shown));
                    open.setAccessibleText(shown == null ? ""
                            : action.accessiblePrefix() + ": " + spec.accessibleRowLabel().apply(shown));
                    setGraphic(shown == null ? null : open);
                }
            });
            return column;
        }

        private TableColumn<R, R> actionColumn() {
            TableColumn<R, R> column = new TableColumn<>("");
            column.setSortable(false);
            column.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            column.setCellFactory(ignored -> new TableCell<>() {
                private final HBox buttons = new HBox();
                private final List<Button> actionButtons = new ArrayList<>();
                {
                    buttons.getStyleClass().add("catalog-row-actions");
                    for (CatalogActionSpec action : spec.rowActions()) {
                        Button button = actionButton(action);
                        button.setOnAction(event -> invoke(action, getItem()));
                        actionButtons.add(button);
                        buttons.getChildren().add(button);
                    }
                }
                @Override protected void updateItem(R row, boolean empty) {
                    super.updateItem(row, empty);
                    R shown = empty ? null : row;
                    for (int index = 0; index < actionButtons.size(); index++) {
                        Button button = actionButtons.get(index);
                        CatalogActionSpec action = spec.rowActions().get(index);
                        button.setAccessibleText(shown == null ? ""
                                : action.accessiblePrefix() + ": " + spec.accessibleRowLabel().apply(shown));
                    }
                    setGraphic(shown == null ? null : buttons);
                }
            });
            return column;
        }

        private void invokePrimary(R row) {
            spec.primaryAction().ifPresent(action -> invoke(action, row));
        }

        private void invoke(CatalogActionSpec action, R row) {
            if (row != null) {
                commands.rowAction().accept(action.id(), definition.key(row));
            }
        }

        private FilterBinding<Q> createFilter(CatalogFilterSpec<Q> filter) {
            return switch (filter) {
                case CatalogFilterSpec.Text<Q> text -> textBinding(text);
                case CatalogFilterSpec.Choice<Q, ?> choice -> choiceBinding(choice);
                case CatalogFilterSpec.MultiChoice<Q, ?> multi -> multiBinding(multi);
                case CatalogFilterSpec.ChoiceRange<Q, ?> range -> choiceRangeBinding(range);
                case CatalogFilterSpec.TextRange<Q> range -> textRangeBinding(range);
                case CatalogFilterSpec.TriState<Q> triState -> triStateBinding(triState);
            };
        }

        private FilterBinding<Q> textBinding(CatalogFilterSpec.Text<Q> specFilter) {
            var field = controls.text(specFilter.prompt(), specFilter.accessibleText());
            field.textProperty().addListener((ignored, before, after) -> {
                if (!rendering) {
                    commands.editDraft().accept(specFilter.update().apply(draft, after));
                }
            });
            field.setOnAction(ignored -> commands.submit().run());
            return binding(field, query -> setText(field, specFilter.value().apply(query)));
        }

        private <V> FilterBinding<Q> choiceBinding(CatalogFilterSpec.Choice<Q, V> specFilter) {
            ComboBox<CatalogChoice<V>> box = controls.choice(specFilter.prompt(), specFilter.accessibleText());
            box.setConverter(choiceConverter());
            box.valueProperty().addListener((ignored, before, after) -> {
                if (!rendering && after != null) {
                    commands.editDraft().accept(specFilter.update().apply(draft, after.value()));
                }
            });
            return binding(box, query -> {
                List<CatalogChoice<V>> choices = specFilter.choices().apply(query);
                if (!box.getItems().equals(choices)) {
                    box.getItems().setAll(choices);
                }
                V value = specFilter.value().apply(query);
                box.setValue(choices.stream().filter(choice -> choice.value().equals(value))
                        .findFirst().orElse(null));
            });
        }

        private <V> FilterBinding<Q> multiBinding(CatalogFilterSpec.MultiChoice<Q, V> specFilter) {
            MenuButton button = controls.multiChoice(specFilter.prompt(), specFilter.accessibleText());
            return binding(button, query -> {
                List<V> selected = specFilter.values().apply(query);
                List<CatalogChoice<V>> choices = specFilter.choices().apply(query);
                button.getItems().clear();
                for (CatalogChoice<V> choice : choices) {
                    CheckMenuItem item = controls.multiChoiceItem(
                            choice.label(), selected.contains(choice.value()));
                    item.setOnAction(ignored -> {
                        List<V> values = new ArrayList<>();
                        for (int index = 0; index < button.getItems().size(); index++) {
                            CheckMenuItem candidate = (CheckMenuItem) button.getItems().get(index);
                            if (candidate.isSelected()) {
                                values.add(choices.get(index).value());
                            }
                        }
                        commands.editDraft().accept(specFilter.update().apply(draft, List.copyOf(values)));
                    });
                    button.getItems().add(item);
                }
                button.setText(selected.isEmpty()
                        ? specFilter.prompt() : specFilter.prompt() + " (" + selected.size() + ")");
            });
        }

        private <V> FilterBinding<Q> choiceRangeBinding(CatalogFilterSpec.ChoiceRange<Q, V> specFilter) {
            ComboBox<CatalogChoice<V>> minimum = controls.choice(
                    specFilter.prompt() + " ab", specFilter.accessibleText() + " Minimum");
            ComboBox<CatalogChoice<V>> maximum = controls.choice(
                    specFilter.prompt() + " bis", specFilter.accessibleText() + " Maximum");
            minimum.setConverter(choiceConverter());
            maximum.setConverter(choiceConverter());
            Runnable update = () -> {
                if (!rendering && minimum.getValue() != null && maximum.getValue() != null) {
                    commands.editDraft().accept(specFilter.update().apply(
                            draft, minimum.getValue().value(), maximum.getValue().value()));
                }
            };
            minimum.valueProperty().addListener((ignored, before, after) -> update.run());
            maximum.valueProperty().addListener((ignored, before, after) -> update.run());
            HBox row = new HBox(minimum, maximum);
            row.getStyleClass().add("catalog-range-control");
            return binding(row, query -> {
                List<CatalogChoice<V>> choices = specFilter.choices().apply(query);
                minimum.getItems().setAll(choices);
                maximum.getItems().setAll(choices);
                selectChoice(minimum, choices, specFilter.minimum().apply(query));
                selectChoice(maximum, choices, specFilter.maximum().apply(query));
            });
        }

        private FilterBinding<Q> textRangeBinding(CatalogFilterSpec.TextRange<Q> specFilter) {
            var minimum = controls.text(specFilter.prompt() + " ab", specFilter.accessibleText() + " Minimum");
            var maximum = controls.text(specFilter.prompt() + " bis", specFilter.accessibleText() + " Maximum");
            Runnable update = () -> {
                if (!rendering) {
                    commands.editDraft().accept(specFilter.update().apply(
                            draft, minimum.getText(), maximum.getText()));
                }
            };
            minimum.textProperty().addListener((ignored, before, after) -> update.run());
            maximum.textProperty().addListener((ignored, before, after) -> update.run());
            minimum.setOnAction(ignored -> commands.submit().run());
            maximum.setOnAction(ignored -> commands.submit().run());
            HBox row = new HBox(minimum, maximum);
            row.getStyleClass().add("catalog-range-control");
            return binding(row, query -> {
                setText(minimum, specFilter.minimum().apply(query));
                setText(maximum, specFilter.maximum().apply(query));
            });
        }

        private FilterBinding<Q> triStateBinding(CatalogFilterSpec.TriState<Q> specFilter) {
            ComboBox<TriStateChoice> box = controls.choice(specFilter.prompt(), specFilter.accessibleText());
            box.getItems().setAll(TriStateChoice.values());
            box.valueProperty().addListener((ignored, before, after) -> {
                if (!rendering && after != null) {
                    commands.editDraft().accept(specFilter.update().apply(draft, after.value));
                }
            });
            return binding(box, query -> box.setValue(TriStateChoice.from(specFilter.value().apply(query))));
        }

        private Button actionButton(CatalogActionSpec action) {
            Button button = controls.action(
                    action.label(), action.accessiblePrefix(),
                    action.emphasis() == CatalogActionSpec.Emphasis.PRIMARY);
            if (!action.tooltip().isBlank()) {
                button.setTooltip(new Tooltip(action.tooltip()));
            }
            return button;
        }

        private String accessibilityNoun() {
            String name = spec.accessibleTableName();
            int separator = name.indexOf('-');
            return separator > 0 ? name.substring(0, separator) : spec.resultLabel();
        }
    }

    private static <Q> FilterBinding<Q> binding(Node node, java.util.function.Consumer<Q> renderer) {
        return new FilterBinding<>() {
            @Override public Node node() { return node; }
            @Override public void render(Q query) { renderer.accept(query); }
        };
    }

    private static <V> StringConverter<CatalogChoice<V>> choiceConverter() {
        return new StringConverter<>() {
            @Override public String toString(CatalogChoice<V> value) {
                return value == null ? "" : value.label();
            }
            @Override public CatalogChoice<V> fromString(String value) {
                throw new UnsupportedOperationException("Catalog choices are selected, not parsed.");
            }
        };
    }

    private static <V> void selectChoice(
            ComboBox<CatalogChoice<V>> box,
            List<CatalogChoice<V>> choices,
            V value
    ) {
        box.setValue(choices.stream().filter(choice -> choice.value().equals(value)).findFirst().orElse(null));
    }

    private static void setText(javafx.scene.control.TextField field, String value) {
        String safe = Objects.requireNonNullElse(value, "");
        if (!safe.equals(field.getText())) {
            field.setText(safe);
        }
    }

    private static void setManaged(Node node, boolean visible) {
        node.setManaged(visible);
        node.setVisible(visible);
    }

    private static String statusText(CatalogResultState<?> result) {
        return switch (result.status()) {
            case UNINITIALIZED -> "";
            case LOADING -> "Lade...";
            case REFRESHING -> "Aktualisiere...";
            case READY -> "";
            case EMPTY -> "Keine Einträge gefunden.";
            case INVALID_INPUT -> result.message().isBlank() ? "Eingabe ist ungültig." : result.message();
            case UNAVAILABLE -> result.message().isBlank() ? "Quelle ist nicht verfügbar." : result.message();
            case FAILED -> result.message().isBlank() ? "Fehler beim Laden." : result.message();
        };
    }

    private static String placeholderText(CatalogResultState<?> result) {
        String status = statusText(result);
        return status.isBlank() ? "Keine Einträge gefunden." : status;
    }

    private interface FilterBinding<Q> {
        Node node();
        void render(Q query);
    }

    private enum TriStateChoice {
        ALL("Alle", null), YES("Ja", true), NO("Nein", false);

        private final String label;
        private final Boolean value;

        TriStateChoice(String label, Boolean value) {
            this.label = label;
            this.value = value;
        }

        private static TriStateChoice from(Boolean value) {
            return value == null ? ALL : value ? YES : NO;
        }

        @Override public String toString() {
            return label;
        }
    }
}
