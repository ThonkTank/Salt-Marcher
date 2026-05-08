package saltmarcher.quality.errorprone.data.query;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DataQueryForeignPublishedReplyChannelRoundTripChecker;

@RunWith(JUnit4.class)
public final class DataQueryForeignPublishedReplyChannelRoundTripCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            DataQueryForeignPublishedReplyChannelRoundTripChecker.class,
            getClass());

    @Test
    public void rejectsLinearForeignReplyChannelRoundtrip() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "    // BUG: Diagnostic contains: foreign published reply-channel roundtrip anti-pattern",
                        "    planBudgetModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void allowsPollBeforeForeignCommand() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    planBudgetModel.current();",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void allowsBranchLocalCommandThatDoesNotDominateReadback() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id, boolean refresh) {",
                        "    if (refresh) {",
                        "      encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "    }",
                        "    planBudgetModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void rejectsSameFilePrivateHelperInlineRoundtrip() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    refresh(id);",
                        "    readBudget();",
                        "  }",
                        "  private void refresh(long id) {",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "  }",
                        "  private void readBudget() {",
                        "    // BUG: Diagnostic contains: foreign published reply-channel roundtrip anti-pattern",
                        "    planBudgetModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void rejectsCallerCommandThenPrivateStaticHelperPoll() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "    readBudget(planBudgetModel);",
                        "  }",
                        "  private static void readBudget(EncounterPlanBudgetModel planBudgetModel) {",
                        "    // BUG: Diagnostic contains: foreign published reply-channel roundtrip anti-pattern",
                        "    planBudgetModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void rejectsFinalOwnerHelperCommandThenCallerPoll() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    commandHelper(id);",
                        "    // BUG: Diagnostic contains: foreign published reply-channel roundtrip anti-pattern",
                        "    planBudgetModel.current();",
                        "  }",
                        "  void commandHelper(long id) {",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void allowsPollReachedOnlyThroughOverridableHelper() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterApplicationService encounters;",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      EncounterApplicationService encounters, EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.encounters = encounters;",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(id));",
                        "    readBudget();",
                        "  }",
                        "  void readBudget() {",
                        "    planBudgetModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "public final class EncounterApplicationService {",
                        "  public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void allowsForeignPublishedCurrentWithoutApplicationServiceCommand() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.encounter.published.EncounterPlanBudgetModel;",
                        "import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final EncounterPlanBudgetModel planBudgetModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(EncounterPlanBudgetModel planBudgetModel) {",
                        "    this.planBudgetModel = planBudgetModel;",
                        "  }",
                        "  void load(long id) {",
                        "    localRefresh(new RefreshEncounterPlanBudgetCommand(id));",
                        "    planBudgetModel.current();",
                        "  }",
                        "  private void localRefresh(RefreshEncounterPlanBudgetCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/RefreshEncounterPlanBudgetCommand.java",
                        "package src.domain.encounter.published;",
                        "public record RefreshEncounterPlanBudgetCommand(long planId) { }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetModel.java",
                        "package src.domain.encounter.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class EncounterPlanBudgetModel {",
                        "  public EncounterPlanBudgetResult current() { return new EncounterPlanBudgetResult(); }",
                        "  public Runnable subscribe(Consumer<EncounterPlanBudgetResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterPlanBudgetResult.java",
                        "package src.domain.encounter.published;",
                        "public final class EncounterPlanBudgetResult { }")
                .doTest();
    }

    @Test
    public void allowsOwnFeatureReadback() {
        compilationHelper
                .addSourceLines(
                        "src/data/sessionplanner/query/ApplicationSessionPlannerFactsQueryAdapter.java",
                        "package src.data.sessionplanner.query;",
                        "import src.domain.sessionplanner.SessionPlannerApplicationService;",
                        "import src.domain.sessionplanner.published.SessionPlannerStateModel;",
                        "import src.domain.sessionplanner.published.RefreshSessionPlannerStateCommand;",
                        "final class ApplicationSessionPlannerFactsQueryAdapter {",
                        "  private final SessionPlannerApplicationService sessionPlanner;",
                        "  private final SessionPlannerStateModel stateModel;",
                        "  ApplicationSessionPlannerFactsQueryAdapter(",
                        "      SessionPlannerApplicationService sessionPlanner, SessionPlannerStateModel stateModel) {",
                        "    this.sessionPlanner = sessionPlanner;",
                        "    this.stateModel = stateModel;",
                        "  }",
                        "  void load(long id) {",
                        "    sessionPlanner.refreshState(new RefreshSessionPlannerStateCommand(id));",
                        "    stateModel.current();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/sessionplanner/SessionPlannerApplicationService.java",
                        "package src.domain.sessionplanner;",
                        "import src.domain.sessionplanner.published.RefreshSessionPlannerStateCommand;",
                        "public final class SessionPlannerApplicationService {",
                        "  public void refreshState(RefreshSessionPlannerStateCommand command) { }",
                        "}")
                .addSourceLines(
                        "src/domain/sessionplanner/published/RefreshSessionPlannerStateCommand.java",
                        "package src.domain.sessionplanner.published;",
                        "public record RefreshSessionPlannerStateCommand(long sessionId) { }")
                .addSourceLines(
                        "src/domain/sessionplanner/published/SessionPlannerStateModel.java",
                        "package src.domain.sessionplanner.published;",
                        "import java.lang.Runnable;",
                        "import java.util.function.Consumer;",
                        "public final class SessionPlannerStateModel {",
                        "  public SessionPlannerStateResult current() { return new SessionPlannerStateResult(); }",
                        "  public Runnable subscribe(Consumer<SessionPlannerStateResult> listener) { return () -> { }; }",
                        "}")
                .addSourceLines(
                        "src/domain/sessionplanner/published/SessionPlannerStateResult.java",
                        "package src.domain.sessionplanner.published;",
                        "public final class SessionPlannerStateResult { }")
                .doTest();
    }
}
