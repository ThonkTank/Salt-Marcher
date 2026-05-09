package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewInteractionBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewInteractionBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsSamePackageHelperCall() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void render() {",
                        "    // BUG: Diagnostic contains: crosses the passive-View interaction boundary",
                        "    FooViewHelper.renderText();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewHelper.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooViewHelper {",
                        "  static String renderText() {",
                        "    return \"x\";",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsProjectionCarrierConstruction() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogControlsView {",
                        "  void rebuild(String rawText) {",
                        "    // BUG: Diagnostic contains: crosses the passive-View interaction boundary",
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
