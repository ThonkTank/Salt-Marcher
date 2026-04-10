package clean.placeholder;

import clean.placeholder.input.ComposePlaceholderInput;
import clean.shell.input.ComposeShellInput;
import javafx.scene.control.Label;
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
            String navigationIconText = normalizeText(input.navigationIconText());
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

            VBox controlsContent = new VBox(
                    8,
                    createSectionLabel("Controls"),
                    createBodyLabel(controlsLineOne.isBlank() ? "Kein lokaler Controls-Eintrag" : controlsLineOne),
                    createOptionalBodyLabel(controlsLineTwo),
                    createOptionalBodyLabel(controlsLineThree)
            );
            controlsContent.setFillWidth(true);

            Label mainTitle = new Label(title);
            mainTitle.getStyleClass().add("title");
            Label mainSummary = createBodyLabel(summary);
            Label mainSurfaceId = createMutedLabel("Surface-ID: " + surfaceId);
            VBox mainContent = new VBox(12, mainTitle, mainSummary, mainSurfaceId);
            mainContent.setFillWidth(true);
            mainContent.setPadding(new javafx.geometry.Insets(12));

            return new ComposeShellInput.SurfaceInput(
                    surfaceId,
                    title,
                    navigationIconText,
                    null,
                    controlsContent,
                    mainContent,
                    createOptionalCard("Details", detailsLineOne, detailsLineTwo, detailsLineThree),
                    createOptionalCard("Status", stateLineOne, stateLineTwo, stateLineThree),
                    null,
                    null
            );
        }

        private static VBox createOptionalCard(String sectionTitle, String lineOne, String lineTwo, String lineThree) {
            if (lineOne.isBlank() && lineTwo.isBlank() && lineThree.isBlank()) {
                return null;
            }
            VBox card = new VBox(
                    8,
                    createSectionLabel(sectionTitle),
                    createBodyLabel(lineOne),
                    createOptionalBodyLabel(lineTwo),
                    createOptionalBodyLabel(lineThree)
            );
            card.setFillWidth(true);
            card.setPadding(new javafx.geometry.Insets(12));
            return card;
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().addAll("section-header", "text-muted");
            return label;
        }

        private static Label createBodyLabel(String text) {
            Label label = new Label(text);
            label.setWrapText(true);
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = createBodyLabel(text);
            label.getStyleClass().add("text-muted");
            return label;
        }

        private static Label createOptionalBodyLabel(String text) {
            Label label = createBodyLabel(text);
            label.setManaged(!text.isBlank());
            label.setVisible(!text.isBlank());
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
