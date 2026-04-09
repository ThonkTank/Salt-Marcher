package features.appshell.navigation;

import features.appshell.navigation.input.ComposeNavigationInput;
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
 * Clean shell navigation owner for active-surface registration and cockpit swapping.
 */
@SuppressWarnings("unused")
public final class NavigationObject {

    private final ComposeNavigationInput.NavigationInput navigation;

    public NavigationObject(ComposeNavigationInput input) {
        ComposeNavigationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.navigation = new NavigationAssembly(resolvedInput).composeNavigation();
    }

    public ComposeNavigationInput.NavigationInput composeNavigation(ComposeNavigationInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return navigation;
    }

    private static final class NavigationAssembly {

        private final ComposeNavigationInput input;

        private NavigationAssembly(ComposeNavigationInput input) {
            this.input = input;
        }

        private ComposeNavigationInput.NavigationInput composeNavigation() {
            Label toolbarTitle = new Label();
            toolbarTitle.getStyleClass().add("toolbar-title");
            StackPane toolbarItemsContent = new StackPane();
            Region toolbarSpacer = new Region();
            HBox.setHgrow(toolbarSpacer, Priority.ALWAYS);
            HBox toolbarContent = new HBox(8, toolbarTitle, toolbarSpacer, toolbarItemsContent);
            toolbarContent.setAlignment(Pos.CENTER_LEFT);
            HBox.setHgrow(toolbarItemsContent, Priority.NEVER);

            VBox navigationContent = new VBox(4);
            navigationContent.setAlignment(Pos.TOP_CENTER);

            StackPane controlsContent = new StackPane();
            StackPane mainContent = new StackPane();
            StackPane detailsContent = new StackPane();
            StackPane stateContent = new StackPane();

            VBox controlsPlaceholder = createPlaceholder("Keine lokalen Controls");
            VBox mainPlaceholder = createPlaceholder("Kein lokaler Inhalt");
            VBox detailsPlaceholder = createPlaceholder("Keine lokalen Details");
            VBox statePlaceholder = createPlaceholder("Kein lokaler Zustand");
            Node defaultDetailsContent = input.defaultDetailsContent() == null
                    ? detailsPlaceholder
                    : input.defaultDetailsContent();

            java.util.List<ComposeNavigationInput.SurfaceInput> surfaces = normalizeSurfaces(input.surfaces());
            String initialSurfaceId = resolveInitialSurfaceId(surfaces, input.initialSurfaceId());
            ToggleGroup toggleGroup = new ToggleGroup();
            String[] activeSurfaceId = new String[]{initialSurfaceId};

            Runnable showActiveSurface = () -> {
                ComposeNavigationInput.SurfaceInput activeSurface = findSurface(surfaces, activeSurfaceId[0]);
                if (activeSurface == null) {
                    toolbarTitle.setText("");
                    toolbarItemsContent.getChildren().clear();
                    controlsContent.getChildren().setAll(controlsPlaceholder);
                    mainContent.getChildren().setAll(mainPlaceholder);
                    detailsContent.getChildren().setAll(defaultDetailsContent);
                    stateContent.getChildren().setAll(statePlaceholder);
                    return;
                }
                toolbarTitle.setText(activeSurface.title());
                toolbarItemsContent.getChildren().setAll(
                        activeSurface.toolbarContent() == null ? createEmptyToolbarContent() : activeSurface.toolbarContent());
                controlsContent.getChildren().setAll(activeSurface.controlsContent() == null ? controlsPlaceholder : activeSurface.controlsContent());
                mainContent.getChildren().setAll(activeSurface.mainContent() == null ? mainPlaceholder : activeSurface.mainContent());
                detailsContent.getChildren().setAll(
                        activeSurface.detailsContent() == null ? defaultDetailsContent : activeSurface.detailsContent());
                stateContent.getChildren().setAll(activeSurface.stateContent() == null ? statePlaceholder : activeSurface.stateContent());
                if (activeSurface.onShow() != null) {
                    activeSurface.onShow().run();
                }
            };

            Runnable hideActiveSurface = () -> {
                ComposeNavigationInput.SurfaceInput activeSurface = findSurface(surfaces, activeSurfaceId[0]);
                if (activeSurface != null && activeSurface.onHide() != null) {
                    activeSurface.onHide().run();
                }
            };

            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                ToggleButton button = new ToggleButton(surface.navigationLabel().isBlank() ? surface.surfaceId() : surface.navigationLabel());
                button.getStyleClass().add("nav-btn");
                button.setToggleGroup(toggleGroup);
                button.setFocusTraversable(false);
                if (surface.surfaceId().equals(activeSurfaceId[0])) {
                    button.setSelected(true);
                }
                button.setOnAction(event -> {
                    if (surface.surfaceId().equals(activeSurfaceId[0])) {
                        return;
                    }
                    hideActiveSurface.run();
                    activeSurfaceId[0] = surface.surfaceId();
                    showActiveSurface.run();
                });
                navigationContent.getChildren().add(button);
            }

            showActiveSurface.run();
            return new ComposeNavigationInput.NavigationInput(
                    toolbarContent,
                    navigationContent,
                    controlsContent,
                    mainContent,
                    detailsContent,
                    stateContent);
        }

        private static java.util.List<ComposeNavigationInput.SurfaceInput> normalizeSurfaces(
                java.util.List<ComposeNavigationInput.SurfaceInput> sourceSurfaces
        ) {
            java.util.ArrayList<ComposeNavigationInput.SurfaceInput> normalizedSurfaces = new java.util.ArrayList<>();
            for (ComposeNavigationInput.SurfaceInput surface : sourceSurfaces) {
                if (surface == null) {
                    continue;
                }
                String surfaceId = surface.surfaceId() == null ? "" : surface.surfaceId().trim();
                if (surfaceId.isEmpty()) {
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
            return java.util.List.copyOf(normalizedSurfaces);
        }

        private static String resolveInitialSurfaceId(
                java.util.List<ComposeNavigationInput.SurfaceInput> surfaces,
                String requestedSurfaceId
        ) {
            String initialSurfaceId = requestedSurfaceId == null ? "" : requestedSurfaceId.trim();
            if (initialSurfaceId.isEmpty() && !surfaces.isEmpty()) {
                return surfaces.getFirst().surfaceId();
            }
            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                if (surface.surfaceId().equals(initialSurfaceId)) {
                    return initialSurfaceId;
                }
            }
            return surfaces.isEmpty() ? "" : surfaces.getFirst().surfaceId();
        }

        private static ComposeNavigationInput.SurfaceInput findSurface(
                java.util.List<ComposeNavigationInput.SurfaceInput> surfaces,
                String surfaceId
        ) {
            for (ComposeNavigationInput.SurfaceInput surface : surfaces) {
                if (surface.surfaceId().equals(surfaceId)) {
                    return surface;
                }
            }
            return null;
        }

        private static VBox createPlaceholder(String text) {
            VBox placeholder = new VBox(new Label(text));
            placeholder.setPadding(new Insets(12));
            return placeholder;
        }

        private static Node createEmptyToolbarContent() {
            return new HBox();
        }
    }
}
