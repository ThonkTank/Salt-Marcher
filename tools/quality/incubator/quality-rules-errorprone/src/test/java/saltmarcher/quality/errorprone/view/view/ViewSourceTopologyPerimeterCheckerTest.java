package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewSourceTopologyPerimeterCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            ViewSourceTopologyPerimeterChecker.class,
            getClass());

    @Test
    public void allowsCanonicalReusableSlotcontentUnit() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooView.java",
                        "package src.view.slotcontent.state.foo;",
                        "final class FooView { }")
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.state.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooContentModel.java",
                        "package src.view.slotcontent.state.foo;",
                        "final class FooContentModel { }")
                .doTest();
    }

    @Test
    public void rejectsIllegalSlotcontentBucket() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/widgets/foo/FooView.java",
                        "package src.view.slotcontent.widgets.foo;",
                        "// BUG: Diagnostic contains: must live only under src.view.leftbartabs.<entry>, src.view.statetabs.<entry>, src.view.dropdowns.<entry>, or src.view.slotcontent.<controls|main|state|details|topbar|primitives>.<entry>",
                        "final class FooView { }")
                .doTest();
    }

    @Test
    public void rejectsForeignSlotcontentRoleFile() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooScene.java",
                        "package src.view.slotcontent.state.foo;",
                        "// BUG: Diagnostic contains: is not an allowed top-level role",
                        "final class FooScene { }")
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooView.java",
                        "package src.view.slotcontent.state.foo;",
                        "final class FooView { }")
                .doTest();
    }

    @Test
    public void rejectsTopLevelTypeAndFileNameMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/view/slotcontent/state/foo/FooHelper.java",
                        "package src.view.slotcontent.state.foo;",
                        "// BUG: Diagnostic contains: file name 'FooHelper.java' must match top-level view-layer type 'FooView.java'",
                        "final class FooView { }")
                .doTest();
    }
}
