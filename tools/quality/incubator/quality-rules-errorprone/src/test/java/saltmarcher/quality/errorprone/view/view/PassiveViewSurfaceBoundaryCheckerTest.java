package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewSurfaceBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewSurfaceBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsProjectViewInheritance() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooControlsView.java",
                        "package src.view.leftbartabs.foo;",
                        "import src.view.slotcontent.primitives.bar.BarView;",
                        "// BUG: Diagnostic contains: violates the passive-View surface boundary",
                        "final class FooControlsView extends BarView { }")
                .addSourceLines(
                        "src/view/slotcontent/primitives/bar/BarView.java",
                        "package src.view.slotcontent.primitives.bar;",
                        "public class BarView { }")
                .doTest();
    }

    @Test
    public void rejectsConstructorInjectedCallbackProtocol() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "// BUG: Diagnostic contains: violates the passive-View surface boundary",
                        "final class FooView {",
                        "  FooView(Consumer<FooViewInputEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .doTest();
    }

    @Test
    public void allowsProjectFreePreparedStateSinkAccessor() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  Consumer<String> titleSink() {",
                        "    return text -> { };",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsImperativeRenderMethod() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic contains: violates the passive-View surface boundary",
                        "final class FooView {",
                        "  void showText(String text) { }",
                        "}")
                .doTest();
    }
}
