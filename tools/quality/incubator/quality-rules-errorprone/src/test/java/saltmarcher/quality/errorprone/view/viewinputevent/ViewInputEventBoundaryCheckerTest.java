package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewInputEventBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            ViewInputEventBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsJavafxCarrierPayload() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic contains: Violations:",
                        "record FooViewInputEvent(javafx.scene.input.MouseEvent event) { }")
                .addSourceLines(
                        "javafx/scene/input/MouseEvent.java",
                        "package javafx.scene.input;",
                        "public final class MouseEvent { }")
                .doTest();
    }

    @Test
    public void allowsJdkOnlyCarrierPayload() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String text, int level, boolean open) { }")
                .doTest();
    }
}
