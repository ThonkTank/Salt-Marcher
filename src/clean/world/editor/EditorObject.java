package clean.world.editor;

import clean.shell.input.ComposeShellInput;
import clean.world.dungeon.DungeonObject;
import clean.world.dungeon.input.ComposeDungeoneditorInput;
import clean.world.editor.input.ComposeMapeditortabInput;
import clean.world.hex.HexObject;
import clean.world.hex.input.ComposeHexeditorInput;
import clean.world.mapcatalog.input.LoadMapsInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Owner root seam for the aggregated world editor host.
 */
public final class EditorObject {

    private final ComposeMapeditortabInput.MapeditortabInput mapeditortab;

    public EditorObject(ComposeMapeditortabInput input) {
        ComposeMapeditortabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.mapeditortab = new EditorAssembly(resolvedInput).composeMapeditortab();
    }

    public ComposeMapeditortabInput.MapeditortabInput composeMapeditortab(ComposeMapeditortabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return mapeditortab;
    }

    private static final class EditorAssembly {

        private final ComposeMapeditortabInput input;
        private final StackPane toolbarHost = new StackPane();
        private final StackPane childControlsHost = new StackPane();
        private final StackPane mainHost = new StackPane();
        private final StackPane detailsHost = new StackPane();
        private final StackPane stateHost = new StackPane();

        private LoadMapsInput.LoadedMapsInput loadedMaps;
        private ComposeShellInput.SurfaceInput activeChildSurface;
        private ComposeShellInput.ShellHooksInput cachedHooks;
        private ComboBox<LoadMapsInput.MapSummary> mapSelector;
        private Label activeModeLabel;
        private Label hintLabel;
        private boolean visible;

        private EditorAssembly(ComposeMapeditortabInput input) {
            this.input = input;
        }

        private ComposeMapeditortabInput.MapeditortabInput composeMapeditortab() {
            loadedMaps = normalizeLoadedMaps(input.loadedMaps());
            activeModeLabel = createMutedLabel(initialModeLabelText(loadedMaps));
            hintLabel = createMutedLabel(buildHintText(loadedMaps));
            mapSelector = createMapSelector(loadedMaps.maps());

            VBox controls = createControls(mapSelector, activeModeLabel, hintLabel, childControlsHost);
            initializeSelection();
            mapSelector.getSelectionModel().selectedItemProperty().addListener(
                    (observable, previousMap, selectedMap) -> activateMap(selectedMap));

            return new ComposeMapeditortabInput.MapeditortabInput(new ComposeShellInput.SurfaceInput(
                    "map-editor",
                    "Map Editor",
                    "editor",
                    "ME",
                    input.navigationGraphic(),
                    toolbarHost,
                    controls,
                    mainHost,
                    detailsHost,
                    stateHost,
                    this::showActiveChild,
                    this::hideActiveChild,
                    this::cacheShellHooks
            ));
        }

        private void initializeSelection() {
            if (loadedMaps.maps().isEmpty()) {
                showCatalogState();
                return;
            }
            mapSelector.getSelectionModel().selectFirst();
            activateMap(mapSelector.getValue());
        }

        private void activateMap(LoadMapsInput.MapSummary map) {
            if (map == null) {
                hideCurrentChildIfVisible();
                activeChildSurface = null;
                showCatalogState();
                return;
            }
            ComposeShellInput.SurfaceInput nextChild = composeChildSurface(map);
            hideCurrentChildIfVisible();
            activeChildSurface = nextChild;
            activeModeLabel.setText("Aktiver Host: " + describeHost(map));
            hintLabel.setText("Kartenwahl und Lifecycle bleiben lokal im Map-Editor-Tab.");
            swapHostContent(nextChild);
            if (cachedHooks != null && nextChild.onShellReady() != null) {
                nextChild.onShellReady().accept(cachedHooks);
            }
            if (visible && nextChild.onShow() != null) {
                nextChild.onShow().run();
            }
        }

        private ComposeShellInput.SurfaceInput composeChildSurface(LoadMapsInput.MapSummary map) {
            if (map.ref().kind() instanceof LoadMapsInput.DungeonKind) {
                ComposeDungeoneditorInput composeDungeoneditorInput = new ComposeDungeoneditorInput(map);
                return new DungeonObject().composeDungeoneditor(composeDungeoneditorInput).surface();
            }
            ComposeHexeditorInput composeHexeditorInput = new ComposeHexeditorInput(map);
            return new HexObject().composeHexeditor(composeHexeditorInput).surface();
        }

        private void showCatalogState() {
            String statusTitle = loadedMaps.errorMessage().isEmpty()
                    ? "Noch keine Karten verfuegbar"
                    : "Kartenkatalog konnte nicht geladen werden";
            String statusBody = loadedMaps.errorMessage().isEmpty()
                    ? "Map Editor braucht mindestens eine Hexmap oder Dungeon-Karte aus der SQLite-DB."
                    : loadedMaps.errorMessage();
            activeModeLabel.setText(loadedMaps.errorMessage().isEmpty()
                    ? "Aktiver Host: keiner"
                    : "Aktiver Host: Ladefehler");
            hintLabel.setText(loadedMaps.errorMessage().isEmpty()
                    ? "Sobald Karten vorhanden sind, bindet Map Editor den passenden Child-Host ein."
                    : "Map Editor zeigt den Fehler explizit an und faellt nicht still auf leere Inhalte zurueck.");
            setHostNode(toolbarHost, createHostPlaceholder("Toolbar", statusTitle));
            setHostNode(childControlsHost, createHostPlaceholder("Host Controls", statusBody));
            setHostNode(mainHost, createHostPlaceholder("Map Editor", statusBody));
            setHostNode(detailsHost, createHostPlaceholder("Details", "Metadaten erscheinen, sobald eine Karte geladen wurde."));
            setHostNode(stateHost, createHostPlaceholder("State", "Lifecycle- und Hook-Status erscheinen mit einem aktiven Child-Host."));
        }

