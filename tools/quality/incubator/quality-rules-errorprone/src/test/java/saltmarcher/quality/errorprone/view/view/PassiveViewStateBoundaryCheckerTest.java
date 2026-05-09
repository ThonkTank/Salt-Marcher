package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewStateBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewStateBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsMutableCollectionState() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.List;",
                        "final class CatalogControlsView {",
                        "  // BUG: Diagnostic contains: violates the passive-View state boundary",
                        "  private List<Long> selectedEncounterTableIds = List.of();",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsStreamMappingPipeline() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.List;",
                        "final class FooView {",
                        "  void render(List<String> raw) {",
                        "    // BUG: Diagnostic contains: violates the passive-View state boundary",
                        "    raw.stream().map(String::trim).toList();",
                        "  }",
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
}
