package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewInteractionBoundaryCheckerTest {

    @Test
    public void rejectsSamePackageHelperCall() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void render() {",
                        "    // BUG: Diagnostic matches: helper-call",
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
                .expectErrorMessage("helper-call", containsAll(
                        "project member src.view.slotcontent.primitives.foo.FooViewHelper.renderText()",
                        "crosses the passive-View interaction boundary"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsProjectionCarrierConstruction() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogControlsView {",
                        "  void rebuild(String rawText) {",
                        "    // BUG: Diagnostic matches: projection-construction",
                        "    new CatalogContributionModel.CreatureFilters(rawText);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  record CreatureFilters(String rawText) { }",
                        "}")
                .expectErrorMessage("projection-construction", containsAll(
                        "constructs src.view.leftbartabs.catalog.CatalogContributionModel",
                        "Passive View 'src.view.leftbartabs.catalog.CatalogControlsView'"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsShellApiCall() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import shell.frame.ToolbarBridge;",
                        "final class FooView {",
                        "  void render(ToolbarBridge bridge) {",
                        "    // BUG: Diagnostic matches: shell-member",
                        "    bridge.publish();",
                        "  }",
                        "}")
                .addSourceLines(
                        "shell/frame/ToolbarBridge.java",
                        "package shell.frame;",
                        "public final class ToolbarBridge {",
                        "  public void publish() { }",
                        "}")
                .expectErrorMessage("shell-member", containsAll(
                        "project member shell.frame.ToolbarBridge.publish()",
                        "crosses the passive-View interaction boundary"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsSameStemViewInputEventConstruction() {
        newHelper()
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

    @Test
    public void rejectsStaticFactoryOnProjectionModelOwner() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogControlsView {",
                        "  void rebuild(String rawText) {",
                        "    // BUG: Diagnostic matches: static-factory",
                        "    CatalogContributionModel.from(rawText);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  static CatalogContributionModel from(String rawText) {",
                        "    return new CatalogContributionModel();",
                        "  }",
                        "}")
                .expectErrorMessage("static-factory", containsAll(
                        "projection/write factory src.view.leftbartabs.catalog.CatalogContributionModel.from()",
                        "Passive View 'src.view.leftbartabs.catalog.CatalogControlsView'"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresInteractionViolationsWhenCheckIsDisabled() {
        newHelper()
                .setArgs("-Xep:PassiveViewInteractionBoundary:OFF")
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void render() {",
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
    public void ignoresSameShapeOutsidePassiveViewScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooBinder.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooBinder {",
                        "  void render() {",
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

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(PassiveViewInteractionBoundaryChecker.class, getClass())
                .matchAllDiagnostics();
    }

    private static Predicate<String> containsAll(String... snippets) {
        return message -> {
            for (String snippet : snippets) {
                if (!message.contains(snippet)) {
                    return false;
                }
            }
            return true;
        };
    }
}
