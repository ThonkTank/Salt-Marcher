package clean.navigation;

import clean.navigation.input.ComposeNavigationInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
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
        titleLabel.getStyleClass().add("toolbar-title");
        StackPane toolbarItems = new StackPane();
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox toolbarContent = new HBox(12, titleLabel, spacer, toolbarItems);
        toolbarContent.setAlignment(Pos.CENTER_LEFT);

        VBox navigationContent = new VBox(8);
        navigationContent.getStyleClass().add("navigation-list");

        StackPane controlsContent = new StackPane();
        StackPane mainContent = new StackPane();
        StackPane detailsContent = new StackPane();
        StackPane stateContent = new StackPane();

        java.util.ArrayList<ComposeNavigationInput.SurfaceInput> normalizedSurfaces = new java.util.ArrayList<>();
        if (resolvedInput.surfaces() != null) {
            for (ComposeNavigationInput.SurfaceInput surface : resolvedInput.surfaces()) {
                if (surface == null) {
                    continue;
                }
                String surfaceId = surface.surfaceId() == null ? "" : surface.surfaceId().trim();
                if (surfaceId.isBlank()) {
                    continue;
                }
                normalizedSurfaces.add(new ComposeNavigationInput.SurfaceInput(
                        surfaceId,
                        surface.title() == null ? "" : surface.title().trim(),
                        surface.navigationLabel() == null ? "" : surface.navigationLabel().trim(),
                        surface.toolbarContent(),
                        surface.controlsContent(),
                        surface.mainContent(),
                        surface.detailsContent(),
                        surface.stateContent(),
                        surface.onShow(),
                        surface.onHide()));
            }
        }
        java.util.List<ComposeNavigationInput.SurfaceInput> surfaces = java.util.List.copyOf(normalizedSurfaces);
        ToggleGroup toggleGroup = new ToggleGroup();
        String initialSurfaceId = resolvedInput.initialSurfaceId() == null ? "" : resolvedInput.initialSurfaceId().trim();
        if (initialSurfaceId.isBlank()) {
            initialSurfaceId = surfaces.isEmpty() ? "" : surfaces.getFirst().surfaceId();
        } else {
            boolean hasRequestedSurface = false;
            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                if (surface.surfaceId().equals(initialSurfaceId)) {
                    hasRequestedSurface = true;
                    break;
                }
            }
            if (!hasRequestedSurface) {
                initialSurfaceId = surfaces.isEmpty() ? "" : surfaces.getFirst().surfaceId();
            }
        }
        String[] activeSurfaceId = new String[]{initialSurfaceId};

        Runnable showSurface = () -> {
            ComposeNavigationInput.SurfaceInput activeSurface = null;
            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                if (surface.surfaceId().equals(activeSurfaceId[0])) {
                    activeSurface = surface;
                    break;
                }
            }
            if (activeSurface == null) {
                titleLabel.setText("");
                toolbarItems.getChildren().clear();
                Label controlsLabel = new Label("Noch keine Clean-Surface registriert.");
                controlsLabel.setWrapText(true);
                VBox controlsPanel = new VBox(controlsLabel);
                controlsPanel.setAlignment(Pos.CENTER_LEFT);
                controlsPanel.setPadding(new Insets(18));
                controlsPanel.getStyleClass().add("empty-panel");
                controlsContent.getChildren().setAll(controlsPanel);
                Label mainLabel = new Label("Noch keine Inhalte vorhanden.");
                mainLabel.setWrapText(true);
                VBox mainPanel = new VBox(mainLabel);
                mainPanel.setAlignment(Pos.CENTER_LEFT);
                mainPanel.setPadding(new Insets(18));
                mainPanel.getStyleClass().add("empty-panel");
                mainContent.getChildren().setAll(mainPanel);
                Label detailsLabel = new Label("Noch keine Details vorhanden.");
                detailsLabel.setWrapText(true);
                VBox detailsPanel = new VBox(detailsLabel);
                detailsPanel.setAlignment(Pos.CENTER_LEFT);
                detailsPanel.setPadding(new Insets(18));
                detailsPanel.getStyleClass().add("empty-panel");
                detailsContent.getChildren().setAll(detailsPanel);
                Label stateLabel = new Label("Noch kein Status vorhanden.");
                stateLabel.setWrapText(true);
                VBox statePanel = new VBox(stateLabel);
                statePanel.setAlignment(Pos.CENTER_LEFT);
                statePanel.setPadding(new Insets(18));
                statePanel.getStyleClass().add("empty-panel");
                stateContent.getChildren().setAll(statePanel);
                return;
            }
            titleLabel.setText(activeSurface.title());
            toolbarItems.getChildren().setAll(activeSurface.toolbarContent() == null ? new Region() : activeSurface.toolbarContent());
            if (activeSurface.controlsContent() == null) {
                Label label = new Label("Diese Surface hat noch keine Controls.");
                label.setWrapText(true);
                VBox panel = new VBox(label);
                panel.setAlignment(Pos.CENTER_LEFT);
                panel.setPadding(new Insets(18));
                panel.getStyleClass().add("empty-panel");
                controlsContent.getChildren().setAll(panel);
            } else {
                controlsContent.getChildren().setAll(activeSurface.controlsContent());
            }
            if (activeSurface.mainContent() == null) {
                Label label = new Label("Diese Surface hat noch keinen Main-Content.");
                label.setWrapText(true);
                VBox panel = new VBox(label);
                panel.setAlignment(Pos.CENTER_LEFT);
                panel.setPadding(new Insets(18));
                panel.getStyleClass().add("empty-panel");
                mainContent.getChildren().setAll(panel);
            } else {
                mainContent.getChildren().setAll(activeSurface.mainContent());
            }
            if (activeSurface.detailsContent() == null) {
                Label label = new Label("Diese Surface hat noch keine Details.");
                label.setWrapText(true);
                VBox panel = new VBox(label);
                panel.setAlignment(Pos.CENTER_LEFT);
                panel.setPadding(new Insets(18));
                panel.getStyleClass().add("empty-panel");
                detailsContent.getChildren().setAll(panel);
            } else {
                detailsContent.getChildren().setAll(activeSurface.detailsContent());
            }
            if (activeSurface.stateContent() == null) {
                Label label = new Label("Diese Surface hat noch keinen State-Inhalt.");
                label.setWrapText(true);
                VBox panel = new VBox(label);
                panel.setAlignment(Pos.CENTER_LEFT);
                panel.setPadding(new Insets(18));
                panel.getStyleClass().add("empty-panel");
                stateContent.getChildren().setAll(panel);
            } else {
                stateContent.getChildren().setAll(activeSurface.stateContent());
            }
            if (activeSurface.onShow() != null) {
                activeSurface.onShow().run();
            }
        };

        Runnable hideSurface = () -> {
            ComposeNavigationInput.SurfaceInput activeSurface = null;
            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                if (surface.surfaceId().equals(activeSurfaceId[0])) {
                    activeSurface = surface;
                    break;
                }
            }
            if (activeSurface != null && activeSurface.onHide() != null) {
                activeSurface.onHide().run();
            }
        };

        for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
            ToggleButton button = new ToggleButton(surface.navigationLabel().isBlank()
                    ? surface.surfaceId()
                    : surface.navigationLabel());
            button.getStyleClass().add("nav-button");
            button.setMaxWidth(Double.MAX_VALUE);
            button.setToggleGroup(toggleGroup);
            button.setFocusTraversable(false);
            if (surface.surfaceId().equals(activeSurfaceId[0])) {
                button.setSelected(true);
            }
            button.setOnAction(event -> {
                if (surface.surfaceId().equals(activeSurfaceId[0])) {
                    return;
                }
                hideSurface.run();
                activeSurfaceId[0] = surface.surfaceId();
                showSurface.run();
            });
            navigationContent.getChildren().add(button);
        }

        showSurface.run();
        VBox.setVgrow(controlsContent, Priority.ALWAYS);
        VBox.setVgrow(mainContent, Priority.ALWAYS);
        VBox.setVgrow(detailsContent, Priority.ALWAYS);
        VBox.setVgrow(stateContent, Priority.ALWAYS);
        return new ComposeNavigationInput.NavigationInput(
                toolbarContent,
                navigationContent,
                controlsContent,
                mainContent,
                detailsContent,
                stateContent);
    }
}
