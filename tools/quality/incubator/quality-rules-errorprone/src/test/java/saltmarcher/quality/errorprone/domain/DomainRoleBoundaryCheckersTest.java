package saltmarcher.quality.errorprone.domain;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainApplicationServiceRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainConstantsRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainHelperRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainModelRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainPortRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainRepositoryRoleBoundaryChecker;
import saltmarcher.quality.errorprone.DomainRootUseCaseCrossModelFamilyBoundaryChecker;
import saltmarcher.quality.errorprone.DomainUseCaseRoleBoundaryChecker;

@RunWith(JUnit4.class)
public final class DomainRoleBoundaryCheckersTest {

    @Test
    public void applicationServiceAllowsPublishedCommandAndUseCaseOnly() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.application.ApplySelectionUseCase;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "public final class FooSelectionApplicationService {",
                        "  private final ApplySelectionUseCase useCase;",
                        "  public FooSelectionApplicationService(ApplySelectionUseCase useCase) {",
                        "    this.useCase = useCase;",
                        "  }",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    useCase.apply();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "public final class ApplySelectionUseCase {",
                        "  public void apply() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsModelConcern() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.model.selection.model.SelectionState",
                        "public final class FooSelectionApplicationService {",
                        "  private final SelectionState state;",
                        "  public FooSelectionApplicationService(SelectionState state) {",
                        "    this.state = state;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState { }")
                .doTest();
    }

    @Test
    public void useCaseRejectsSameContextPublishedConcern() {
        CompilationTestHelper.newInstance(DomainUseCaseRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.published.SelectionModel;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.published.SelectionModel",
                        "final class ApplySelectionUseCase {",
                        "  private final SelectionModel model;",
                        "  ApplySelectionUseCase(SelectionModel model) {",
                        "    this.model = model;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/SelectionModel.java",
                        "package src.domain.foo.published;",
                        "public interface SelectionModel { }")
                .doTest();
    }

    @Test
    public void rootUseCaseRejectsSameContextRootUseCaseChain() {
        CompilationTestHelper.newInstance(DomainUseCaseRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.application.LoadSelectionUseCase;",
                        "// BUG: Diagnostic contains: references root UseCase chain src.domain.foo.application.LoadSelectionUseCase",
                        "final class ApplySelectionUseCase {",
                        "  private final LoadSelectionUseCase loadSelection;",
                        "  ApplySelectionUseCase(LoadSelectionUseCase loadSelection) {",
                        "    this.loadSelection = loadSelection;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/application/LoadSelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "public final class LoadSelectionUseCase { }")
                .doTest();
    }

    @Test
    public void rootUseCaseRejectsSameContextRootUseCaseNestedType() {
        CompilationTestHelper.newInstance(DomainUseCaseRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.application.LoadSelectionUseCase.SelectionData;",
                        "// BUG: Diagnostic contains: references root UseCase chain src.domain.foo.application.LoadSelectionUseCase.SelectionData",
                        "final class ApplySelectionUseCase {",
                        "  private final SelectionData data;",
                        "  ApplySelectionUseCase(SelectionData data) {",
                        "    this.data = data;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/application/LoadSelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "public final class LoadSelectionUseCase {",
                        "  public record SelectionData() { }",
                        "}")
                .doTest();
    }

    @Test
    public void rootUseCaseAllowsCrossModelFamilyOrchestration() {
        CompilationTestHelper.newInstance(DomainRootUseCaseCrossModelFamilyBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplyWorkspaceUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.model.grid.model.GridState;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "final class ApplyWorkspaceUseCase {",
                        "  private final GridState grid;",
                        "  private final SelectionState selection;",
                        "  ApplyWorkspaceUseCase(GridState grid, SelectionState selection) {",
                        "    this.grid = grid;",
                        "    this.selection = selection;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridState.java",
                        "package src.domain.foo.model.grid.model;",
                        "public final class GridState { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState { }")
                .doTest();
    }

    @Test
    public void rootUseCaseRejectsSingleModelFamilyPlacement() {
        CompilationTestHelper.newInstance(DomainRootUseCaseCrossModelFamilyBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "// BUG: Diagnostic contains: must orchestrate at least two same-context model families",
                        "final class ApplySelectionUseCase {",
                        "  private final SelectionState selection;",
                        "  ApplySelectionUseCase(SelectionState selection) {",
                        "    this.selection = selection;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState { }")
                .doTest();
    }

    @Test
    public void modelRejectsHelperConcernAndExecutableProtocol() {
        CompilationTestHelper.newInstance(DomainModelRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "import java.util.function.Function;",
                        "import src.domain.foo.model.grid.helper.GridMathHelper;",
                        "// BUG: Diagnostic contains: references executable protocol type java.util.function.Function; references forbidden domain concern src.domain.foo.model.grid.helper.GridMathHelper",
                        "final class GridCoordinate {",
                        "  private final GridMathHelper helper;",
                        "  private final Function<Integer, Integer> fn;",
                        "  GridCoordinate(GridMathHelper helper, Function<Integer, Integer> fn) {",
                        "    this.helper = helper;",
                        "    this.fn = fn;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/helper/GridMathHelper.java",
                        "package src.domain.foo.model.grid.helper;",
                        "public final class GridMathHelper { }")
                .doTest();
    }

    @Test
    public void modelRejectsNonFinalShape() {
        CompilationTestHelper.newInstance(DomainModelRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "// BUG: Diagnostic contains: uses non-final Model class shape",
                        "class GridCoordinate { }")
                .doTest();
    }

    @Test
    public void helperRejectsRepositoryConcern() {
        CompilationTestHelper.newInstance(DomainHelperRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/helper/GridMathHelper.java",
                        "package src.domain.foo.model.grid.helper;",
                        "import src.domain.foo.model.grid.repository.GridRepository;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.model.grid.repository.GridRepository",
                        "final class GridMathHelper {",
                        "  private final GridRepository repository;",
                        "  GridMathHelper(GridRepository repository) {",
                        "    this.repository = repository;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public final class GridRepository { }")
                .doTest();
    }

    @Test
    public void constantsRejectMutableInstanceState() {
        CompilationTestHelper.newInstance(DomainConstantsRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "// BUG: Diagnostic contains: exposes non-private Constants constructor; owns non-static or mutable Constants field size; exposes instance Constants method size()",
                        "final class GridConstants {",
                        "  private final int size = 1;",
                        "  int size() {",
                        "    return size;",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void portRejectsRepositoryConcern() {
        CompilationTestHelper.newInstance(DomainPortRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "import src.domain.foo.model.grid.repository.GridRepository;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.model.grid.repository.GridRepository",
                        "interface GridPort {",
                        "  GridRepository repository();",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public final class GridRepository { }")
                .doTest();
    }

    @Test
    public void repositoryRejectsPublishedConcern() {
        CompilationTestHelper.newInstance(DomainRepositoryRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "import src.domain.foo.published.GridModel;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.published.GridModel",
                        "final class GridRepository {",
                        "  private final GridModel model;",
                        "  GridRepository(GridModel model) {",
                        "    this.model = model;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/GridModel.java",
                        "package src.domain.foo.published;",
                        "public interface GridModel { }")
                .doTest();
    }
}
