package features.catalog.adapter.javafx;

import features.catalog.application.CatalogActionSpec;
import features.catalog.application.CatalogChoice;
import features.catalog.application.CatalogColumnSpec;
import features.catalog.application.CatalogConfirmation;
import features.catalog.application.CatalogFilterSpec;
import features.catalog.application.CatalogFilterToken;
import features.catalog.application.CatalogPresentationSpec;
import features.catalog.application.CatalogResultState;
import features.catalog.application.CatalogSectionCommands;
import features.catalog.application.CatalogSectionDefinition;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogSortOrder;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
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

/** The only Catalog workspace, filter, result, action, status, selection, sort and paging renderer. */
final class CatalogSectionRenderer {

    private final CatalogControlFactory controls = new CatalogControlFactory();
    private final BorderPane workspaceRoot = new BorderPane();
    private final VBox workspaceTop = new VBox();
    private final VBox activeControls = new VBox();
    private final Map<CatalogSectionId, ToggleButton> sectionButtons = new EnumMap<>(CatalogSectionId.class);
    private ActiveSection<?, ?, ?> active;
    private boolean applyingSection;

    CatalogSectionRenderer(Consumer<CatalogSectionId> sectionSelection) {
        Consumer<CatalogSectionId> select = Objects.requireNonNull(sectionSelection, "sectionSelection");
        workspaceRoot.getStyleClass().addAll("catalog-workspace", "catalog-renderer-content");
        workspaceTop.getStyleClass().add("catalog-workspace-top");
        activeControls.getStyleClass().add("catalog-active-controls");
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
        workspaceTop.getChildren().setAll(rail, activeControls);
        workspaceRoot.setTop(workspaceTop);
    }

