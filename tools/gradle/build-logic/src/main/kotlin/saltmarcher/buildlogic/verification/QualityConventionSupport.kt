package saltmarcher.buildlogic.verification

import java.io.File
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the
import org.gradle.language.base.plugins.LifecycleBasePlugin
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.api.tasks.Sync
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.CheckDesktopPackagingInputsTask
import saltmarcher.buildlogic.tasks.CheckNoCompiledArtifactsTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.hygiene.CkjmReportTask
import saltmarcher.buildlogic.tasks.hygiene.CpdCheckTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantAnalyzeTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantCommandTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantScanTask
import saltmarcher.buildlogic.tasks.hygiene.LizardCheckTask
import saltmarcher.buildlogic.tasks.hygiene.PmdSourceCheckTask
import saltmarcher.buildlogic.tasks.hygiene.SetupLizardTask

private const val DefaultJqassistantVersion = "2.9.1"

internal data class QualityConventionEnvironment(
    val enforcementBundles: EnforcementBundlesExtension,
    val focusedEnforcementBundleMode: Boolean,
    val sourceSets: SourceSetContainer,
    val mainSourceSet: SourceSet,
    val sourceRoots: FileCollection,
    val sourceJavaRoots: FileCollection,
    val mainJavaClassesDir: Provider<Directory>,
    val commonFocusedArchunitSupportIncludes: List<String>,
    val desktopIconSourceRelativePathProvider: Provider<String>,
    val desktopEntryIconRelativePathProvider: Provider<String>,
    val windowIconRelativePathProvider: Provider<String>,
    val launcherNameProvider: Provider<String>,
    val mainClassNameProvider: Provider<String>,
    val preloaderClassNameProvider: Provider<String>,
    val startupWmClassProvider: Provider<String>,
    val stylesheetRelativePathProvider: Provider<String>,
    val jqassistantVersion: String,
    val jqassistantCliFile: Provider<org.gradle.api.file.RegularFile>,
    val jqassistantJvmOpens: String
)

internal data class QualityConventionToolConfigurations(
    val cpdCli: String,
    val pmdCli: String,
    val ckjmToolClasspath: String,
    val jqassistantDistribution: String
)

internal data class QualityConventionJqassistantTasks(
    val installJqassistant: TaskProvider<Sync>,
    val checkViewArchitecture: TaskProvider<out Task>
)

internal fun Project.createQualityConventionEnvironment(
    enforcementBundles: EnforcementBundlesExtension
): QualityConventionEnvironment {
    val desktopIconSourceRelativePathProvider = providers.gradleProperty("saltMarcherDesktopIconSource")
        .orElse("icons/salt-marcher.svg")
    val desktopEntryIconRelativePathProvider = providers.gradleProperty("saltMarcherDesktopEntryIcon")
        .orElse(desktopIconSourceRelativePathProvider)
    val windowIconRelativePathProvider = providers.gradleProperty("saltMarcherWindowIcon")
        .orElse("icons/salt-marcher.png")
    val launcherNameProvider = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
    val mainClassNameProvider = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
    val preloaderClassNameProvider = providers.gradleProperty("saltMarcherPreloaderClass")
        .orElse("bootstrap.SaltMarcherPreloader")
    val startupWmClassProvider = providers.gradleProperty("saltMarcherStartupWmClass")
        .orElse("bootstrap.SaltMarcherApp")
    val stylesheetRelativePathProvider = providers.gradleProperty("saltMarcherStylesheet")
        .orElse("resources/salt-marcher.css")
    val jqassistantVersion = providers.gradleProperty("saltMarcherJqassistantVersion").orNull ?: DefaultJqassistantVersion
    val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
    val jqassistantCliFile = jqassistantInstallDir.map { installDir ->
        installDir.file("jqassistant-commandline-neo4jv5-$jqassistantVersion/bin/jqassistant")
    }
    val sourceRoots = files("bootstrap", "shell", "src")
    val sourceJavaRoots = sourceRoots.filter(File::exists)
    val sourceSets = the<SourceSetContainer>()
    val mainSourceSet = sourceSets["main"]
    val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap(JavaCompile::getDestinationDirectory)
    val commonFocusedArchunitSupportIncludes = listOf(
        "architecture/AnalyzeMainClasses.java",
        "architecture/MainSourceLocationProvider.java",
        "architecture/view/ViewRolePredicates.java"
    )
    val jqassistantJvmOpens = listOf(
        "--add-opens", "java.base/java.lang=ALL-UNNAMED",
        "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
        "--add-opens", "java.base/java.io=ALL-UNNAMED",
        "--add-opens", "java.base/java.nio=ALL-UNNAMED"
    ).joinToString(" ")

    return QualityConventionEnvironment(
        enforcementBundles = enforcementBundles,
        focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode,
        sourceSets = sourceSets,
        mainSourceSet = mainSourceSet,
        sourceRoots = sourceRoots,
        sourceJavaRoots = sourceJavaRoots,
        mainJavaClassesDir = mainJavaClassesDir,
        commonFocusedArchunitSupportIncludes = commonFocusedArchunitSupportIncludes,
        desktopIconSourceRelativePathProvider = desktopIconSourceRelativePathProvider,
        desktopEntryIconRelativePathProvider = desktopEntryIconRelativePathProvider,
        windowIconRelativePathProvider = windowIconRelativePathProvider,
        launcherNameProvider = launcherNameProvider,
        mainClassNameProvider = mainClassNameProvider,
        preloaderClassNameProvider = preloaderClassNameProvider,
        startupWmClassProvider = startupWmClassProvider,
        stylesheetRelativePathProvider = stylesheetRelativePathProvider,
        jqassistantVersion = jqassistantVersion,
        jqassistantCliFile = jqassistantCliFile,
        jqassistantJvmOpens = jqassistantJvmOpens
    )
}

