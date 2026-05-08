package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class TechnicalPrimitiveViewBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            TechnicalPrimitiveViewBoundaryChecker.class,
            getClass());

    @Test
    public void allowsSameUnitTechnicalSupportCarriers() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  private Consumer<FooPointerEvent> pointerHandler = event -> { };",
                        "  private FooScene scene = new FooScene(\"ready\");",
                        "  void onPointer(Consumer<FooPointerEvent> handler) {",
                        "    pointerHandler = handler;",
                        "  }",
                        "  FooScene scene() {",
                        "    return scene;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooPointerEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooPointerEvent(String raw) { }")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooScene.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooScene(String state) { }")
                .doTest();
    }

    @Test
    public void rejectsViewInputEventProtocolOnPrimitiveBoundary() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: FooViewInputEvent",
                        "  void onViewInputEvent(Consumer<FooViewInputEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .doTest();
    }

    @Test
    public void rejectsForeignPrimitiveSupportCarrier() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: src.view.slotcontent.primitives.bar.BarScene",
                        "  private src.view.slotcontent.primitives.bar.BarScene scene;",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/bar/BarScene.java",
                        "package src.view.slotcontent.primitives.bar;",
                        "public record BarScene(String raw) { }")
                .doTest();
    }

    @Test
    public void rejectsProjectionModelFieldOnPrimitiveBoundary() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: FooContentModel",
                        "  private FooContentModel model;",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooContentModel.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooContentModel { }")
                .doTest();
    }

    @Test
    public void rejectsGenericJdkCallbackProtocolWithoutTechnicalCarrierRoot() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: java.util.function.Consumer<java.lang.String>",
                        "  void onPointer(Consumer<String> handler) { }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsApplicationServiceBoundaryTypeOnPrimitiveBoundary() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  // BUG: Diagnostic contains: src.domain.foo.FooApplicationService",
                        "  private src.domain.foo.FooApplicationService applicationService;",
                        "}")
                .addSourceLines(
                        "src/domain/foo/FooApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooApplicationService { }")
                .doTest();
    }
}
