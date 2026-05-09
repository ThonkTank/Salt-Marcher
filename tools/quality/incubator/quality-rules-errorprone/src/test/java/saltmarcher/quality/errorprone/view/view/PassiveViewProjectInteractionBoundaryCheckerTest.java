package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewProjectInteractionBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewProjectInteractionBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsSamePackageHelperCall() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void render() {",
                        "    // BUG: Diagnostic contains: invokes or reads project members",
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
}