        private void swapHostContent(ComposeShellInput.SurfaceInput surface) {
            setHostNode(toolbarHost, surface == null ? null : surface.toolbarContent());
            setHostNode(childControlsHost, surface == null ? null : surface.controlsContent());
            setHostNode(mainHost, surface == null ? null : surface.mainContent());
            setHostNode(detailsHost, surface == null ? null : surface.detailsContent());
            setHostNode(stateHost, surface == null ? null : surface.stateContent());
        }

        private void cacheShellHooks(ComposeShellInput.ShellHooksInput hooks) {
            cachedHooks = hooks;
            if (activeChildSurface != null && activeChildSurface.onShellReady() != null) {
                activeChildSurface.onShellReady().accept(hooks);
            }
        }

        private void showActiveChild() {
            visible = true;
            if (activeChildSurface != null && activeChildSurface.onShow() != null) {
                activeChildSurface.onShow().run();
            }
        }

        private void hideActiveChild() {
            visible = false;
            if (activeChildSurface != null && activeChildSurface.onHide() != null) {
                activeChildSurface.onHide().run();
            }
        }

        private void hideCurrentChildIfVisible() {
            if (visible && activeChildSurface != null && activeChildSurface.onHide() != null) {
                activeChildSurface.onHide().run();
            }
        }

        private static LoadMapsInput.LoadedMapsInput normalizeLoadedMaps(LoadMapsInput.LoadedMapsInput loadedMaps) {
            if (loadedMaps == null) {
                return new LoadMapsInput.LoadedMapsInput(java.util.List.of(), "");
            }
            java.util.List<LoadMapsInput.MapSummary> maps = loadedMaps.maps() == null
                    ? java.util.List.of()
                    : java.util.List.copyOf(loadedMaps.maps().stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
            return new LoadMapsInput.LoadedMapsInput(maps, normalizeText(loadedMaps.errorMessage()));
        }

        private static VBox createControls(
                ComboBox<LoadMapsInput.MapSummary> mapSelector,
                Label activeModeLabel,
                Label hintLabel,
                StackPane childControlsHost
        ) {
            Label header = new Label("Map Editor");
            header.getStyleClass().add("subheading");

            Label mapLabel = createMutedLabel("Karte");
            VBox controls = new VBox(8, header, mapLabel, mapSelector, activeModeLabel, hintLabel, childControlsHost);
            controls.setFillWidth(true);
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static ComboBox<LoadMapsInput.MapSummary> createMapSelector(
                java.util.List<LoadMapsInput.MapSummary> maps
        ) {
            ComboBox<LoadMapsInput.MapSummary> comboBox = new ComboBox<>();
            comboBox.getItems().setAll(maps);
            comboBox.setDisable(maps.isEmpty());
            comboBox.setMaxWidth(Double.MAX_VALUE);
            comboBox.setPromptText("Karte waehlen");
            comboBox.setButtonCell(createMapCell());
            comboBox.setCellFactory(listView -> createMapCell());
            return comboBox;
        }

        private static ListCell<LoadMapsInput.MapSummary> createMapCell() {
            return new ListCell<>() {
                @Override
                protected void updateItem(LoadMapsInput.MapSummary item, boolean empty) {
                    super.updateItem(item, empty);
                    setText(empty || item == null ? "" : item.title()
                            + " (" + describeKind(item.ref().kind()) + " #" + item.ref().mapId() + ")");
                }
            };
        }

        private static Node createHostPlaceholder(String titleText, String bodyText) {
            VBox box = new VBox(
                    8,
                    createSectionLabel(titleText),
                    createMutedLabel(bodyText)
            );
            box.setPadding(new Insets(12));
            return box;
        }

        private static void setHostNode(StackPane host, Node content) {
            if (content == null) {
                host.getChildren().clear();
                return;
            }
            host.getChildren().setAll(content);
        }

        private static String initialModeLabelText(LoadMapsInput.LoadedMapsInput loadedMaps) {
            if (!loadedMaps.errorMessage().isEmpty()) {
                return "Aktiver Host: Ladefehler";
            }
            return loadedMaps.maps().isEmpty() ? "Aktiver Host: keiner" : "Aktiver Host: Auswahl folgt";
        }

        private static String buildHintText(LoadMapsInput.LoadedMapsInput loadedMaps) {
            if (!loadedMaps.errorMessage().isEmpty()) {
                return "Map Editor konnte den Kartenkatalog nicht laden und zeigt den Fehlerzustand.";
            }
            if (loadedMaps.maps().isEmpty()) {
                return "Map Editor zeigt einen expliziten Leerzustand, bis Karten aus SQLite verfuegbar sind.";
            }
            return "Map Editor waehlt je nach Kartentyp automatisch den passenden Child-Host.";
        }

        private static String describeHost(LoadMapsInput.MapSummary map) {
            return map.ref().kind() instanceof LoadMapsInput.DungeonKind ? "Dungeon Editor" : "Hex Editor";
        }

        private static String describeKind(LoadMapsInput.MapKind kind) {
            return kind instanceof LoadMapsInput.DungeonKind ? "Dungeon" : "Hexmap";
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("subheading");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
