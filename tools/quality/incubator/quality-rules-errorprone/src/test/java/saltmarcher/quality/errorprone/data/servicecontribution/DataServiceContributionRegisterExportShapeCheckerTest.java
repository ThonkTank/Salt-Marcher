package saltmarcher.quality.errorprone.data.servicecontribution;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class DataServiceContributionRegisterExportShapeCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            DataServiceContributionRegisterExportShapeChecker.class,
            getClass());

    @Test
    public void allowsSameFeatureDomainPortAndRepositoryExports() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "import java.util.function.Supplier;",
                        "public interface ServiceRegistry {",
                        "  interface Builder {",
                        "    <T> Builder register(Class<T> key, T service);",
                        "    <T> Builder registerFactory(Class<T> key, Supplier<? extends T> factory);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/model/session/port/EncounterSessionPort.java",
                        "package src.domain.encounter.model.session.port;",
                        "public interface EncounterSessionPort { }")
                .addSourceLines(
                        "src/domain/encounter/model/session/repository/EncounterSessionRepository.java",
                        "package src.domain.encounter.model.session.repository;",
                        "public interface EncounterSessionRepository { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.encounter.model.session.port.EncounterSessionPort;",
                        "import src.domain.encounter.model.session.repository.EncounterSessionRepository;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, EncounterSessionPort port, EncounterSessionRepository repository) {",
                        "    registry.register(EncounterSessionPort.class, port);",
                        "    registry.registerFactory(EncounterSessionRepository.class, () -> repository);",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsApplicationServiceExport() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "public interface ServiceRegistry { interface Builder { <T> Builder register(Class<T> key, T service); } }")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "public final class EncounterApplicationService { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "// BUG: Diagnostic contains: may export only src.domain.encounter.model.*.port.*Port or src.domain.encounter.model.*.repository.*Repository",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, EncounterApplicationService service) {",
                        "    registry.register(EncounterApplicationService.class, service);",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsApplicationServiceFactoryExport() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "import java.util.function.Supplier;",
                        "public interface ServiceRegistry {",
                        "  interface Builder {",
                        "    <T> Builder registerFactory(Class<T> key, Supplier<? extends T> factory);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/domain/encounter/EncounterApplicationService.java",
                        "package src.domain.encounter;",
                        "public final class EncounterApplicationService { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "// BUG: Diagnostic contains: registerFactory(src.domain.encounter.EncounterApplicationService)",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.encounter.EncounterApplicationService;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, EncounterApplicationService service) {",
                        "    registry.registerFactory(EncounterApplicationService.class, () -> service);",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsPublishedModelExport() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "public interface ServiceRegistry { interface Builder { <T> Builder register(Class<T> key, T service); } }")
                .addSourceLines(
                        "src/domain/encounter/published/EncounterModel.java",
                        "package src.domain.encounter.published;",
                        "public interface EncounterModel { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "// BUG: Diagnostic contains: Forbidden service keys: register(src.domain.encounter.published.EncounterModel)",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.encounter.published.EncounterModel;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, EncounterModel model) {",
                        "    registry.register(EncounterModel.class, model);",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsForeignFeatureRepositoryExport() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "public interface ServiceRegistry { interface Builder { <T> Builder register(Class<T> key, T service); } }")
                .addSourceLines(
                        "src/domain/party/model/roster/repository/PartyRosterRepository.java",
                        "package src.domain.party.model.roster.repository;",
                        "public interface PartyRosterRepository { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "// BUG: Diagnostic contains: register(src.domain.party.model.roster.repository.PartyRosterRepository)",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.party.model.roster.repository.PartyRosterRepository;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, PartyRosterRepository repository) {",
                        "    registry.register(PartyRosterRepository.class, repository);",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsPublishedStateRepositoryExport() {
        compilationHelper
                .addSourceLines(
                        "shell/api/ServiceRegistry.java",
                        "package shell.api;",
                        "public interface ServiceRegistry { interface Builder { <T> Builder register(Class<T> key, T service); } }")
                .addSourceLines(
                        "src/domain/encounter/model/session/repository/EncounterPublishedStateRepository.java",
                        "package src.domain.encounter.model.session.repository;",
                        "public interface EncounterPublishedStateRepository { }")
                .addSourceLines(
                        "src/data/encounter/EncounterServiceContribution.java",
                        "// BUG: Diagnostic contains: register(src.domain.encounter.model.session.repository.EncounterPublishedStateRepository)",
                        "package src.data.encounter;",
                        "import shell.api.ServiceRegistry;",
                        "import src.domain.encounter.model.session.repository.EncounterPublishedStateRepository;",
                        "public final class EncounterServiceContribution {",
                        "  void register(ServiceRegistry.Builder registry, EncounterPublishedStateRepository repository) {",
                        "    registry.register(EncounterPublishedStateRepository.class, repository);",
                        "  }",
                        "}")
                .doTest();
    }
}
