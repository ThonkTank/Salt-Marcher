package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewCallbackSeamBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            PassiveViewCallbackSeamBoundaryChecker.class,
            getClass());

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
    public void rejectsBiConsumerPreparedStateAccessor() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.BiConsumer;",
                        " // BUG: Diagnostic contains: illegal callback, result, or imperative render seams",
                        "final class FooView {",
                        "  BiConsumer<String, Integer> titleSink() {",
                        "    return (text, count) -> { };",
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
                        " // BUG: Diagnostic contains: illegal callback, result, or imperative render seams",
                        "final class FooView {",
                        "  void showText(String text) { }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsProjectTypedPreparedStateAccessor() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        " // BUG: Diagnostic contains: illegal callback, result, or imperative render seams",
                        "final class FooView {",
                        "  Consumer<FooContentModel> stateSink() {",
                        "    return ignored -> { };",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooContentModel.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooContentModel { }")
                .doTest();
    }
}