    Node content() {
        return workspaceRoot;
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
        CatalogSectionDefinition<Q, R, K> requiredDefinition =
                Objects.requireNonNull(definition, "definition");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(commands, "commands");
        if (active == null || active.definition != requiredDefinition) {
            CatalogPresentationSpec<Q, R, K> spec =
                    Objects.requireNonNull(requiredDefinition.presentation(), "spec");
            ActiveSection<Q, R, K> next = new ActiveSection<>(requiredDefinition, spec, commands);
            active = next;
            activeControls.getChildren().setAll(next.controlPane);
            workspaceRoot.setCenter(next.table);
            workspaceRoot.setBottom(next.footer);
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
        private final HBox toolbar = new HBox();
        private final FlowPane filterPane = new FlowPane();
        private final FlowPane chips = new FlowPane();
        private final Label confirmationMessage = new Label();
        private final HBox confirmationActions = new HBox();
        private final HBox footer = new HBox();
        private final HBox pagination = new HBox();
        private final Label count = new Label();
        private final Label status = new Label();
        private final Label actionMessage = new Label();
        private final Label page = new Label();
        private final Button previous = controls.action("‹", "Vorherige Seite", false);
        private final Button next = controls.action("›", "Nächste Seite", false);
        private final Button reset = controls.action("Filter zurücksetzen", "Alle Filter zurücksetzen", false);
        private final TableView<R> table = new TableView<>();
        private final List<FilterBinding<Q>> filterBindings = new ArrayList<>();
        private final Map<String, TableColumn<R, ?>> columnsById = new LinkedHashMap<>();
        private Q draft;
        private CatalogRenderState<Q, R, K> state;
        private Q renderedDraft;
        private List<R> renderedRows;
        private Optional<K> renderedSelection;
        private CatalogSortOrder renderedSortOrder;
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
            toolbar.getStyleClass().add("catalog-toolbar");
            filterPane.getStyleClass().add("catalog-filter-row");
            chips.getStyleClass().add("catalog-chip-row");
            confirmationActions.getStyleClass().add("catalog-confirmation-actions");
            footer.getStyleClass().add("catalog-results-footer");
            pagination.getStyleClass().add("catalog-main-pagination");

            List<Node> searchNodes = new ArrayList<>();
            for (CatalogFilterSpec<Q> filter : spec.filters()) {
                FilterBinding<Q> binding = createFilter(filter);
                filterBindings.add(binding);
                if (filter instanceof CatalogFilterSpec.Text<?> && searchNodes.isEmpty()) {
                    searchNodes.add(binding.node());
                } else {
                    filterPane.getChildren().add(binding.node());
                }
            }
            toolbar.getChildren().addAll(searchNodes);
            Region toolbarSpacer = new Region();
            HBox.setHgrow(toolbarSpacer, Priority.ALWAYS);
            toolbar.getChildren().add(toolbarSpacer);
            reset.setOnAction(ignored -> resetFilters());
            toolbar.getChildren().add(reset);
            for (CatalogActionSpec action : spec.sectionActions()) {
                Button button = actionButton(action);
                button.setOnAction(ignored -> this.commands.sectionAction().accept(action.id()));
                toolbar.getChildren().add(button);
            }

            confirmationMessage.setWrapText(true);
            confirmationMessage.setAccessibleText("Ungespeicherte Änderungen bestätigen");
            Button confirm = controls.action("Verwerfen und öffnen", "Verwerfen und öffnen", true);
            confirm.setOnAction(ignored -> this.commands.confirm().accept(state.confirmation()));
            Button cancel = controls.action("Abbrechen", "Öffnen abbrechen", false);
            cancel.setOnAction(ignored -> this.commands.cancel().accept(state.confirmation()));
            confirmationActions.getChildren().setAll(confirm, cancel);
            controlPane.getStyleClass().add("catalog-section-surface");
            controlPane.getChildren().setAll(toolbar, filterPane, chips, confirmationMessage, confirmationActions);

            table.setAccessibleText(spec.accessibleTableName());
            table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
            table.getStyleClass().add("catalog-results-table");
            table.getColumns().setAll(createColumns());
            table.setSortPolicy(ignored -> {
                if (!rendering && !table.getSortOrder().isEmpty()) {
                    TableColumn<R, ?> sorted = table.getSortOrder().getFirst();
                    String columnId = Objects.toString(sorted.getUserData(), "");
                    CatalogSortOrder.Direction direction = sorted.getSortType() == TableColumn.SortType.DESCENDING
                            ? CatalogSortOrder.Direction.DESCENDING : CatalogSortOrder.Direction.ASCENDING;
                    this.commands.sort().accept(new CatalogSortOrder(columnId, direction));
                }
                return true;
            });
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

            count.setAccessibleText(spec.accessibleTableName() + " Anzahl");
            status.setAccessibleText(spec.accessibleTableName() + " Status");
            actionMessage.setAccessibleText(spec.accessibleTableName() + " Aktionsstatus");
            status.getStyleClass().add("catalog-footer-status");
            actionMessage.getStyleClass().add("catalog-footer-feedback");
            Region footerSpacer = new Region();
            HBox.setHgrow(footerSpacer, Priority.ALWAYS);
            footer.getChildren().setAll(count, status, actionMessage, footerSpacer, pagination);

            if (spec.paging()) {
                String pageName = accessibilityNoun() + "-Seite";
                previous.setAccessibleText("Vorherige " + pageName);
                next.setAccessibleText("Nächste " + pageName);
                page.setAccessibleText(pageName);
                previous.setOnAction(ignored -> this.commands.shiftPage().accept(-1));
                next.setOnAction(ignored -> this.commands.shiftPage().accept(1));
                pagination.getChildren().setAll(previous, page, next);
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
            boolean draftChanged = !Objects.equals(renderedDraft, draft);
            boolean rowsChanged = !Objects.equals(renderedRows, nextState.result().rows());
            boolean selectionChanged = rowsChanged
                    || !Objects.equals(renderedSelection, nextState.selectedKey());
            boolean sortChanged = !Objects.equals(renderedSortOrder, nextState.sortOrder());
            rendering = true;
            try {
                if (draftChanged) {
                    filterBindings.forEach(binding -> binding.render(draft));
                    renderChips();
                }
                if (rowsChanged) {
                    table.getItems().setAll(nextState.result().rows());
                }
                if (selectionChanged) {
                    table.getSelectionModel().clearSelection();
                    nextState.selectedKey().flatMap(key -> table.getItems().stream()
                            .filter(row -> key.equals(definition.key(row))).findFirst())
                            .ifPresent(table.getSelectionModel()::select);
                }
                if (sortChanged) {
                    renderSort(nextState.sortOrder());
                }
            } finally {
                rendering = false;
            }
            renderedDraft = draft;
            renderedRows = nextState.result().rows();
            renderedSelection = nextState.selectedKey();
            renderedSortOrder = nextState.sortOrder();
            count.setText(nextState.totalCount() + " " + spec.resultLabel() + " gefunden");
            status.setText(statusText(nextState.result()));
            table.setPlaceholder(new Label(placeholderText(nextState.result())));
            actionMessage.setText(nextState.actionMessage());
            setManaged(status, !status.getText().isBlank());
            setManaged(actionMessage, !actionMessage.getText().isBlank());
            renderConfirmation(nextState.confirmation());
            renderPagination(nextState);
            hideEmptyControls();
        }

        private void renderSort(CatalogSortOrder sortOrder) {
            TableColumn<R, ?> column = columnsById.get(sortOrder.columnId());
            if (column == null) {
                return;
            }
            column.setSortType(sortOrder.direction() == CatalogSortOrder.Direction.DESCENDING
                    ? TableColumn.SortType.DESCENDING : TableColumn.SortType.ASCENDING);
            if (!table.getSortOrder().equals(List.of(column))) {
                table.getSortOrder().setAll(column);
            }
        }

        private void renderPagination(CatalogRenderState<Q, R, K> nextState) {
            if (!spec.paging()) {
                setManaged(pagination, false);
                return;
            }
            int pageCount = nextState.totalCount() == 0 ? 1
                    : (int) Math.ceil((double) nextState.totalCount() / nextState.pageSize());
            int currentPage = nextState.totalCount() == 0 ? 1
                    : (nextState.pageOffset() / nextState.pageSize()) + 1;
            page.setText("Seite " + currentPage + " von " + pageCount);
            boolean busy = nextState.result().status() == CatalogResultState.Status.LOADING;
            previous.setDisable(nextState.pageOffset() <= 0 || busy);
            next.setDisable(nextState.pageOffset() + nextState.pageSize() >= nextState.totalCount() || busy);
            setManaged(pagination, pageCount > 1);
        }

        private void renderChips() {
            chips.getChildren().clear();
            List<CatalogFilterToken<Q>> tokens = activeTokens(draft);
            for (CatalogFilterToken<Q> token : tokens) {
                Button chip = controls.chip(token.label());
                chip.setAccessibleText(token.label() + " entfernen");
                chip.setOnAction(ignored -> commands.commitDraft().accept(token.remove().apply(draft)));
                chips.getChildren().add(chip);
            }
            reset.setDisable(tokens.isEmpty());
        }

        private List<CatalogFilterToken<Q>> activeTokens(Q query) {
            return spec.filters().stream().flatMap(filter -> filter.activeTokens().apply(query).stream()).toList();
        }

        private void resetFilters() {
            Q cleared = draft;
            for (CatalogFilterSpec<Q> filter : spec.filters()) {
                cleared = filter.clear().apply(cleared);
            }
            commands.commitDraft().accept(cleared);
        }

        private void renderConfirmation(CatalogConfirmation<K> confirmation) {
            boolean visible = confirmation.required();
            confirmationMessage.setText(visible
                    ? confirmation.label() + " öffnen und ungespeicherte Änderungen verwerfen?" : "");
            setManaged(confirmationMessage, visible);
            setManaged(confirmationActions, visible);
        }

        private void hideEmptyControls() {
            boolean filtersVisible = filterPane.getChildren().stream().anyMatch(Node::isManaged);
            setManaged(filterPane, filtersVisible);
            setManaged(chips, !chips.getChildren().isEmpty());
            setManaged(reset, !spec.filters().isEmpty());
            boolean toolbarVisible = toolbar.getChildren().stream()
                    .filter(node -> !(node instanceof Region region && region.getStyleClass().isEmpty()))
                    .anyMatch(Node::isManaged);
            setManaged(toolbar, toolbarVisible);
        }

        private List<TableColumn<R, ?>> createColumns() {
            List<TableColumn<R, ?>> columns = new ArrayList<>();
            for (int index = 0; index < spec.columns().size(); index++) {
                CatalogColumnSpec<R> column = spec.columns().get(index);
                TableColumn<R, ?> rendered = index == 0 && spec.primaryAction().isPresent()
                        ? primaryColumn(column, spec.primaryAction().orElseThrow()) : textColumn(column);
                configureColumn(rendered, column);
                columns.add(rendered);
            }
            if (!spec.rowActions().isEmpty()) {
                columns.add(actionColumn());
            }
            return List.copyOf(columns);
        }

        private void configureColumn(TableColumn<R, ?> rendered, CatalogColumnSpec<R> column) {
            rendered.setUserData(column.id());
            rendered.setSortable(column.sortable());
            columnsById.put(column.id(), rendered);
        }

        private TableColumn<R, String> textColumn(CatalogColumnSpec<R> specColumn) {
            TableColumn<R, String> column = new TableColumn<>(specColumn.label());
            column.setCellValueFactory(data -> new SimpleStringProperty(specColumn.value().apply(data.getValue())));
            return column;
        }

        private TableColumn<R, R> primaryColumn(CatalogColumnSpec<R> specColumn, CatalogActionSpec action) {
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
            CatalogPicker<V> picker = new CatalogPicker<>(specFilter.prompt(), specFilter.accessibleText(), false);
            AtomicReference<List<CatalogChoice<V>>> shown = new AtomicReference<>(List.of());
            picker.setOnCommit(values -> {
                V value = values.isEmpty() ? neutralValue(shown.get()) : values.getFirst();
                if (value != null) {
                    commands.editDraft().accept(specFilter.update().apply(draft, value));
                }
            });
            return binding(picker, query -> {
                List<CatalogChoice<V>> choices = specFilter.choices().apply(query);
                shown.set(choices);
                picker.setChoices(choices);
                picker.setSelection(List.of(specFilter.value().apply(query)));
            });
        }

        private <V> FilterBinding<Q> multiBinding(CatalogFilterSpec.MultiChoice<Q, V> specFilter) {
            CatalogPicker<V> picker = new CatalogPicker<>(specFilter.prompt(), specFilter.accessibleText(), true);
            picker.setOnCommit(values -> commands.editDraft().accept(specFilter.update().apply(draft, values)));
            return binding(picker, query -> {
                picker.setChoices(specFilter.choices().apply(query));
                picker.setSelection(specFilter.values().apply(query));
            });
        }

        private <V> FilterBinding<Q> choiceRangeBinding(CatalogFilterSpec.ChoiceRange<Q, V> specFilter) {
            CatalogPicker<V> minimum = new CatalogPicker<>(
                    specFilter.prompt() + " ab", specFilter.accessibleText() + " Minimum", false);
            CatalogPicker<V> maximum = new CatalogPicker<>(
                    specFilter.prompt() + " bis", specFilter.accessibleText() + " Maximum", false);
            AtomicReference<List<CatalogChoice<V>>> shown = new AtomicReference<>(List.of());
            AtomicReference<V> currentMinimum = new AtomicReference<>();
            AtomicReference<V> currentMaximum = new AtomicReference<>();
            minimum.setOnCommit(values -> {
                V value = values.isEmpty() ? neutralValue(shown.get()) : values.getFirst();
                if (value != null) {
                    commands.editDraft().accept(specFilter.update().apply(draft, value, currentMaximum.get()));
                }
            });
            maximum.setOnCommit(values -> {
                V value = values.isEmpty() ? neutralValue(shown.get()) : values.getFirst();
                if (value != null) {
                    commands.editDraft().accept(specFilter.update().apply(draft, currentMinimum.get(), value));
                }
            });
            HBox row = new HBox(minimum, maximum);
            row.getStyleClass().add("catalog-range-control");
            return binding(row, query -> {
                List<CatalogChoice<V>> choices = specFilter.choices().apply(query);
                shown.set(choices);
                currentMinimum.set(specFilter.minimum().apply(query));
                currentMaximum.set(specFilter.maximum().apply(query));
                minimum.setChoices(choices);
                maximum.setChoices(choices);
                minimum.setSelection(List.of(currentMinimum.get()));
                maximum.setSelection(List.of(currentMaximum.get()));
                boolean managed = minimum.isManaged() || maximum.isManaged();
                setManaged(row, managed);
            });
        }

        private FilterBinding<Q> textRangeBinding(CatalogFilterSpec.TextRange<Q> specFilter) {
            var minimum = controls.text(specFilter.prompt() + " ab", specFilter.accessibleText() + " Minimum");
            var maximum = controls.text(specFilter.prompt() + " bis", specFilter.accessibleText() + " Maximum");
            Runnable update = () -> {
                if (!rendering) {
                    commands.editDraft().accept(specFilter.update().apply(draft, minimum.getText(), maximum.getText()));
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
            CatalogPicker<TriStateChoice> picker = new CatalogPicker<>(
                    specFilter.prompt(), specFilter.accessibleText(), false);
            picker.setChoices(List.of(
                    new CatalogChoice<>(TriStateChoice.NEUTRAL, "Beliebig"),
                    new CatalogChoice<>(TriStateChoice.YES, "Ja"),
                    new CatalogChoice<>(TriStateChoice.NO, "Nein")));
            picker.setOnCommit(values -> {
                TriStateChoice choice = values.isEmpty() ? TriStateChoice.NEUTRAL : values.getFirst();
                commands.editDraft().accept(specFilter.update().apply(draft, choice.value));
            });
            return binding(picker, query -> picker.setSelection(
                    List.of(TriStateChoice.from(specFilter.value().apply(query)))));
        }

        private Button actionButton(CatalogActionSpec action) {
            Button button = controls.action(action.label(), action.accessiblePrefix(),
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

    private static <V> V neutralValue(List<CatalogChoice<V>> choices) {
        return choices.stream().filter(CatalogSectionRenderer::neutral).map(CatalogChoice::value)
                .findFirst().orElse(null);
    }

    private static boolean neutral(CatalogChoice<?> choice) {
        return "Alle".equalsIgnoreCase(choice.label()) || "Beliebig".equalsIgnoreCase(choice.label());
    }

    private static <Q> FilterBinding<Q> binding(Node node, Consumer<Q> renderer) {
        return new FilterBinding<>() {
            @Override public Node node() { return node; }
            @Override public void render(Q query) { renderer.accept(query); }
        };
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
            case LOADING -> "Lade…";
            case REFRESHING -> "Aktualisiere…";
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
        NEUTRAL(null), YES(true), NO(false);

        private final Boolean value;

        TriStateChoice(Boolean value) {
            this.value = value;
        }

        private static TriStateChoice from(Boolean value) {
            return value == null ? NEUTRAL : value ? YES : NO;
        }
    }
}
