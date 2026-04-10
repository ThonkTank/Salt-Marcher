package clean.shell.navigation;

import clean.shell.navigation.input.ComposeNavigationInput;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

/**
 * Clean shell navigation owner for active-surface switching.
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
            java.util.List<ComposeNavigationInput.SurfaceInput> surfaces = normalizeSurfaces(input.surfaces());
            String initialSurfaceId = resolveInitialSurfaceId(surfaces, input.initialSurfaceId());

            Label toolbarTitle = new Label();
            toolbarTitle.getStyleClass().add("large");
            StackPane toolbarItemsHost = new StackPane();
            Region toolbarSpacer = new Region();
            HBox.setHgrow(toolbarSpacer, Priority.ALWAYS);
            HBox toolbarContent = new HBox(8, toolbarTitle, toolbarSpacer, toolbarItemsHost);
            toolbarContent.setAlignment(Pos.CENTER_LEFT);
            HBox.setHgrow(toolbarItemsHost, Priority.NEVER);

            VBox navigationContent = new VBox(4);
            navigationContent.setAlignment(Pos.TOP_CENTER);

            StackPane controlsHost = new StackPane();
            StackPane mainHost = new StackPane();
            StackPane detailsHost = new StackPane();
            StackPane stateHost = new StackPane();

            VBox emptyControls = createPlaceholder("Keine lokalen Controls");
            VBox emptyMain = createPlaceholder("Kein lokaler Inhalt");
            VBox emptyDetails = createPlaceholder("Keine globalen Details aktiv");
            VBox emptyState = createPlaceholder("Keine globale Szene aktiv");
            Node defaultDetailsContent = input.defaultDetailsContent() == null
                    ? emptyDetails
                    : input.defaultDetailsContent();
            Node defaultStateContent = input.defaultStateContent() == null
                    ? emptyState
                    : input.defaultStateContent();

            ToggleGroup toggleGroup = new ToggleGroup();
            String[] activeSurfaceId = new String[]{initialSurfaceId};

            Runnable showActiveSurface = () -> {
                ComposeNavigationInput.SurfaceInput activeSurface = findSurface(surfaces, activeSurfaceId[0]);
                if (activeSurface == null) {
                    toolbarTitle.setText("Clean Shell");
                    toolbarItemsHost.getChildren().setAll(new HBox());
                    controlsHost.getChildren().setAll(emptyControls);
                    mainHost.getChildren().setAll(emptyMain);
                    detailsHost.getChildren().setAll(defaultDetailsContent);
                    stateHost.getChildren().setAll(defaultStateContent);
                    return;
                }
                toolbarTitle.setText(activeSurface.title());
                toolbarItemsHost.getChildren().setAll(
                        activeSurface.toolbarContent() == null ? new HBox() : activeSurface.toolbarContent());
                controlsHost.getChildren().setAll(
                        activeSurface.controlsContent() == null ? emptyControls : activeSurface.controlsContent());
                mainHost.getChildren().setAll(activeSurface.mainContent() == null ? emptyMain : activeSurface.mainContent());
                detailsHost.getChildren().setAll(
                        activeSurface.detailsContent() == null ? defaultDetailsContent : activeSurface.detailsContent());
                stateHost.getChildren().setAll(
                        activeSurface.stateContent() == null ? defaultStateContent : activeSurface.stateContent());
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
                String buttonLabel = surface.navigationIconText().isBlank()
                        ? surface.surfaceId()
                        : surface.navigationIconText();
                ToggleButton button = new ToggleButton(buttonLabel);
                button.getStyleClass().add("nav-btn");
                button.setToggleGroup(toggleGroup);
                button.setFocusTraversable(false);
                button.setTooltip(new Tooltip(surface.title()));
                button.setAccessibleText(surface.title());
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
                    controlsHost,
                    mainHost,
                    detailsHost,
                    stateHost
            );
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
                        surface.navigationIconText() == null ? "" : surface.navigationIconText().trim(),
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
    }
}
