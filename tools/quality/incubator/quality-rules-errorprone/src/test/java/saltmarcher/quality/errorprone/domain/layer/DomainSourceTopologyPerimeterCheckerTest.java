package saltmarcher.quality.errorprone.domain.layer;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import saltmarcher.quality.errorprone.DomainSourceTopologyPerimeterChecker;

@RunWith(JUnit4.class)
public final class DomainSourceTopologyPerimeterCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            DomainSourceTopologyPerimeterChecker.class,
            getClass());

    @Test
    public void allowsCanonicalDomainTopology() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooSelectionApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/FooDisplayApplicationService.java",
                        "package src.domain.foo;",
                        "public final class FooDisplayApplicationService { }")
                .addSourceLines(
                        "src/domain/foo/published/FooCommand.java",
                        "package src.domain.foo.published;",
                        "public record FooCommand() { }")
                .addSourceLines(
                        "src/domain/foo/published/FooModel.java",
                        "package src.domain.foo.published;",
                        "public interface FooModel { }")
                .addSourceLines(
                        "src/domain/foo/application/MoveCorridorUseCase.java",
                        "package src.domain.foo.application;",
                        "final class MoveCorridorUseCase { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/usecase/AddCreatureUseCase.java",
                        "package src.domain.foo.model.encounter.usecase;",
                        "final class AddCreatureUseCase { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/helper/DifficultyHelper.java",
                        "package src.domain.foo.model.encounter.helper;",
                        "final class DifficultyHelper { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/constants/EncounterXpConstants.java",
                        "package src.domain.foo.model.encounter.constants;",
                        "final class EncounterXpConstants { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/port/EncounterSessionPort.java",
                        "package src.domain.foo.model.encounter.port;",
                        "interface EncounterSessionPort { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/repository/EncounterSessionRepository.java",
                        "package src.domain.foo.model.encounter.repository;",
                        "final class EncounterSessionRepository { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/model/Encounter.java",
                        "package src.domain.foo.model.encounter.model;",
                        "final class Encounter { }")
                .addSourceLines(
                        "src/domain/foo/model/encounter/model/slots/EncounterSlot.java",
                        "package src.domain.foo.model.encounter.model.slots;",
                        "final class EncounterSlot { }")
                .doTest();
    }

    @Test
    public void rejectsForeignRootRoleFile() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooHelper.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: direct root domain files must be *ApplicationService.java only",
                        "final class FooHelper { }")
                .doTest();
    }

    @Test
    public void rejectsForeignRootBucket() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/service/FooService.java",
                        "package src.domain.foo.service;",
                        "// BUG: Diagnostic contains: domain sources may use only direct root ApplicationService files, published/, application/, or model/",
                        "final class FooService { }")
                .doTest();
    }

    @Test
    public void rejectsNestedPublishedCarrierPackage() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/published/internal/FooCommand.java",
                        "package src.domain.foo.published.internal;",
                        "// BUG: Diagnostic contains: published/ carriers must stay as direct files under src/domain/<context>/published/",
                        "public record FooCommand() { }")
                .doTest();
    }

    @Test
    public void rejectsWrongApplicationFileShape() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/application/MoveCorridorHelper.java",
                        "package src.domain.foo.application;",
                        "// BUG: Diagnostic contains: root application/ orchestration files must stay as direct *UseCase.java files under src/domain/<context>/application/",
                        "final class MoveCorridorHelper { }")
                .doTest();
    }

    @Test
    public void rejectsDirectJavaFileUnderModelRoot() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/Encounter.java",
                        "package src.domain.foo.model;",
                        "// BUG: Diagnostic contains: src/domain/<context>/model/ may contain only lower-case family directories, not direct Java files",
                        "final class Encounter { }")
                .doTest();
    }

    @Test
    public void rejectsDirectJavaFileUnderModelFamilyRoot() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/Encounter.java",
                        "package src.domain.foo.model.encounter;",
                        "// BUG: Diagnostic contains: model families must place Java files under src/domain/<context>/model/<family>/<role>/",
                        "final class Encounter { }")
                .doTest();
    }

    @Test
    public void rejectsUnknownModelRolePackage() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/service/EncounterService.java",
                        "package src.domain.foo.model.encounter.service;",
                        "// BUG: Diagnostic contains: model-family role packages must be one of: model, usecase, helper, constants, port, repository",
                        "final class EncounterService { }")
                .doTest();
    }

    @Test
    public void rejectsWrongRoleSuffixInsideCanonicalBucket() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/helper/EncounterMath.java",
                        "package src.domain.foo.model.encounter.helper;",
                        "// BUG: Diagnostic contains: files under helper/ must use the top-level role form *Helper.java",
                        "final class EncounterMath { }")
                .doTest();
    }

    @Test
    public void rejectsReservedRoleSuffixOutsideCanonicalBucket() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/published/FooRepository.java",
                        "package src.domain.foo.published;",
                        "// BUG: Diagnostic contains: reserved role suffix Repository may appear only under model/<family>/repository/",
                        "public record FooRepository() { }")
                .doTest();
    }

    @Test
    public void rejectsLegacyRoleBucketAndSuffix() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/service/EncounterService.java",
                        "package src.domain.foo.model.encounter.service;",
                        "// BUG: Diagnostic contains: model-family role packages must be one of: model, usecase, helper, constants, port, repository",
                        "final class EncounterService { }")
                .doTest();
    }

    @Test
    public void rejectsLegacyRoleSuffixInsideModelSubtree() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/model/EncounterService.java",
                        "package src.domain.foo.model.encounter.model;",
                        "// BUG: Diagnostic contains: legacy role/helper suffixes such as *BoundaryTranslator, *Projector, *RuntimeAccess, *RuntimeAdapter, *Policy, *Service, *Factory, *Aggregate, *Entity, and *Specification are forbidden",
                        "final class EncounterService { }")
                .doTest();
    }

    @Test
    public void rejectsNestedTechnicalBucketsInsideModelSubtree() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/model/port/EncounterView.java",
                        "package src.domain.foo.model.encounter.model.port;",
                        "// BUG: Diagnostic contains: nested technical buckets are forbidden inside src/domain/<context>/model/<family>/model/**",
                        "final class EncounterView { }")
                .doTest();
    }

    @Test
    public void rejectsPackagePathMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/model/encounter/helper/EncounterHelper.java",
                        "package src.domain.foo.model.other.helper;",
                        "// BUG: Diagnostic contains: package 'src.domain.foo.model.other.helper' must match path package 'src.domain.foo.model.encounter.helper'",
                        "final class EncounterHelper { }")
                .doTest();
    }

    @Test
    public void rejectsTopLevelTypeAndFileNameMismatch() {
        compilationHelper
                .addSourceLines(
                        "src/domain/foo/FooSelectionApplicationService.java",
                        "package src.domain.foo;",
                        "// BUG: Diagnostic contains: file name 'FooSelectionApplicationService.java' must match top-level domain-layer type 'OtherApplicationService.java'",
                        "final class OtherApplicationService { }")
                .doTest();
    }
}
