import buildlogic.application.ApplicationTaskSupport
import buildlogic.application.registerApplyCreatureOverridesTask
import buildlogic.application.registerBackfillCreatureAnalysisTask
import buildlogic.application.registerCrawlerItemsPipelineTask
import buildlogic.application.registerCrawlerItemsSlugsTask
import buildlogic.application.registerCrawlerItemsTask
import buildlogic.application.registerCrawlerMonstersTask
import buildlogic.application.registerCrawlerSpellsPipelineTask
import buildlogic.application.registerCrawlerSpellsSlugsTask
import buildlogic.application.registerCrawlerSpellsTask
import buildlogic.application.registerCrawlerTask
import buildlogic.application.registerImportItemsTask
import buildlogic.application.registerImportMonstersTask
import buildlogic.application.registerImportSpellsTask
import buildlogic.application.registerRebuildCreatureAnalysisTask
import buildlogic.application.registerRecoverEncounterTablesTask
import buildlogic.application.registerSqliteQueryTask
import buildlogic.cleanup.registerDeleteEmptySourceDirectoriesTask
import buildlogic.conventions.registerCheckConventionsTask
import buildlogic.conventions.heuristic.owner.OwnerConventionSupport
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryConventionTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryInputFilesTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryOwnerFilesTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryRepositoryFilesTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundarySourcePlacementTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryStateFilesTask
import buildlogic.conventions.heuristic.owner.registerCheckOwnerApiBoundaryTaskFilesTask
import buildlogic.conventions.heuristic.registerCheckArchitectureHeuristicsTask
import buildlogic.conventions.heuristic.registerCheckDungeonGeometryConventionTask
import buildlogic.conventions.hygiene.registerCheckBuildHygieneTask
import buildlogic.conventions.hygiene.registerCheckNoCompiledArtifactsInSourceTask
import buildlogic.conventions.legacy.registerCheckDungeonEditorArchitectureConventionTask
import buildlogic.conventions.legacy.registerCheckFeatureApiBoundaryConventionTask
import buildlogic.conventions.legacy.registerCheckLegacyArchitectureGuardsTask
import buildlogic.conventions.legacy.registerCheckNoStdStreamsInFeatureServicesAndRepositoriesTask
import buildlogic.conventions.legacy.registerCheckRepositorySqlExceptionConventionTask
import buildlogic.conventions.policy.registerCheckLocalBuildPoliciesTask
import buildlogic.conventions.policy.registerCheckUiAsyncSubmissionConventionTask
import buildlogic.packaging.PackagingConfig
import buildlogic.packaging.PackagingSupport
import buildlogic.packaging.registerInstallAppImageTask
import buildlogic.packaging.registerInstallDesktopAppTask
import buildlogic.packaging.registerInstallDesktopEntriesTask
import buildlogic.packaging.registerPackageAppImageFallbackTask
import buildlogic.packaging.registerPackageAppImageTask
import buildlogic.packaging.registerPrepareRuntimeImageTask
import buildlogic.packaging.registerStageJpackageInputTask
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.jvm.application.tasks.CreateStartScripts

plugins {
    java
    application
    id("org.openjfx.javafxplugin") version "0.1.0"
}

val desktopAppName = "Salt Marcher"
val launcherName = "salt-marcher"
val preloaderJvmArg = "-Djavafx.preloader=ui.bootstrap.preloader.PreloaderObject"
val jpackageModulePathArg = "--module-path=${'$'}APPDIR"
val jpackageAddModulesArg = "--add-modules=javafx.controls"
val desktopIconRelativePath = "icons/salt-marcher.svg"
val packageVersion = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

javafx {
    version = "21.0.2"
    modules = listOf("javafx.controls")
}

sourceSets {
    main {
        java {
            setSrcDirs(listOf("src"))
            exclude("test/**")
        }
        resources {
            setSrcDirs(listOf("resources"))
        }
    }
}

dependencies {
    implementation("org.xerial:sqlite-jdbc:3.45.1.0")
    implementation("org.jsoup:jsoup:1.17.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.17.2")
    runtimeOnly("org.slf4j:slf4j-api:2.0.9")
    runtimeOnly("org.slf4j:slf4j-nop:2.0.9")
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.0")
}

application {
    mainClass = "ui.bootstrap.app.AppObject"
    applicationDefaultJvmArgs = listOf(preloaderJvmArg, "--enable-preview")
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.release = 21
    options.compilerArgs.add("--enable-preview")
}

tasks.withType<CreateStartScripts>().configureEach {
    applicationName = launcherName
}

tasks.test {
    useJUnitPlatform()
}

val packagingSupport = PackagingSupport(
    project = project,
    config = PackagingConfig(
        desktopAppName = desktopAppName,
        launcherName = launcherName,
        preloaderJvmArg = preloaderJvmArg,
        jpackageModulePathArg = jpackageModulePathArg,
        jpackageAddModulesArg = jpackageAddModulesArg,
        desktopIconRelativePath = desktopIconRelativePath,
        packageVersion = packageVersion
    )
)

val stageJpackageInput = registerStageJpackageInputTask(packagingSupport)
val prepareRuntimeImage = registerPrepareRuntimeImageTask(packagingSupport)
val packageAppImage = registerPackageAppImageTask(packagingSupport, stageJpackageInput, prepareRuntimeImage)
val packageAppImageFallback = registerPackageAppImageFallbackTask(packagingSupport, stageJpackageInput, prepareRuntimeImage)
val installAppImage = registerInstallAppImageTask(packagingSupport, packageAppImage, packageAppImageFallback)
val installDesktopEntries = registerInstallDesktopEntriesTask(packagingSupport, installAppImage)
registerInstallDesktopAppTask(installDesktopEntries)