internal fun Project.registerQualityConventionToolConfigurations(): QualityConventionToolConfigurations {
    fun createToolConfiguration(name: String): String {
        configurations.create(name).apply {
            isCanBeConsumed = false
        }
        return name
    }

    return QualityConventionToolConfigurations(
        cpdCli = createToolConfiguration("cpdCli"),
        pmdCli = createToolConfiguration("pmdCli"),
        ckjmToolClasspath = createToolConfiguration("ckjmToolClasspath"),
        jqassistantDistribution = createToolConfiguration("jqassistantDistribution")
    )
}

internal fun Project.registerQualityConventionDependencies(
    toolConfigurations: QualityConventionToolConfigurations,
    environment: QualityConventionEnvironment
) {
    dependencies {
        add("errorprone", "com.google.errorprone:error_prone_core:2.48.0")
        add("errorprone", "com.uber.nullaway:nullaway:0.13.1")
        add("errorprone", "saltmarcher.quality:quality-rules-errorprone:1.0-SNAPSHOT")
        add(toolConfigurations.cpdCli, "net.sourceforge.pmd:pmd-cli:7.23.0")
        add(toolConfigurations.cpdCli, "net.sourceforge.pmd:pmd-java:7.23.0")
        add(toolConfigurations.pmdCli, "net.sourceforge.pmd:pmd-cli:7.23.0")
        add(toolConfigurations.pmdCli, "net.sourceforge.pmd:pmd-java:7.23.0")
        add(toolConfigurations.ckjmToolClasspath, "gr.spinellis.ckjm:ckjm_ext:2.10")
        add(toolConfigurations.ckjmToolClasspath, "org.apache.bcel:bcel:6.11.0")
        add(toolConfigurations.ckjmToolClasspath, "org.apache.ant:ant:1.10.15")
        add(toolConfigurations.ckjmToolClasspath, "org.apache.commons:commons-math3:3.6.1")
        add(
            toolConfigurations.jqassistantDistribution,
            "com.buschmais.jqassistant.cli:jqassistant-commandline-neo4jv5:${environment.jqassistantVersion}:distribution@zip"
        )
    }
}

internal fun Project.applyCommonErrorProneOptions(task: JavaCompile) {
    with(task) {
        dependsOn(gradle.includedBuild("quality-rules-errorprone").task(":jar"))
        options.errorprone.enabled.set(true)
        options.errorprone.disableWarningsInGeneratedCode.set(true)
        options.errorprone.disable("DuplicateBranches")
        options.errorprone.disable("StringConcatToTextBlock")
        options.errorprone.disable("ThreadJoinLoop")
        options.errorprone.error("EqualsNull")
        options.errorprone.error("NullAway")
        options.errorprone.error("ReferenceEquality")
        options.errorprone.error("StringCaseLocaleUsage")
        options.errorprone.error("StringSplitter")
        options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
        options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
    }
}

