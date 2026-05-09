package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewDataShapingBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewDataShapingBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsStreamMappingPipeline() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.List;",
                        "final class FooView {",
                        "  void render(List<String> raw) {",
                        "    // BUG: Diagnostic contains: performs local data shaping",
                        "    raw.stream().map(String::trim).toList();",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsFxCollectionsSynthesis() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.List;",
                        "final class FooView {",
                        "  void render(List<String> raw) {",
                        "    // BUG: Diagnostic contains: performs local data shaping",
                        "    javafx.collections.FXCollections.observableArrayList(raw);",
                        "  }",
                        "}")
                .addSourceLines(
                        "javafx/collections/FXCollections.java",
                        "package javafx.collections;",
                        "import java.util.List;",
                        "public final class FXCollections {",
                        "  public static <T> List<T> observableArrayList(List<T> input) {",
                        "    return input;",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void allowsSimpleRenderMethodWithoutShaping() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void render(String text) {",
                        "    String shown = text;",
                        "    if (shown.isBlank()) {",
                        "      return;",
                        "    }",
                        "  }",
                        "}")
                .doTest();
    }
}
