package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewProjectionConstructionBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewProjectionConstructionBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsProjectionCarrierConstruction() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogControlsView {",
                        "  void rebuild(String rawText) {",
                        "    // BUG: Diagnostic contains: constructs projection or write carriers",
                        "    new CatalogContributionModel.CreatureFilters(rawText);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  record CreatureFilters(String rawText) { }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsProjectionCarrierStaticFactory() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogControlsView {",
                        "  void rebuild() {",
                        "    // BUG: Diagnostic contains: constructs projection or write carriers",
                        "    CatalogContributionModel.FilterDropdownState.hidden();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  record FilterDropdownState(boolean visible) {",
                        "    static FilterDropdownState hidden() {",
                        "      return new FilterDropdownState(false);",
                        "    }",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void allowsSameStemViewInputEventConstruction() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish(String rawText) {",
                        "    handler.accept(new CatalogControlsViewInputEvent(rawText));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String rawText) { }")
                .doTest();
    }
}