internal fun Project.registerQualityConventionJqassistantTasks(
    environment: QualityConventionEnvironment,
    toolConfigurations: QualityConventionToolConfigurations
): QualityConventionJqassistantTasks {
    val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
    val jqassistantSourceConfigFile = layout.projectDirectory.file("tools/quality/jqassistant/config.yml")
    val jqassistantRulesDir = layout.projectDirectory.dir("tools/quality/jqassistant/rules")
    val jqassistantCheckStoreDir = layout.buildDirectory.dir("tools/jqassistant/check-view-architecture-store")
    val jqassistantReportsDir = layout.buildDirectory.dir("reports/jqassistant")
    val installJqassistant = tasks.register<Sync>("installJqassistant") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Install the jQAssistant command-line distribution into the build directory."
        from({
            configurations.getByName(toolConfigurations.jqassistantDistribution).resolve().map { zipTree(it) }
        })
        into(jqassistantInstallDir)
    }
    val jqassistantScanViewArchitecture = tasks.register<JqassistantScanTask>("jqassistantScanViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Scan SaltMarcher bytecode and source topology for view-architecture analysis."
        dependsOn(installJqassistant, tasks.named("classes"))
        cliFile.set(environment.jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(environment.mainJavaClassesDir)
        sourceRoots.from(environment.sourceJavaRoots)
        jvmOpens.set(environment.jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        storeDirectory.set(jqassistantCheckStoreDir)
    }
    val jqassistantAnalyzeViewArchitecture = tasks.register<JqassistantAnalyzeTask>("jqassistantAnalyzeViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Analyze SaltMarcher passive-view topology constraints with jQAssistant."
        dependsOn(jqassistantScanViewArchitecture)
        cliFile.set(environment.jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(environment.mainJavaClassesDir)
        sourceRoots.from(environment.sourceJavaRoots)
        jvmOpens.set(environment.jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        storeDirectory.set(jqassistantCheckStoreDir)
        reportsDirectory.set(jqassistantReportsDir)
    }
    tasks.register<JqassistantCommandTask>("jqassistantEffectiveRules") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Print the effective SaltMarcher passive-view topology rules."
        dependsOn(installJqassistant)
        cliFile.set(environment.jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(environment.mainJavaClassesDir)
        sourceRoots.from(environment.sourceJavaRoots)
        jvmOpens.set(environment.jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        commandName.set("effective-rules")
    }
    val checkViewArchitecture = tasks.register("checkViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the canonical SaltMarcher cockpit view-architecture topology blocker via jQAssistant."
        dependsOn(jqassistantAnalyzeViewArchitecture)
    }
    tasks.register<JqassistantCommandTask>("jqassistantServer") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Start the local jQAssistant Neo4j server for passive-view topology rule development."
        dependsOn(installJqassistant, tasks.named("classes"))
        cliFile.set(environment.jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(environment.mainJavaClassesDir)
        sourceRoots.from(environment.sourceJavaRoots)
        jvmOpens.set(environment.jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        commandName.set("server")
    }
    return QualityConventionJqassistantTasks(
        installJqassistant = installJqassistant,
        checkViewArchitecture = checkViewArchitecture
    )
}

internal fun Project.registerQualityConventionHarness(
    environment: QualityConventionEnvironment,
    jqassistantTasks: QualityConventionJqassistantTasks,
    lifecycleTasks: QualityConventionLifecycleTasks
): VerificationHarnessExtension {
    val harness = VerificationHarnessExtension(
        project = this,
        enforcementBundles = environment.enforcementBundles,
        sourceSets = environment.sourceSets,
        mainSourceSet = environment.mainSourceSet,
        sourceJavaRoots = environment.sourceJavaRoots,
        commonFocusedArchunitSupportIncludes = environment.commonFocusedArchunitSupportIncludes,
        jqassistantCliFile = environment.jqassistantCliFile,
        jqassistantJvmOpens = environment.jqassistantJvmOpens,
        installJqassistant = jqassistantTasks.installJqassistant,
        configureCommonErrorProneOptions = { applyCommonErrorProneOptions(this) },
        productionBuild = lifecycleTasks.productionBuild,
        checkQualityHygiene = lifecycleTasks.checkQualityHygiene,
        checkArchitecture = lifecycleTasks.checkArchitecture,
        checkViewArchitecture = jqassistantTasks.checkViewArchitecture,
        ckjmMain = lifecycleTasks.ckjmMain,
        check = lifecycleTasks.check
    )
    extensions.add(VerificationHarnessExtension::class.java, "saltmarcherVerificationHarness", harness)
    return harness
}

internal data class QualityConventionLifecycleTasks(
    val productionBuild: TaskProvider<out Task>,
    val checkQualityHygiene: TaskProvider<out Task>,
    val checkArchitecture: TaskProvider<out Task>,
    val ckjmMain: TaskProvider<out Task>,
    val check: TaskProvider<out Task>
)

internal fun Project.registerQualityConventionLifecycleTasks(
    environment: QualityConventionEnvironment,
    toolConfigurations: QualityConventionToolConfigurations,
    checkViewArchitecture: TaskProvider<out Task>
): QualityConventionLifecycleTasks {
    val resetMainJavaClassesOutput = tasks.register<Delete>("resetMainJavaClassesOutput") {
        description = "Remove compiled main classes before recompilation so deleted sources cannot survive as stale bytecode."
        delete(environment.mainJavaClassesDir)
    }
    val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
    val lizardRequirementsFile = layout.projectDirectory.file("tools/quality/config/lizard/requirements.txt")
    val lizardVenvDir = layout.projectDirectory.dir(".gradle/shared-tools/lizard/venv")
    val lizardReadyMarker = layout.projectDirectory.file(".gradle/shared-tools/lizard/venv/.lizard-ready")
    val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
    val ckjmBaselineFile = layout.projectDirectory.file("tools/quality/config/ckjm/baseline.tsv")
    val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
    val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")

    tasks.named<JavaCompile>("compileJava") {
        dependsOn(resetMainJavaClassesOutput)
    }

    val renderDesktopIconPng = tasks.register<RenderDesktopIconTask>("renderDesktopIconPng") {
        group = "distribution"
        description = "Render the generated runtime PNG icon from the canonical SVG source."
        projectRoot.set(layout.projectDirectory)
        sourceFile.set(layout.projectDirectory.file(environment.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        outputDirectory.set(generatedWindowIconDir)
        outputRelativePath.set(environment.windowIconRelativePathProvider)
        commandName.set("magick")
    }

    tasks.named<ProcessResources>("processResources") {
        if (!environment.focusedEnforcementBundleMode) {
            dependsOn(renderDesktopIconPng)
            from(renderDesktopIconPng.flatMap { task -> task.outputDirectory })
        }
    }

    val setupLizard = tasks.register<SetupLizardTask>("setupLizard") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Create a build-local Python environment with the pinned Lizard version."
        projectRoot.set(layout.projectDirectory)
        requirementsFile.set(lizardRequirementsFile)
        venvDirectory.set(lizardVenvDir)
        readyMarker.set(lizardReadyMarker)
        pythonCommand.set("python3")
    }

    val lizardMain = tasks.register<LizardCheckTask>("lizardMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run Lizard complexity checks against production Java sources."
        dependsOn(setupLizard)
        projectRoot.set(layout.projectDirectory)
        venvDirectory.set(lizardVenvDir)
        requirementsMarker.set(lizardReadyMarker)
        sourceRoots.from(environment.sourceJavaRoots)
        maxCyclomaticComplexity.set(15)
        reportFile.set(layout.buildDirectory.file("reports/lizard/main.txt"))
    }

    val cpdMain = tasks.register<CpdCheckTask>("cpdMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run PMD CPD duplicate-code checks against production Java sources."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(environment.sourceJavaRoots)
        toolClasspath.from(configurations.named(toolConfigurations.cpdCli))
        minimumTokens.set(100)
        reportFile.set(cpdReportFile)
    }

    val pmdStrictMain = tasks.register<PmdSourceCheckTask>("pmdStrictMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run strict PMD source-smell checks against production Java sources."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(
            layout.projectDirectory.dir("bootstrap"),
            layout.projectDirectory.dir("shell"),
            layout.projectDirectory.dir("src")
        )
        toolClasspath.from(configurations.named(toolConfigurations.pmdCli))
        auxClasspath.from(configurations.named("compileClasspath"))
        rulesetFiles.from(
            layout.projectDirectory.file("tools/quality/config/pmd/complexity-ruleset.xml"),
            layout.projectDirectory.file("tools/quality/config/pmd/law-of-demeter-ruleset.xml")
        )
        reportFile.set(layout.buildDirectory.file("reports/pmd/main-strict.txt"))
    }

    tasks.named<Pmd>("pmdMain") {
        source = environment.sourceJavaRoots.asFileTree
        include("**/*.java")
        classpath = files(configurations.named("compileClasspath"))
    }

    tasks.named<Pmd>("pmdTest") {
        enabled = false
    }

    val ckjmMain = tasks.register<CkjmReportTask>("ckjmMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run CKJM ext OO metrics against compiled production classes and write reports."
        dependsOn(tasks.named("classes"))
        projectRoot.set(layout.projectDirectory)
        compiledClasses.from(environment.mainJavaClassesDir)
        toolClasspath.from(configurations.named(toolConfigurations.ckjmToolClasspath))
        runtimeClasspath.from(configurations.named("runtimeClasspath"))
        baselineFile.set(ckjmBaselineFile)
        reportFile.set(ckjmReportFile)
        summaryFile.set(ckjmSummaryFile)
    }

    val productionBuild = tasks.register("productionBuild") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the staged production build surface without the broader repository quality aggregates."
        dependsOn("assemble")
        dependsOn("test")
    }

    val checkNoCompiledArtifactsInSource = tasks.register<CheckNoCompiledArtifactsTask>("checkNoCompiledArtifactsInSource") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Fail if compiled .class artifacts are present in bootstrap/, shell/ or src/."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(environment.sourceJavaRoots)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkNoCompiledArtifactsInSource/success.marker"))
    }

    val checkQualityHygiene = tasks.register("checkQualityHygiene") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the staged non-architecture hygiene gates without the architecture or view-topology aggregates."
        dependsOn(tasks.named("pmdMain"))
        dependsOn(tasks.named("spotbugsMain"))
        dependsOn(cpdMain)
        dependsOn(lizardMain)
        dependsOn(checkNoCompiledArtifactsInSource)
        dependsOn(pmdStrictMain)
    }

    val checkArchitecture = tasks.register("checkArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Runs non-documentation architecture checks from ArchUnit, PMD architecture rules, and the external build harness."
        dependsOn("architectureTest")
        dependsOn("pmdArchitectureMain")
        dependsOn(gradle.includedBuild("build-harness").task(":architectureCheck"))
    }

    tasks.register<CheckDesktopPackagingInputsTask>("checkDesktopPackagingInputs") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Validate main class, icon, stylesheet, and launcher metadata required for desktop packaging."
        mainClassSourceFile.set(layout.projectDirectory.file(environment.mainClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        preloaderClassSourceFile.set(layout.projectDirectory.file(environment.preloaderClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        desktopIconSourceFile.set(layout.projectDirectory.file(environment.desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        stylesheetFile.set(layout.projectDirectory.file(environment.stylesheetRelativePathProvider))
        mainClassName.set(environment.mainClassNameProvider)
        preloaderClassName.set(environment.preloaderClassNameProvider)
        desktopIconSourceRelativePath.set(environment.desktopIconSourceRelativePathProvider)
        desktopEntryIconRelativePath.set(environment.desktopEntryIconRelativePathProvider)
        windowIconRelativePath.set(environment.windowIconRelativePathProvider)
        stylesheetRelativePath.set(environment.stylesheetRelativePathProvider)
        launcherName.set(environment.launcherNameProvider)
        startupWmClass.set(environment.startupWmClassProvider)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDesktopPackagingInputs/success.marker"))
    }

    val check = tasks.named("check") {
        dependsOn(productionBuild)
        dependsOn(checkArchitecture)
        dependsOn(checkViewArchitecture)
        dependsOn(checkQualityHygiene)
        dependsOn(ckjmMain)
    }

    tasks.withType(Pmd::class.java).configureEach {
        reports {
            html.required.set(true)
            xml.required.set(true)
        }
    }

    return QualityConventionLifecycleTasks(
        productionBuild = productionBuild,
        checkQualityHygiene = checkQualityHygiene,
        checkArchitecture = checkArchitecture,
        ckjmMain = ckjmMain,
        check = check
    )
}
