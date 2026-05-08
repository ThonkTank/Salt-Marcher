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
    public void allowsTechnicalPrimitiveConsumerOfSameUnitCarrier() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  void onPointer(Consumer<FooPointerEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooPointerEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooPointerEvent(String raw) { }")
                .doTest();
    }

    @Test
    public void rejectsGenericPrimitiveCallbackFamilyWithoutTechnicalCarrierRoot() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: non-technical callback or result seams",
                        "  void onPointer(Consumer<String> handler) { }",
                        "}")
                .doTest();
    }
}
