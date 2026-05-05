package saltmarcher.buildlogic.verification

import java.io.File
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder
import org.gradle.kotlin.dsl.withType
import org.gradle.language.base.plugins.LifecycleBasePlugin
import org.gradle.language.jvm.tasks.ProcessResources
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

class SaltmarcherQualityConventionsPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.pluginManager.apply("net.ltgt.errorprone")
        project.configureQualityConventions()
    }
}

internal fun Project.configureQualityConventions() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode

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
    val jqassistantVersionProvider = providers.gradleProperty("saltMarcherJqassistantVersion")
        .orElse("2.9.1")
    val sourceRoots = files("bootstrap", "shell", "src")
    val sourceJavaRoots = sourceRoots.filter(File::exists)
    val sourceSets = the<org.gradle.api.tasks.SourceSetContainer>()
    val mainSourceSet = sourceSets["main"]
    val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap(JavaCompile::getDestinationDirectory)
    val resetMainJavaClassesOutput = tasks.register<Delete>("resetMainJavaClassesOutput") {
        description = "Remove compiled main classes before recompilation so deleted sources cannot survive as stale bytecode."
        delete(mainJavaClassesDir)
    }
    val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
    val lizardRequirementsFile = layout.projectDirectory.file("tools/quality/config/lizard/requirements.txt")
    val lizardVenvDir = layout.projectDirectory.dir(".gradle/shared-tools/lizard/venv")
    val lizardReadyMarker = layout.projectDirectory.file(".gradle/shared-tools/lizard/venv/.lizard-ready")
    val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
    val ckjmBaselineFile = layout.projectDirectory.file("tools/quality/config/ckjm/baseline.tsv")
    val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
    val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")
    val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
    val jqassistantHomeDir = jqassistantInstallDir.map {
        it.dir("jqassistant-commandline-neo4jv5-${jqassistantVersionProvider.get()}")
    }
    val jqassistantCliFile = jqassistantHomeDir.map { it.file("bin/jqassistant") }
    val jqassistantSourceConfigFile = layout.projectDirectory.file("tools/quality/jqassistant/config.yml")
    val jqassistantRulesDir = layout.projectDirectory.dir("tools/quality/jqassistant/rules")
    val jqassistantCheckStoreDir = layout.buildDirectory.dir("tools/jqassistant/check-view-architecture-store")
    val jqassistantReportsDir = layout.buildDirectory.dir("reports/jqassistant")
    val jqassistantJvmOpens = listOf(
        "--add-opens", "java.base/java.lang=ALL-UNNAMED",
        "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
        "--add-opens", "java.base/java.io=ALL-UNNAMED",
        "--add-opens", "java.base/java.nio=ALL-UNNAMED"
    ).joinToString(" ")

    fun JavaCompile.configureCommonErrorProneOptions() {
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

    val commonFocusedArchunitSupportIncludes = listOf(
        "architecture/AnalyzeMainClasses.java",
        "architecture/MainSourceLocationProvider.java",
        "architecture/view/ViewRolePredicates.java"
    )

    val cpdCli = configurations.create("cpdCli").apply {
        isCanBeConsumed = false
    }
    val pmdCli = configurations.create("pmdCli").apply {
        isCanBeConsumed = false
    }
    val ckjmToolClasspath = configurations.create("ckjmToolClasspath").apply {
        isCanBeConsumed = false
    }
    val jqassistantDistribution = configurations.create("jqassistantDistribution").apply {
        isCanBeConsumed = false
    }

    dependencies {
        add("errorprone", "com.google.errorprone:error_prone_core:2.48.0")
        add("errorprone", "com.uber.nullaway:nullaway:0.13.1")
        add("errorprone", "saltmarcher.quality:quality-rules-errorprone:1.0-SNAPSHOT")
        add("cpdCli", "net.sourceforge.pmd:pmd-cli:7.23.0")
        add("cpdCli", "net.sourceforge.pmd:pmd-java:7.23.0")
        add("pmdCli", "net.sourceforge.pmd:pmd-cli:7.23.0")
        add("pmdCli", "net.sourceforge.pmd:pmd-java:7.23.0")
        add("ckjmToolClasspath", "gr.spinellis.ckjm:ckjm_ext:2.10")
        add("ckjmToolClasspath", "org.apache.bcel:bcel:6.11.0")
        add("ckjmToolClasspath", "org.apache.ant:ant:1.10.15")
        add("ckjmToolClasspath", "org.apache.commons:commons-math3:3.6.1")
        add(
            "jqassistantDistribution",
            "com.buschmais.jqassistant.cli:jqassistant-commandline-neo4jv5:${jqassistantVersionProvider.get()}:distribution@zip"
        )
    }

    tasks.withType<JavaCompile>().configureEach {
        options.errorprone.enabled.set(false)
    }

    tasks.named<JavaCompile>("compileJava") {
        dependsOn(resetMainJavaClassesOutput)
        configureCommonErrorProneOptions()
        options.errorprone.error("UnusedLabel")
        options.errorprone.error("UnusedMethod")
        options.errorprone.error("UnusedNestedClass")
        options.errorprone.error("UnusedVariable")
        if (!focusedEnforcementBundleMode) {
            options.errorprone.error("DomainApplicationServiceApiShape")
            options.errorprone.error("DomainModuleFieldPurity")
            options.errorprone.error("DomainPortBoundary")
            options.errorprone.error("DomainPortRoleShape")
            options.errorprone.error("DomainPublicBoundarySignaturePurity")
            options.errorprone.error("DomainPublicConcreteTypeShape")
            options.errorprone.error("DomainRoleShape")
            options.errorprone.error("ServiceRegistryRegistrationPlacement")
            options.errorprone.error("ViewContributionShellApiAllowlist")
            options.errorprone.error("ViewDetailsSlotBoundary")
            options.errorprone.error("ProjectionModelOwnershipNaming")
            options.errorprone.error("ViewReflectionBypass")
            options.errorprone.error("ViewRootDelegation")
        }
    }

    val installJqassistant = tasks.register<Sync>("installJqassistant") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Install the jQAssistant command-line distribution into the build directory."
        from({
            jqassistantDistribution.resolve().map { zipTree(it) }
        })
        into(jqassistantInstallDir)
    }

    val verificationTooling = VerificationToolingExtension(
        project = this,
        enforcementBundles = enforcementBundles,
        sourceSets = sourceSets,
        mainSourceSet = mainSourceSet,
        sourceJavaRoots = sourceJavaRoots,
        commonFocusedArchunitSupportIncludes = commonFocusedArchunitSupportIncludes,
        jqassistantCliFile = jqassistantCliFile,
        jqassistantJvmOpens = jqassistantJvmOpens,
        installJqassistant = installJqassistant,
        configureCommonErrorProneOptions = JavaCompile::configureCommonErrorProneOptions
    )
    extensions.add(VerificationToolingExtension::class.java, "saltmarcherVerificationTooling", verificationTooling)

    val jqassistantScanViewArchitecture = tasks.register<JqassistantScanTask>("jqassistantScanViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Scan SaltMarcher bytecode and source topology for view-architecture analysis."
        dependsOn(installJqassistant, tasks.named("classes"))
        cliFile.set(jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(mainJavaClassesDir)
        sourceRoots.from(sourceJavaRoots)
        jvmOpens.set(jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        storeDirectory.set(jqassistantCheckStoreDir)
    }

    val jqassistantAnalyzeViewArchitecture = tasks.register<JqassistantAnalyzeTask>("jqassistantAnalyzeViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Analyze SaltMarcher passive-view topology constraints with jQAssistant."
        dependsOn(jqassistantScanViewArchitecture)
        cliFile.set(jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(mainJavaClassesDir)
        sourceRoots.from(sourceJavaRoots)
        jvmOpens.set(jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        storeDirectory.set(jqassistantCheckStoreDir)
        reportsDirectory.set(jqassistantReportsDir)
    }

    tasks.register<JqassistantCommandTask>("jqassistantEffectiveRules") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Print the effective SaltMarcher passive-view topology rules."
        dependsOn(installJqassistant)
        cliFile.set(jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(mainJavaClassesDir)
        sourceRoots.from(sourceJavaRoots)
        jvmOpens.set(jqassistantJvmOpens)
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
        cliFile.set(jqassistantCliFile)
        sourceConfigFile.set(jqassistantSourceConfigFile)
        rulesDirectory.set(jqassistantRulesDir)
        mainClassesDirectory.set(mainJavaClassesDir)
        sourceRoots.from(sourceJavaRoots)
        jvmOpens.set(jqassistantJvmOpens)
        projectRoot.set(layout.projectDirectory)
        commandName.set("server")
    }

    val renderDesktopIconPng = tasks.register<RenderDesktopIconTask>("renderDesktopIconPng") {
        group = "distribution"
        description = "Render the generated runtime PNG icon from the canonical SVG source."
        projectRoot.set(layout.projectDirectory)
        sourceFile.set(layout.projectDirectory.file("resources/${desktopIconSourceRelativePathProvider.get()}"))
        outputDirectory.set(generatedWindowIconDir)
        outputRelativePath.set(windowIconRelativePathProvider)
        commandName.set("magick")
    }

    tasks.named<ProcessResources>("processResources") {
        if (!focusedEnforcementBundleMode) {
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
        sourceRoots.from(sourceJavaRoots)
        maxCyclomaticComplexity.set(15)
        reportFile.set(layout.buildDirectory.file("reports/lizard/main.txt"))
    }

    val cpdMain = tasks.register<CpdCheckTask>("cpdMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run PMD CPD duplicate-code checks against production Java sources."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(sourceJavaRoots)
        toolClasspath.from(cpdCli)
        minimumTokens.set(100)
        reportFile.set(cpdReportFile)
    }

    val pmdStrictMain = tasks.register<PmdSourceCheckTask>("pmdStrictMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run strict PMD source-smell checks against production Java sources."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(sourceJavaRoots)
        toolClasspath.from(pmdCli)
        auxClasspath.from(configurations.named("compileClasspath"))
        rulesetFile.set(layout.projectDirectory.file("tools/quality/config/pmd/complexity-ruleset.xml"))
        reportFile.set(layout.buildDirectory.file("reports/pmd/main-strict.txt"))
    }

    tasks.named<Pmd>("pmdMain") {
        source = sourceJavaRoots.asFileTree
        include("**/*.java")
        classpath = configurations.named("compileClasspath").get()
    }

    tasks.named<Pmd>("pmdTest") {
        enabled = false
    }

    val ckjmMain = tasks.register<CkjmReportTask>("ckjmMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run CKJM ext OO metrics against compiled production classes and write reports."
        dependsOn(tasks.named("classes"))
        projectRoot.set(layout.projectDirectory)
        compiledClasses.from(mainJavaClassesDir)
        toolClasspath.from(ckjmToolClasspath)
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
        sourceRoots.from(sourceJavaRoots)
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
        mainClassSourceFile.set(layout.projectDirectory.file(mainClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        preloaderClassSourceFile.set(layout.projectDirectory.file(preloaderClassNameProvider.map { "${it.replace('.', '/')}.java" }))
        desktopIconSourceFile.set(layout.projectDirectory.file(desktopIconSourceRelativePathProvider.map { "resources/$it" }))
        stylesheetFile.set(layout.projectDirectory.file(stylesheetRelativePathProvider))
        mainClassName.set(mainClassNameProvider)
        preloaderClassName.set(preloaderClassNameProvider)
        desktopIconSourceRelativePath.set(desktopIconSourceRelativePathProvider)
        desktopEntryIconRelativePath.set(desktopEntryIconRelativePathProvider)
        windowIconRelativePath.set(windowIconRelativePathProvider)
        stylesheetRelativePath.set(stylesheetRelativePathProvider)
        launcherName.set(launcherNameProvider)
        startupWmClass.set(startupWmClassProvider)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDesktopPackagingInputs/success.marker"))
    }

    tasks.named("check") {
        dependsOn(productionBuild)
        dependsOn(checkArchitecture)
        dependsOn(checkViewArchitecture)
        dependsOn(checkQualityHygiene)
        dependsOn(ckjmMain)
    }

    val verificationLifecycle = VerificationLifecycleExtension(
        productionBuild = productionBuild,
        checkQualityHygiene = checkQualityHygiene,
        checkArchitecture = checkArchitecture,
        checkViewArchitecture = checkViewArchitecture,
        ckjmMain = ckjmMain,
        check = tasks.named("check")
    )
    extensions.add(VerificationLifecycleExtension::class.java, "saltmarcherVerificationLifecycle", verificationLifecycle)

    tasks.named<Pmd>("pmdArchitectureMain") {
        dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
    }

    tasks.withType<Pmd>().configureEach {
        reports {
            html.required.set(true)
            xml.required.set(true)
        }
    }
}
