package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewLocalStateBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewLocalStateBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsMutableCollectionState() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.List;",
                        "final class CatalogControlsView {",
                        "  // BUG: Diagnostic contains: owns local semantic state",
                        "  private List<Long> selectedEncounterTableIds = List.of();",
                        "}")
                .doTest();
    }

    @Test
    public void allowsSameStemSeamOnly() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = event -> { };",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String raw) { }")
                .doTest();
    }

    @Test
    public void rejectsScalarSemanticState() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/mapcanvas/MapCanvasView.java",
                        "package src.view.slotcontent.primitives.mapcanvas;",
                        "final class MapCanvasView {",
                        "  // BUG: Diagnostic contains: owns local semantic state or extra project acquaintances",
                        "  private double zoom = 1.0;",
                        "}")
                .doTest();
    }
}
