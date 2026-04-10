package clean.navigation;

import clean.navigation.input.ComposeNavigationInput;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Navigation owner for clean surface switching and panel projection.
 */
@SuppressWarnings("unused")
public final class NavigationObject {

    public ComposeNavigationInput.NavigationInput composeNavigation(ComposeNavigationInput input) {
        ComposeNavigationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        Label titleLabel = new Label();
        StackPane toolbarItems = new StackPane();
        Region toolbarSpacer = new Region();
        HBox toolbarContent = new HBox(12, titleLabel, toolbarSpacer, toolbarItems);
        VBox navigationContent = new VBox(8);
        StackPane controlsContent = new StackPane();
        StackPane mainContent = new StackPane();
        StackPane detailsContent = new StackPane();
        StackPane stateContent = new StackPane();
        ComposeNavigationInput.NavigationInput navigation = new ComposeNavigationInput.NavigationInput(
                toolbarContent,
                navigationContent,
                controlsContent,
                mainContent,
                detailsContent,
                stateContent);
        composeNavigation(navigation, resolvedInput);
        return navigation;
    }

    private void composeNavigation(ComposeNavigationInput.NavigationInput navigation, ComposeNavigationInput input) {
        HBox toolbarContent = (HBox) navigation.toolbarContent();
        toolbarContent.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow((Region) toolbarContent.getChildren().get(1), Priority.ALWAYS);
        Label titleLabel = (Label) toolbarContent.getChildren().get(0);
        titleLabel.getStyleClass().add("toolbar-title");

        VBox navigationContent = (VBox) navigation.navigationContent();
        navigationContent.getStyleClass().add("navigation-list");

        ToggleButton startButton = createButton(input.startSurface());
        ToggleButton encounterButton = createButton(input.encounterSurface());
        ToggleButton overworldButton = createButton(input.overworldSurface());
        ToggleButton mapEditorButton = createButton(input.mapEditorSurface());
        ToggleButton dungeonButton = createButton(input.dungeonSurface());
        ToggleButton dungeonEditorButton = createButton(input.dungeonEditorSurface());
        ToggleButton tablesButton = createButton(input.tablesSurface());
        ToggleButton spellsButton = createButton(input.spellsSurface());

        navigationContent.getChildren().add(startButton);
        navigationContent.getChildren().add(encounterButton);
        navigationContent.getChildren().add(overworldButton);
        navigationContent.getChildren().add(mapEditorButton);
        navigationContent.getChildren().add(dungeonButton);
        navigationContent.getChildren().add(dungeonEditorButton);
        navigationContent.getChildren().add(tablesButton);
        navigationContent.getChildren().add(spellsButton);

        java.util.concurrent.atomic.AtomicReference<String> activeSurfaceId =
                new java.util.concurrent.atomic.AtomicReference<>(resolveInitialSurfaceId(input));

        Runnable showStart = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.startSurface(), titleLabel);
            }
        };
        Runnable showEncounter = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.encounterSurface(), titleLabel);
            }
        };
        Runnable showOverworld = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.overworldSurface(), titleLabel);
            }
        };
        Runnable showMapEditor = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.mapEditorSurface(), titleLabel);
            }
        };
        Runnable showDungeon = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.dungeonSurface(), titleLabel);
            }
        };
        Runnable showDungeonEditor = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.dungeonEditorSurface(), titleLabel);
            }
        };
        Runnable showTables = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.tablesSurface(), titleLabel);
            }
        };
        Runnable showSpells = new Runnable() {
            @Override
            public void run() {
                applySurface(navigation, input.spellsSurface(), titleLabel);
            }
        };

        EventHandler<ActionEvent> startHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.startSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showStart.run();
            }
        };
        EventHandler<ActionEvent> encounterHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.encounterSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showEncounter.run();
            }
        };
        EventHandler<ActionEvent> overworldHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.overworldSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showOverworld.run();
            }
        };
        EventHandler<ActionEvent> mapEditorHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.mapEditorSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showMapEditor.run();
            }
        };
        EventHandler<ActionEvent> dungeonHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.dungeonSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showDungeon.run();
            }
        };
        EventHandler<ActionEvent> dungeonEditorHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.dungeonEditorSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showDungeonEditor.run();
            }
        };
        EventHandler<ActionEvent> tablesHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.tablesSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showTables.run();
            }
        };
        EventHandler<ActionEvent> spellsHandler = new EventHandler<>() {
            @Override
            public void handle(ActionEvent event) {
                activateSurface(activeSurfaceId, input, input.spellsSurface(), startButton, encounterButton, overworldButton,
                        mapEditorButton, dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
                showSpells.run();
            }
        };

        startButton.setOnAction(startHandler);
        encounterButton.setOnAction(encounterHandler);
        overworldButton.setOnAction(overworldHandler);
        mapEditorButton.setOnAction(mapEditorHandler);
        dungeonButton.setOnAction(dungeonHandler);
        dungeonEditorButton.setOnAction(dungeonEditorHandler);
        tablesButton.setOnAction(tablesHandler);
        spellsButton.setOnAction(spellsHandler);

        if (input.encounterSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.encounterSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showEncounter.run();
        } else if (input.overworldSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.overworldSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showOverworld.run();
        } else if (input.mapEditorSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.mapEditorSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showMapEditor.run();
        } else if (input.dungeonSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.dungeonSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showDungeon.run();
        } else if (input.dungeonEditorSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.dungeonEditorSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showDungeonEditor.run();
        } else if (input.tablesSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.tablesSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showTables.run();
        } else if (input.spellsSurface().surfaceId().equals(activeSurfaceId.get())) {
            activateButtons(input.spellsSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showSpells.run();
        } else {
            activateButtons(input.startSurface(), startButton, encounterButton, overworldButton, mapEditorButton,
                    dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
            showStart.run();
        }
    }

    private void applySurface(
            ComposeNavigationInput.NavigationInput navigation,
            ComposeNavigationInput.SurfaceInput surface,
            Label titleLabel
    ) {
        titleLabel.setText(surface.title());
        StackPane toolbarItems = (StackPane) ((HBox) navigation.toolbarContent()).getChildren().get(2);
        toolbarItems.getChildren().clear();
        toolbarItems.getChildren().add(surface.toolbarContent() == null ? new Region() : surface.toolbarContent());

        StackPane controlsContent = (StackPane) navigation.controlsContent();
        controlsContent.getChildren().clear();
        controlsContent.getChildren().add(surface.controlsContent() == null
                ? createEmptyPanel("Diese Surface hat noch keine Controls.")
                : surface.controlsContent());

        StackPane mainContent = (StackPane) navigation.mainContent();
        mainContent.getChildren().clear();
        mainContent.getChildren().add(surface.mainContent() == null
                ? createEmptyPanel("Diese Surface hat noch keinen Main-Content.")
                : surface.mainContent());

        StackPane detailsContent = (StackPane) navigation.detailsContent();
        detailsContent.getChildren().clear();
        detailsContent.getChildren().add(surface.detailsContent() == null
                ? createEmptyPanel("Diese Surface hat noch keine Details.")
                : surface.detailsContent());

        StackPane stateContent = (StackPane) navigation.stateContent();
        stateContent.getChildren().clear();
        stateContent.getChildren().add(surface.stateContent() == null
                ? createEmptyPanel("Diese Surface hat noch keinen State-Inhalt.")
                : surface.stateContent());

        if (surface.onShow() != null) {
            surface.onShow().run();
        }
    }

    private void activateSurface(
            java.util.concurrent.atomic.AtomicReference<String> activeSurfaceId,
            ComposeNavigationInput input,
            ComposeNavigationInput.SurfaceInput targetSurface,
            ToggleButton startButton,
            ToggleButton encounterButton,
            ToggleButton overworldButton,
            ToggleButton mapEditorButton,
            ToggleButton dungeonButton,
            ToggleButton dungeonEditorButton,
            ToggleButton tablesButton,
            ToggleButton spellsButton
    ) {
        hideSurface(activeSurfaceId.get(), input);
        activeSurfaceId.set(targetSurface.surfaceId());
        activateButtons(targetSurface, startButton, encounterButton, overworldButton, mapEditorButton,
                dungeonButton, dungeonEditorButton, tablesButton, spellsButton);
    }

    private void hideSurface(String activeSurfaceId, ComposeNavigationInput input) {
        if (input.startSurface().surfaceId().equals(activeSurfaceId) && input.startSurface().onHide() != null) {
            input.startSurface().onHide().run();
        } else if (input.encounterSurface().surfaceId().equals(activeSurfaceId) && input.encounterSurface().onHide() != null) {
            input.encounterSurface().onHide().run();
        } else if (input.overworldSurface().surfaceId().equals(activeSurfaceId) && input.overworldSurface().onHide() != null) {
            input.overworldSurface().onHide().run();
        } else if (input.mapEditorSurface().surfaceId().equals(activeSurfaceId) && input.mapEditorSurface().onHide() != null) {
            input.mapEditorSurface().onHide().run();
        } else if (input.dungeonSurface().surfaceId().equals(activeSurfaceId) && input.dungeonSurface().onHide() != null) {
            input.dungeonSurface().onHide().run();
        } else if (input.dungeonEditorSurface().surfaceId().equals(activeSurfaceId) && input.dungeonEditorSurface().onHide() != null) {
            input.dungeonEditorSurface().onHide().run();
        } else if (input.tablesSurface().surfaceId().equals(activeSurfaceId) && input.tablesSurface().onHide() != null) {
            input.tablesSurface().onHide().run();
        } else if (input.spellsSurface().surfaceId().equals(activeSurfaceId) && input.spellsSurface().onHide() != null) {
            input.spellsSurface().onHide().run();
        }
    }

    private void activateButtons(
            ComposeNavigationInput.SurfaceInput activeSurface,
            ToggleButton startButton,
            ToggleButton encounterButton,
            ToggleButton overworldButton,
            ToggleButton mapEditorButton,
            ToggleButton dungeonButton,
            ToggleButton dungeonEditorButton,
            ToggleButton tablesButton,
            ToggleButton spellsButton
    ) {
        startButton.setSelected(activeSurface.surfaceId().equals("start"));
        encounterButton.setSelected(activeSurface.surfaceId().equals("encounter"));
        overworldButton.setSelected(activeSurface.surfaceId().equals("overworld"));
        mapEditorButton.setSelected(activeSurface.surfaceId().equals("map-editor"));
        dungeonButton.setSelected(activeSurface.surfaceId().equals("dungeon"));
        dungeonEditorButton.setSelected(activeSurface.surfaceId().equals("dungeon-editor"));
        tablesButton.setSelected(activeSurface.surfaceId().equals("tables"));
        spellsButton.setSelected(activeSurface.surfaceId().equals("spells"));
    }

    private String resolveInitialSurfaceId(ComposeNavigationInput input) {
        String requested = input.initialSurfaceId() == null ? "" : input.initialSurfaceId().trim();
        if (requested.isBlank()) {
            return input.startSurface().surfaceId();
        }
        if (requested.equals(input.encounterSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.overworldSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.mapEditorSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.dungeonSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.dungeonEditorSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.tablesSurface().surfaceId())) {
            return requested;
        }
        if (requested.equals(input.spellsSurface().surfaceId())) {
            return requested;
        }
        return input.startSurface().surfaceId();
    }

    private ToggleButton createButton(ComposeNavigationInput.SurfaceInput surface) {
        ToggleButton button = new ToggleButton(surface.navigationLabel() == null || surface.navigationLabel().isBlank()
                ? surface.surfaceId()
                : surface.navigationLabel());
        button.getStyleClass().add("nav-button");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setFocusTraversable(false);
        return button;
    }

    private VBox createEmptyPanel(String message) {
        Label label = new Label(message);
        label.setWrapText(true);
        VBox container = new VBox(label);
        container.setAlignment(Pos.CENTER_LEFT);
        container.setPadding(new Insets(18));
        container.getStyleClass().add("empty-panel");
        return container;
    }
}
