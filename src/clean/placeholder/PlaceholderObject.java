package clean.placeholder;

import clean.placeholder.input.ComposePlaceholderInput;
import clean.shell.input.ComposeShellInput;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

/**
 * Placeholder surface owner for phase-1 clean capability targets.
 */
@SuppressWarnings("unused")
public final class PlaceholderObject {

    private final ComposeShellInput.SurfaceInput placeholder;

    public PlaceholderObject(ComposePlaceholderInput input) {
        ComposePlaceholderInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.placeholder = new PlaceholderAssembly(resolvedInput).composePlaceholder();
    }

    public ComposeShellInput.SurfaceInput composePlaceholder(ComposePlaceholderInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return placeholder;
    }

    private static final class PlaceholderAssembly {

        private final ComposePlaceholderInput input;

        private PlaceholderAssembly(ComposePlaceholderInput input) {
            this.input = input;
        }

        private ComposeShellInput.SurfaceInput composePlaceholder() {
            String surfaceId = normalizeText(input.surfaceId());
            String title = normalizeText(input.title());
            String navigationLabel = normalizeText(input.navigationLabel());
            String summary = normalizeText(input.summary());
            String controlsLineOne = normalizeText(input.controlsLineOne());
            String controlsLineTwo = normalizeText(input.controlsLineTwo());
            String controlsLineThree = normalizeText(input.controlsLineThree());
            String detailsLineOne = normalizeText(input.detailsLineOne());
            String detailsLineTwo = normalizeText(input.detailsLineTwo());
            String detailsLineThree = normalizeText(input.detailsLineThree());
            String stateLineOne = normalizeText(input.stateLineOne());
            String stateLineTwo = normalizeText(input.stateLineTwo());
            String stateLineThree = normalizeText(input.stateLineThree());

            Label badgeLabel = new Label("Demo");
            badgeLabel.getStyleClass().add("toolbar-badge");
            HBox toolbarContent = new HBox(badgeLabel);

            VBox controlsContent = new VBox(
                    8,
                    createBulletLabel(controlsLineOne.isBlank() ? "Kein lokaler Controls-Eintrag" : controlsLineOne),
                    createOptionalBulletLabel(controlsLineTwo),
                    createOptionalBulletLabel(controlsLineThree)
            );
            controlsContent.getStyleClass().add("list-card");

            Label heroEyebrow = new Label("Clean");
            heroEyebrow.getStyleClass().add("eyebrow-label");
            Label heroTitle = new Label(title);
            heroTitle.getStyleClass().add("hero-title");
            Label heroSummary = new Label(summary);
            heroSummary.getStyleClass().add("hero-summary");
            heroSummary.setWrapText(true);
            Label heroFooter = new Label("Surface-ID: " + surfaceId);
            heroFooter.getStyleClass().add("hero-footer");
            VBox mainContent = new VBox(12, heroEyebrow, heroTitle, heroSummary, heroFooter);
            mainContent.getStyleClass().add("hero-card");

            return new ComposeShellInput.SurfaceInput(
                    surfaceId,
                    title,
                    navigationLabel,
                    toolbarContent,
                    controlsContent,
                    mainContent,
                    createOptionalCard(detailsLineOne, detailsLineTwo, detailsLineThree),
                    createOptionalCard(stateLineOne, stateLineTwo, stateLineThree),
                    null,
                    null
            );
        }

        private static VBox createOptionalCard(String lineOne, String lineTwo, String lineThree) {
            if (lineOne.isBlank() && lineTwo.isBlank() && lineThree.isBlank()) {
                return null;
            }
            VBox card = new VBox(
                    8,
                    createBulletLabel(lineOne),
                    createOptionalBulletLabel(lineTwo),
                    createOptionalBulletLabel(lineThree)
            );
            card.getStyleClass().add("list-card");
            return card;
        }

        private static Label createBulletLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("bullet-text");
            return label;
        }

        private static Label createOptionalBulletLabel(String text) {
            Label label = createBulletLabel(text);
            label.setManaged(!text.isBlank());
            label.setVisible(!text.isBlank());
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
