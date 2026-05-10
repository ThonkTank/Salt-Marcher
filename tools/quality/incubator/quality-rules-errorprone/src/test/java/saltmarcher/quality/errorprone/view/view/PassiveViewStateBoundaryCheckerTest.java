package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewStateBoundaryCheckerTest {

    @Test
    public void rejectsMutableCollectionState() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.List;",
                        "final class CatalogControlsView {",
                        "  // BUG: Diagnostic matches: local-state",
                        "  private List<Long> selectedEncounterTableIds = List.of();",
                        "}")
                .expectErrorMessage("local-state", containsAll(
                        "local state selectedEncounterTableIds:List<Long>",
                        "violates the passive-View state boundary"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsStreamMappingPipeline() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.List;",
                        "final class FooView {",
                        "  void render(List<String> raw) {",
                        "    // BUG: Diagnostic matches: shaping",
                        "    raw.stream().map(String::trim).toList();",
                        "  }",
                        "}")
                .expectErrorMessage("shaping", containsAll(
                        "data shaping java.util.stream.Stream.map()",
                        "violates the passive-View state boundary"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsTechnicalWidgetField() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import javafx.scene.control.Label;",
                        "final class FooView {",
                        "  private final Label title = new Label();",
                        "}")
                .addSourceLines(
                        "javafx/scene/control/Label.java",
                        "package javafx.scene.control;",
                        "public class Label { }")
                .doTest();
    }

    @Test
    public void allowsSameStemSeamOnly() {
        newHelper()
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
    public void rejectsModelDerivedSwitchDecision() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import javafx.scene.control.Label;",
                        "final class CatalogControlsView {",
                        "  private final Label title = new Label();",
                        "  void render(CatalogContributionModel model) {",
                        "    // BUG: Diagnostic matches: switch-decision",
                        "    switch (model.mode()) {",
                        "      case \"compact\":",
                        "        title.setVisible(false);",
                        "        break;",
                        "      default:",
                        "        title.setVisible(true);",
                        "    }",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  String mode() {",
                        "    return \"compact\";",
                        "  }",
                        "}")
                .addSourceLines(
                        "javafx/scene/control/Label.java",
                        "package javafx.scene.control;",
                        "public class Label {",
                        "  public void setVisible(boolean value) { }",
                        "}")
                .expectErrorMessage("switch-decision", containsAll(
                        "presentation decision switch",
                        "model-derived presentation decisions belong outside the View"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsModelDerivedSwitchExpressionDecision() {
        newHelper()
                .withClasspath(javafx.scene.control.RuntimeLabel.class)
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import javafx.scene.control.RuntimeLabel;",
                        "final class CatalogControlsView {",
                        "  private final RuntimeLabel title = new RuntimeLabel();",
                        "  boolean render(CatalogContributionModel model) {",
                        "    // BUG: Diagnostic matches: switch-expression-decision",
                        "    return switch (model.mode()) {",
                        "      case \"compact\" -> {",
                        "        title.setVisible(false);",
                        "        yield true;",
                        "      }",
                        "      default -> {",
                        "        title.setVisible(true);",
                        "        yield false;",
                        "      }",
                        "    };",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  String mode() {",
                        "    return \"compact\";",
                        "  }",
                        "}")
                .expectErrorMessage("switch-expression-decision", containsAll(
                        "presentation decision switch expression",
                        "model-derived presentation decisions belong outside the View"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsModelDerivedPresentationDecision() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import javafx.scene.control.Label;",
                        "final class CatalogControlsView {",
                        "  private final Label title = new Label();",
                        "  void render(CatalogContributionModel model) {",
                        "    // BUG: Diagnostic matches: presentation-decision",
                        "    if (model.shouldShowTitle()) {",
                        "      title.setVisible(true);",
                        "    }",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  boolean shouldShowTitle() {",
                        "    return true;",
                        "  }",
                        "}")
                .addSourceLines(
                        "javafx/scene/control/Label.java",
                        "package javafx.scene.control;",
                        "public class Label {",
                        "  public void setVisible(boolean value) { }",
                        "}")
                .expectErrorMessage("presentation-decision", containsAll(
                        "presentation decision if-branch",
                        "model-derived presentation decisions belong outside the View"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresStateViolationsWhenCheckIsDisabled() {
        newHelper()
                .setArgs("-Xep:PassiveViewStateBoundary:OFF")
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.List;",
                        "final class CatalogControlsView {",
                        "  private List<Long> selectedEncounterTableIds = List.of();",
                        "}")
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsidePassiveViewScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.List;",
                        "final class CatalogContributionModel {",
                        "  private List<Long> selectedEncounterTableIds = List.of();",
                        "}")
                .doTest();
    }

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(PassiveViewStateBoundaryChecker.class, getClass())
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