val applicationTaskSupport = ApplicationTaskSupport(project)
val crawlerMonsters = registerCrawlerMonstersTask(applicationTaskSupport)
val importMonsters = registerImportMonstersTask(applicationTaskSupport, crawlerMonsters)
registerRecoverEncounterTablesTask(applicationTaskSupport)
registerSqliteQueryTask(applicationTaskSupport)
registerBackfillCreatureAnalysisTask(applicationTaskSupport)
registerRebuildCreatureAnalysisTask(applicationTaskSupport)
registerApplyCreatureOverridesTask(applicationTaskSupport)
val crawlerItems = registerCrawlerItemsTask(applicationTaskSupport)
val importItems = registerImportItemsTask(applicationTaskSupport, crawlerItems)
registerCrawlerItemsSlugsTask(applicationTaskSupport)
val crawlerSpells = registerCrawlerSpellsTask(applicationTaskSupport)
val importSpells = registerImportSpellsTask(applicationTaskSupport, crawlerSpells)
registerCrawlerSpellsSlugsTask(applicationTaskSupport)
registerCrawlerTask(importMonsters)
registerCrawlerItemsPipelineTask(importItems)
registerCrawlerSpellsPipelineTask(importSpells)

val checkNoCompiledArtifactsInSource = registerCheckNoCompiledArtifactsInSourceTask()
val checkNoStdStreamsInFeatureServicesAndRepositories = registerCheckNoStdStreamsInFeatureServicesAndRepositoriesTask()
val checkRepositorySqlExceptionConvention = registerCheckRepositorySqlExceptionConventionTask()
val checkUiAsyncSubmissionConvention = registerCheckUiAsyncSubmissionConventionTask()
val checkFeatureApiBoundaryConvention = registerCheckFeatureApiBoundaryConventionTask()

val ownerConventionSupport = OwnerConventionSupport(project)
val checkOwnerApiBoundarySourcePlacement = registerCheckOwnerApiBoundarySourcePlacementTask(ownerConventionSupport)
val checkOwnerApiBoundaryOwnerFiles = registerCheckOwnerApiBoundaryOwnerFilesTask(ownerConventionSupport)
val checkOwnerApiBoundaryInputFiles = registerCheckOwnerApiBoundaryInputFilesTask(ownerConventionSupport)
val checkOwnerApiBoundaryTaskFiles = registerCheckOwnerApiBoundaryTaskFilesTask(ownerConventionSupport)
val checkOwnerApiBoundaryStateFiles = registerCheckOwnerApiBoundaryStateFilesTask(ownerConventionSupport)
val checkOwnerApiBoundaryRepositoryFiles = registerCheckOwnerApiBoundaryRepositoryFilesTask(ownerConventionSupport)
val checkOwnerApiBoundaryConvention = registerCheckOwnerApiBoundaryConventionTask(
    checkOwnerApiBoundarySourcePlacement = checkOwnerApiBoundarySourcePlacement,
    checkOwnerApiBoundaryOwnerFiles = checkOwnerApiBoundaryOwnerFiles,
    checkOwnerApiBoundaryInputFiles = checkOwnerApiBoundaryInputFiles,
    checkOwnerApiBoundaryTaskFiles = checkOwnerApiBoundaryTaskFiles,
    checkOwnerApiBoundaryStateFiles = checkOwnerApiBoundaryStateFiles,
    checkOwnerApiBoundaryRepositoryFiles = checkOwnerApiBoundaryRepositoryFiles
)

val checkDungeonEditorArchitectureConvention = registerCheckDungeonEditorArchitectureConventionTask()
val checkDungeonGeometryConvention = registerCheckDungeonGeometryConventionTask()
val checkBuildHygiene = registerCheckBuildHygieneTask(checkNoCompiledArtifactsInSource)
val checkLocalBuildPolicies = registerCheckLocalBuildPoliciesTask(checkUiAsyncSubmissionConvention)
val checkArchitectureHeuristics = registerCheckArchitectureHeuristicsTask(
    checkOwnerApiBoundaryConvention = checkOwnerApiBoundaryConvention,
    checkDungeonGeometryConvention = checkDungeonGeometryConvention
)
registerCheckLegacyArchitectureGuardsTask(
    checkNoStdStreamsInFeatureServicesAndRepositories = checkNoStdStreamsInFeatureServicesAndRepositories,
    checkRepositorySqlExceptionConvention = checkRepositorySqlExceptionConvention,
    checkFeatureApiBoundaryConvention = checkFeatureApiBoundaryConvention,
    checkDungeonEditorArchitectureConvention = checkDungeonEditorArchitectureConvention
)
val checkConventions = registerCheckConventionsTask(
    checkBuildHygiene = checkBuildHygiene,
    checkLocalBuildPolicies = checkLocalBuildPolicies,
    checkArchitectureHeuristics = checkArchitectureHeuristics
)
val deleteEmptySourceDirectories = registerDeleteEmptySourceDirectoriesTask()

tasks.named("check") {
    dependsOn(checkConventions)
}

tasks.named("build") {
    dependsOn(deleteEmptySourceDirectories)
}
