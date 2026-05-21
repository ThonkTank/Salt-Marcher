package saltmarcher.quality.errorprone.domain;

import com.google.errorprone.CompilationTestHelper;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainApplicationServiceApiShapeChecker;
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
    public void applicationServiceApiRejectsGenericPublishedCommandRootParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceApiShapeChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "public final class FooSelectionApplicationService {",
                        "  // BUG: Diagnostic contains: accept one same-feature published carrier whose simple name ends with Command",
                        "  public void apply(List<ApplySelectionCommand> commands) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandField() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: field lastCommand",
                        "public final class FooSelectionApplicationService {",
                        "  private ApplySelectionCommand lastCommand;",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsGenericPublishedCommandField() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: field lastCommands",
                        "public final class FooSelectionApplicationService {",
                        "  private List<ApplySelectionCommand> lastCommands;",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: constructor parameter command",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(ApplySelectionCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsGenericPublishedCommandConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: constructor parameter commands",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(List<ApplySelectionCommand> commands) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceAllowsPrivateStaticBoundaryAdapterParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    String input = toUseCaseInput(command);",
                        "  }",
                        "  private static String toUseCaseInput(ApplySelectionCommand command) {",
                        "    return command == null ? \"\" : command.value();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand(String value) { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsBoundaryAdapterReturningPublishedCommand() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method return type toCommand",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    Object input = toCommand(command);",
                        "  }",
                        "  private static ApplySelectionCommand toCommand(ApplySelectionCommand command) {",
                        "    return command;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand(String value) { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsBoundaryAdapterLocalPublishedCommandCache() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: local variable cached",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    String input = toUseCaseInput(command);",
                        "  }",
                        "  private static String toUseCaseInput(ApplySelectionCommand command) {",
                        "    ApplySelectionCommand cached = command;",
                        "    return cached.value();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand(String value) { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsGenericBoundaryAdapterParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method parameter toUseCaseInput.commands",
                        "public final class FooSelectionApplicationService {",
                        "  private static String toUseCaseInput(List<ApplySelectionCommand> commands) {",
                        "    return commands.isEmpty() ? \"\" : commands.get(0).value();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand(String value) { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsNonCommandBoundaryAdapterParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.SelectionStatus;",
                        "// BUG: Diagnostic contains: method parameter toUseCaseInput.status",
                        "public final class FooSelectionApplicationService {",
                        "  private static String toUseCaseInput(SelectionStatus status) {",
                        "    return status.value();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/SelectionStatus.java",
                        "package src.domain.foo.published;",
                        "public record SelectionStatus(String value) { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandPrivateMethodParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method parameter interpret.command",
                        "public final class FooSelectionApplicationService {",
                        "  private void interpret(ApplySelectionCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsGenericPublishedCommandPrivateMethodParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method parameter interpret.commands",
                        "public final class FooSelectionApplicationService {",
                        "  private void interpret(List<ApplySelectionCommand> commands) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandReturnType() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method return type cached",
                        "public final class FooSelectionApplicationService {",
                        "  private ApplySelectionCommand cached() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsGenericPublishedCommandReturnType() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import java.util.List;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: method return type cached",
                        "public final class FooSelectionApplicationService {",
                        "  private List<ApplySelectionCommand> cached() {",
                        "    return java.util.List.of();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandTypeVariableBound() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: type parameter bound",
                        "public final class FooSelectionApplicationService<T extends ApplySelectionCommand> {",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public interface ApplySelectionCommand { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandLocalCache() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: local variable cached",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    ApplySelectionCommand cached = command;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandSupertypeUse() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: type use IDENTIFIER",
                        "public final class FooSelectionApplicationService implements CommandSink<ApplySelectionCommand> {",
                        "}",
                        "interface CommandSink<T> { }")
                .addSourceLines(
                        "src/domain/foo/published/ApplySelectionCommand.java",
                        "package src.domain.foo.published;",
                        "public record ApplySelectionCommand() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsPublishedCommandClassLiteral() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.published.ApplySelectionCommand;",
                        "// BUG: Diagnostic contains: type use MEMBER_SELECT",
                        "public final class FooSelectionApplicationService {",
                        "  public void apply(ApplySelectionCommand command) {",
                        "    Class<?> type = ApplySelectionCommand.class;",
                        "  }",
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
    public void applicationServiceRejectsForeignApplicationServiceConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.bar.BarSelectionApplicationService;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.bar.BarSelectionApplicationService",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(BarSelectionApplicationService service) { }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/BarSelectionApplicationService.java",
                        "package src.domain.bar;",
                        "public final class BarSelectionApplicationService { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsSameContextPortConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "import src.domain.foo.model.grid.port.GridPort;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.model.grid.port.GridPort",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(GridPort port) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "public interface GridPort { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsSameContextRepositoryConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.model.grid.repository.GridRepository",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(",
                        "      src.domain.foo.model.grid.repository.GridRepository repository) { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public interface GridRepository { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsForeignPublishedConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.bar.published.BarSnapshot",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(",
                        "      src.domain.bar.published.BarSnapshot snapshot) { }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot() { }")
                .doTest();
    }

    @Test
    public void applicationServiceRejectsOuterLayerConstructorParameter() {
        CompilationTestHelper.newInstance(DomainApplicationServiceRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: references outer-layer type src.view.foo.SelectionView",
                        "public final class FooSelectionApplicationService {",
                        "  public FooSelectionApplicationService(src.view.foo.SelectionView view) { }",
                        "}")
                .addSourceLines(
                        "src/view/foo/SelectionView.java",
                        "package src.view.foo;",
                        "public final class SelectionView { }")
                .doTest();
    }

    @Test
    public void useCaseAllowsCollaboratorMatrix() {
        CompilationTestHelper.newInstance(DomainUseCaseRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplyWorkspaceUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.bar.BarApplicationService;",
                        "import src.domain.foo.model.selection.constants.SelectionConstants;",
                        "import src.domain.foo.model.selection.helper.SelectionHelper;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "import src.domain.foo.model.selection.port.SelectionPort;",
                        "import src.domain.foo.model.selection.repository.SelectionRepository;",
                        "import src.domain.foo.model.selection.usecase.ApplySelectionUseCase;",
                        "final class ApplyWorkspaceUseCase {",
                        "  private final ApplySelectionUseCase selectionUseCase;",
                        "  private final SelectionState selectionState;",
                        "  private final SelectionHelper selectionHelper;",
                        "  private final SelectionConstants selectionConstants;",
                        "  private final SelectionPort selectionPort;",
                        "  private final SelectionRepository selectionRepository;",
                        "  private final BarApplicationService barApplicationService;",
                        "  ApplyWorkspaceUseCase(",
                        "      ApplySelectionUseCase selectionUseCase,",
                        "      SelectionState selectionState,",
                        "      SelectionHelper selectionHelper,",
                        "      SelectionConstants selectionConstants,",
                        "      SelectionPort selectionPort,",
                        "      SelectionRepository selectionRepository,",
                        "      BarApplicationService barApplicationService) {",
                        "    this.selectionUseCase = selectionUseCase;",
                        "    this.selectionState = selectionState;",
                        "    this.selectionHelper = selectionHelper;",
                        "    this.selectionConstants = selectionConstants;",
                        "    this.selectionPort = selectionPort;",
                        "    this.selectionRepository = selectionRepository;",
                        "    this.barApplicationService = barApplicationService;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/usecase/ApplySelectionUseCase.java",
                        "package src.domain.foo.model.selection.usecase;",
                        "public final class ApplySelectionUseCase { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/helper/SelectionHelper.java",
                        "package src.domain.foo.model.selection.helper;",
                        "public final class SelectionHelper { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/constants/SelectionConstants.java",
                        "package src.domain.foo.model.selection.constants;",
                        "public final class SelectionConstants { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/port/SelectionPort.java",
                        "package src.domain.foo.model.selection.port;",
                        "public interface SelectionPort { }")
                .addSourceLines(
                        "src/domain/foo/model/selection/repository/SelectionRepository.java",
                        "package src.domain.foo.model.selection.repository;",
                        "public interface SelectionRepository { }")
                .addSourceLines(
                        "src/domain/bar/BarApplicationService.java",
                        "package src.domain.bar;",
                        "public final class BarApplicationService { }")
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
    public void useCaseRejectsForbiddenCollaboratorMatrix() {
        CompilationTestHelper.newInstance(DomainUseCaseRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import java.util.function.Function;",
                        "import src.domain.bar.published.BarSnapshot;",
                        "import src.domain.foo.application.LoadSelectionUseCase;",
                        "import src.domain.foo.published.SelectionModel;",
                        "import src.view.foo.SelectionView;",
                        "// BUG: Diagnostic matches: forbidden-collaborator-matrix",
                        "final class ApplySelectionUseCase {",
                        "  private final LoadSelectionUseCase loadSelection;",
                        "  private final SelectionModel selectionModel;",
                        "  private final BarSnapshot barSnapshot;",
                        "  private final SelectionView selectionView;",
                        "  private final Function<Integer, Integer> callback;",
                        "  ApplySelectionUseCase(",
                        "      LoadSelectionUseCase loadSelection,",
                        "      SelectionModel selectionModel,",
                        "      BarSnapshot barSnapshot,",
                        "      SelectionView selectionView,",
                        "      Function<Integer, Integer> callback) {",
                        "    this.loadSelection = loadSelection;",
                        "    this.selectionModel = selectionModel;",
                        "    this.barSnapshot = barSnapshot;",
                        "    this.selectionView = selectionView;",
                        "    this.callback = callback;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/application/LoadSelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "public final class LoadSelectionUseCase { }")
                .addSourceLines(
                        "src/domain/foo/published/SelectionModel.java",
                        "package src.domain.foo.published;",
                        "public interface SelectionModel { }")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot() { }")
                .addSourceLines(
                        "src/view/foo/SelectionView.java",
                        "package src.view.foo;",
                        "public final class SelectionView { }")
                .expectErrorMessage("forbidden-collaborator-matrix", containsAll(
                        "references root UseCase chain src.domain.foo.application.LoadSelectionUseCase",
                        "references forbidden domain concern src.domain.foo.published.SelectionModel",
                        "references forbidden domain concern src.domain.bar.published.BarSnapshot",
                        "references outer-layer type src.view.foo.SelectionView",
                        "references executable protocol type java.util.function.Function"))
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
                        "  void apply() {",
                        "    grid.apply();",
                        "    selection.apply();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridState.java",
                        "package src.domain.foo.model.grid.model;",
                        "public final class GridState {",
                        "  public void apply() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState {",
                        "  public void apply() { }",
                        "}")
                .doTest();
    }

    @Test
    public void rootUseCaseAllowsCrossModelFamilyModelUseCaseOrchestration() {
        CompilationTestHelper.newInstance(DomainRootUseCaseCrossModelFamilyBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplyWorkspaceUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.model.grid.usecase.ApplyGridUseCase;",
                        "import src.domain.foo.model.selection.usecase.ApplySelectionUseCase;",
                        "final class ApplyWorkspaceUseCase {",
                        "  private final ApplyGridUseCase grid;",
                        "  private final ApplySelectionUseCase selection;",
                        "  ApplyWorkspaceUseCase(ApplyGridUseCase grid, ApplySelectionUseCase selection) {",
                        "    this.grid = grid;",
                        "    this.selection = selection;",
                        "  }",
                        "  void apply() {",
                        "    grid.apply();",
                        "    selection.apply();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/usecase/ApplyGridUseCase.java",
                        "package src.domain.foo.model.grid.usecase;",
                        "public final class ApplyGridUseCase {",
                        "  public void apply() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/usecase/ApplySelectionUseCase.java",
                        "package src.domain.foo.model.selection.usecase;",
                        "public final class ApplySelectionUseCase {",
                        "  public void apply() { }",
                        "}")
                .doTest();
    }

    @Test
    public void rootUseCaseRejectsPassiveMultiModelFamilyReferences() {
        CompilationTestHelper.newInstance(DomainRootUseCaseCrossModelFamilyBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplyWorkspaceUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.foo.model.grid.model.GridState;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "// BUG: Diagnostic contains: invoked model families []",
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
    public void rootUseCaseRejectsSingleModelFamilyInvocation() {
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
                        "  void apply() {",
                        "    selection.apply();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState {",
                        "  public void apply() { }",
                        "}")
                .doTest();
    }

    @Test
    public void rootUseCaseRejectsForeignModelFamilyAsJustification() {
        CompilationTestHelper.newInstance(DomainRootUseCaseCrossModelFamilyBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/application/ApplySelectionUseCase.java",
                        "package src.domain.foo.application;",
                        "import src.domain.bar.model.grid.model.GridState;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "// BUG: Diagnostic contains: invoked model families [selection]",
                        "final class ApplySelectionUseCase {",
                        "  private final GridState grid;",
                        "  private final SelectionState selection;",
                        "  ApplySelectionUseCase(GridState grid, SelectionState selection) {",
                        "    this.grid = grid;",
                        "    this.selection = selection;",
                        "  }",
                        "  void apply() {",
                        "    grid.apply();",
                        "    selection.apply();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/model/grid/model/GridState.java",
                        "package src.domain.bar.model.grid.model;",
                        "public final class GridState {",
                        "  public void apply() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/model/SelectionState.java",
                        "package src.domain.foo.model.selection.model;",
                        "public final class SelectionState {",
                        "  public void apply() { }",
                        "}")
                .doTest();
    }

    @Test
    public void modelAllowsSameContextModelConstantsAndPassivePlatformTypes() {
        CompilationTestHelper.newInstance(DomainModelRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "import java.time.LocalDate;",
                        "import java.util.List;",
                        "import src.domain.foo.model.grid.constants.GridConstants;",
                        "import src.domain.foo.model.selection.model.SelectionState;",
                        "final class GridCoordinate {",
                        "  private final SelectionState selection;",
                        "  private final List<LocalDate> dates;",
                        "  GridCoordinate(SelectionState selection, List<LocalDate> dates) {",
                        "    this.selection = selection;",
                        "    this.dates = List.copyOf(dates);",
                        "  }",
                        "  int limit() {",
                        "    return GridConstants.MAX_SIZE + dates.size();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "public final class GridConstants {",
                        "  public static final int MAX_SIZE = 12;",
                        "  private GridConstants() { }",
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
    public void modelRejectsRepositoryPortUseCasePublishedAndRootServiceConcerns() {
        CompilationTestHelper.newInstance(DomainModelRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "import src.domain.foo.FooGridApplicationService;",
                        "import src.domain.foo.application.ApplyGridUseCase;",
                        "import src.domain.foo.model.grid.port.GridPort;",
                        "import src.domain.foo.model.grid.repository.GridRepository;",
                        "import src.domain.foo.published.GridModel;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.foo.FooGridApplicationService; references forbidden domain concern src.domain.foo.application.ApplyGridUseCase; references forbidden domain concern src.domain.foo.model.grid.port.GridPort; references forbidden domain concern src.domain.foo.model.grid.repository.GridRepository; references forbidden domain concern src.domain.foo.published.GridModel",
                        "final class GridCoordinate {",
                        "  private final FooGridApplicationService service;",
                        "  private final ApplyGridUseCase useCase;",
                        "  private final GridPort port;",
                        "  private final GridRepository repository;",
                        "  private final GridModel published;",
                        "  GridCoordinate(FooGridApplicationService service, ApplyGridUseCase useCase, GridPort port, GridRepository repository, GridModel published) {",
                        "    this.service = service;",
                        "    this.useCase = useCase;",
                        "    this.port = port;",
                        "    this.repository = repository;",
                        "    this.published = published;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/FooGridApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooGridApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/application/ApplyGridUseCase.java",
                        "package src.domain.foo.application;",
                        "public final class ApplyGridUseCase { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "public interface GridPort { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public final class GridRepository { }")
                .addSourceLines(
                        "src/domain/foo/published/GridModel.java",
                        "package src.domain.foo.published;",
                        "public interface GridModel { }")
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
    public void helperAllowsSameContextModelConstantsAndPassivePlatformTypes() {
        CompilationTestHelper.newInstance(DomainHelperRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/helper/GridMathHelper.java",
                        "package src.domain.foo.model.grid.helper;",
                        "import java.math.BigDecimal;",
                        "import java.util.Optional;",
                        "import src.domain.foo.model.grid.constants.GridConstants;",
                        "import src.domain.foo.model.grid.model.GridCoordinate;",
                        "final class GridMathHelper {",
                        "  Optional<BigDecimal> score(GridCoordinate coordinate) {",
                        "    return Optional.of(BigDecimal.valueOf(coordinate.row() + GridConstants.MAX_SIZE));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "public final class GridConstants {",
                        "  public static final int MAX_SIZE = 12;",
                        "  private GridConstants() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "public record GridCoordinate(int row) { }")
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
    public void helperRejectsPortUseCasePublishedRootServiceAndExecutableProtocolConcerns() {
        CompilationTestHelper.newInstance(DomainHelperRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/helper/GridMathHelper.java",
                        "package src.domain.foo.model.grid.helper;",
                        "import java.util.concurrent.Callable;",
                        "import src.domain.foo.FooGridApplicationService;",
                        "import src.domain.foo.model.grid.port.GridPort;",
                        "import src.domain.foo.model.grid.usecase.NormalizeGridUseCase;",
                        "import src.domain.foo.published.GridModel;",
                        "// BUG: Diagnostic contains: references executable protocol type java.util.concurrent.Callable; references forbidden domain concern src.domain.foo.FooGridApplicationService; references forbidden domain concern src.domain.foo.model.grid.port.GridPort; references forbidden domain concern src.domain.foo.model.grid.usecase.NormalizeGridUseCase; references forbidden domain concern src.domain.foo.published.GridModel",
                        "final class GridMathHelper {",
                        "  private final Callable<Integer> callable;",
                        "  private final FooGridApplicationService service;",
                        "  private final GridPort port;",
                        "  private final NormalizeGridUseCase useCase;",
                        "  private final GridModel published;",
                        "  GridMathHelper(Callable<Integer> callable, FooGridApplicationService service, GridPort port, NormalizeGridUseCase useCase, GridModel published) {",
                        "    this.callable = callable;",
                        "    this.service = service;",
                        "    this.port = port;",
                        "    this.useCase = useCase;",
                        "    this.published = published;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/FooGridApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooGridApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "public interface GridPort { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/usecase/NormalizeGridUseCase.java",
                        "package src.domain.foo.model.grid.usecase;",
                        "public final class NormalizeGridUseCase { }")
                .addSourceLines(
                        "src/domain/foo/published/GridModel.java",
                        "package src.domain.foo.published;",
                        "public interface GridModel { }")
                .doTest();
    }

    @Test
    public void constantsAllowsSameContextConstantsAndPassivePlatformTypes() {
        CompilationTestHelper.newInstance(DomainConstantsRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "import java.time.Duration;",
                        "import java.util.List;",
                        "import src.domain.foo.model.selection.constants.SelectionConstants;",
                        "final class GridConstants {",
                        "  static final Duration DEFAULT_DELAY = Duration.ZERO;",
                        "  static final List<String> MODES = List.of(SelectionConstants.DEFAULT_MODE);",
                        "  private GridConstants() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/selection/constants/SelectionConstants.java",
                        "package src.domain.foo.model.selection.constants;",
                        "public final class SelectionConstants {",
                        "  public static final String DEFAULT_MODE = \"select\";",
                        "  private SelectionConstants() { }",
                        "}")
                .doTest();
    }

    @Test
    public void constantsRejectsModelHelperRepositoryPortUseCasePublishedRootServiceAndExecutableProtocolConcerns() {
        CompilationTestHelper.newInstance(DomainConstantsRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "import java.util.function.Supplier;",
                        "import src.domain.foo.FooGridApplicationService;",
                        "import src.domain.foo.model.grid.helper.GridMathHelper;",
                        "import src.domain.foo.model.grid.model.GridCoordinate;",
                        "import src.domain.foo.model.grid.port.GridPort;",
                        "import src.domain.foo.model.grid.repository.GridRepository;",
                        "import src.domain.foo.model.grid.usecase.NormalizeGridUseCase;",
                        "import src.domain.foo.published.GridModel;",
                        "// BUG: Diagnostic contains: references executable protocol type java.util.function.Supplier; references forbidden domain concern src.domain.foo.FooGridApplicationService; references forbidden domain concern src.domain.foo.model.grid.helper.GridMathHelper; references forbidden domain concern src.domain.foo.model.grid.model.GridCoordinate; references forbidden domain concern src.domain.foo.model.grid.port.GridPort; references forbidden domain concern src.domain.foo.model.grid.repository.GridRepository; references forbidden domain concern src.domain.foo.model.grid.usecase.NormalizeGridUseCase; references forbidden domain concern src.domain.foo.published.GridModel",
                        "final class GridConstants {",
                        "  static final Supplier<Integer> SUPPLIER = () -> 1;",
                        "  static final Class<?> SERVICE = FooGridApplicationService.class;",
                        "  static final Class<?> HELPER = GridMathHelper.class;",
                        "  static final Class<?> MODEL = GridCoordinate.class;",
                        "  static final Class<?> PORT = GridPort.class;",
                        "  static final Class<?> REPOSITORY = GridRepository.class;",
                        "  static final Class<?> USE_CASE = NormalizeGridUseCase.class;",
                        "  static final Class<?> PUBLISHED = GridModel.class;",
                        "  private GridConstants() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/FooGridApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooGridApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/helper/GridMathHelper.java",
                        "package src.domain.foo.model.grid.helper;",
                        "public final class GridMathHelper { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "public record GridCoordinate(int row) { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "public interface GridPort { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public final class GridRepository { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/usecase/NormalizeGridUseCase.java",
                        "package src.domain.foo.model.grid.usecase;",
                        "public final class NormalizeGridUseCase { }")
                .addSourceLines(
                        "src/domain/foo/published/GridModel.java",
                        "package src.domain.foo.published;",
                        "public interface GridModel { }")
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
    public void portAllowsForeignPublishedSameContextUseCaseModelAndConstants() {
        CompilationTestHelper.newInstance(DomainPortRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "import src.domain.bar.published.BarSnapshot;",
                        "import src.domain.foo.model.grid.constants.GridConstants;",
                        "import src.domain.foo.model.grid.model.GridCoordinate;",
                        "import src.domain.foo.model.grid.usecase.NormalizeGridUseCase;",
                        "interface GridPort {",
                        "  void receive(BarSnapshot snapshot, GridCoordinate fallback, NormalizeGridUseCase followUp);",
                        "  default int maxSize() {",
                        "    return GridConstants.MAX_SIZE;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot(int row) { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "public final class GridConstants {",
                        "  public static final int MAX_SIZE = 12;",
                        "  private GridConstants() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "public record GridCoordinate(int row) { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/usecase/NormalizeGridUseCase.java",
                        "package src.domain.foo.model.grid.usecase;",
                        "public final class NormalizeGridUseCase { }")
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
    public void portRejectsOuterLayerAndCallbackProtocolConcerns() {
        CompilationTestHelper.newInstance(DomainPortRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/port/GridPort.java",
                        "package src.domain.foo.model.grid.port;",
                        "import java.util.function.Consumer;",
                        "import src.view.foo.GridView;",
                        "// BUG: Diagnostic matches: port-outer-callback-matrix",
                        "interface GridPort {",
                        "  void wire(GridView view, Consumer<String> callback);",
                        "}")
                .addSourceLines(
                        "src/view/foo/GridView.java",
                        "package src.view.foo;",
                        "public final class GridView { }")
                .expectErrorMessage("port-outer-callback-matrix", containsAll(
                        "references outer-layer type src.view.foo.GridView",
                        "references executable protocol type java.util.function.Consumer"))
                .doTest();
    }

    @Test
    public void repositoryAllowsForeignApplicationServiceSameContextModelConstantsAndRepository() {
        CompilationTestHelper.newInstance(DomainRepositoryRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "import src.domain.bar.BarGridApplicationService;",
                        "import src.domain.foo.model.grid.constants.GridConstants;",
                        "import src.domain.foo.model.grid.model.GridCoordinate;",
                        "final class GridRepository {",
                        "  private final BarGridApplicationService foreignService;",
                        "  private final GridAuditRepository auditRepository;",
                        "  GridRepository(BarGridApplicationService foreignService, GridAuditRepository auditRepository) {",
                        "    this.foreignService = foreignService;",
                        "    this.auditRepository = auditRepository;",
                        "  }",
                        "  GridCoordinate normalize(GridCoordinate coordinate) {",
                        "    auditRepository.record(GridConstants.MAX_SIZE);",
                        "    return coordinate;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridAuditRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "public final class GridAuditRepository {",
                        "  public void record(int size) { }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/BarGridApplicationService.java",
                        "package src.domain.bar;",
                        "public final class BarGridApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/model/grid/constants/GridConstants.java",
                        "package src.domain.foo.model.grid.constants;",
                        "public final class GridConstants {",
                        "  public static final int MAX_SIZE = 12;",
                        "  private GridConstants() { }",
                        "}")
                .addSourceLines(
                        "src/domain/foo/model/grid/model/GridCoordinate.java",
                        "package src.domain.foo.model.grid.model;",
                        "public record GridCoordinate(int row) { }")
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

    @Test
    public void repositoryRejectsForeignPublishedConcern() {
        CompilationTestHelper.newInstance(DomainRepositoryRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "import src.domain.bar.published.BarSnapshot;",
                        "// BUG: Diagnostic contains: references forbidden domain concern src.domain.bar.published.BarSnapshot",
                        "final class GridRepository {",
                        "  BarSnapshot load() {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/bar/published/BarSnapshot.java",
                        "package src.domain.bar.published;",
                        "public record BarSnapshot(int row) { }")
                .doTest();
    }

    @Test
    public void repositoryRejectsOuterLayerAndCallbackProtocolConcerns() {
        CompilationTestHelper.newInstance(DomainRepositoryRoleBoundaryChecker.class, getClass())
                .addSourceLines(
                        "src/domain/foo/model/grid/repository/GridRepository.java",
                        "package src.domain.foo.model.grid.repository;",
                        "import java.util.concurrent.Callable;",
                        "import src.data.foo.GridRecord;",
                        "// BUG: Diagnostic matches: repository-outer-callback-matrix",
                        "final class GridRepository {",
                        "  private final GridRecord record;",
                        "  private final Callable<Integer> callback;",
                        "  GridRepository(GridRecord record, Callable<Integer> callback) {",
                        "    this.record = record;",
                        "    this.callback = callback;",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/data/foo/GridRecord.java",
                        "package src.data.foo;",
                        "public record GridRecord(int row) { }")
                .expectErrorMessage("repository-outer-callback-matrix", containsAll(
                        "references outer-layer type src.data.foo.GridRecord",
                        "references executable protocol type java.util.concurrent.Callable"))
                .doTest();
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
