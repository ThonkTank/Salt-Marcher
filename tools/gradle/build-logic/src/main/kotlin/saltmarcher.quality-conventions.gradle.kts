import java.io.File
import java.util.UUID
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Task
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.process.ExecSpec
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckDesktopPackagingInputsTask
import saltmarcher.buildlogic.tasks.CheckNoCompiledArtifactsTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.hygiene.CkjmReportTask
import saltmarcher.buildlogic.tasks.hygiene.CpdCheckTask
import saltmarcher.buildlogic.tasks.hygiene.LizardCheckTask
import saltmarcher.buildlogic.tasks.hygiene.PmdSourceCheckTask
import saltmarcher.buildlogic.tasks.hygiene.SetupLizardTask

plugins {
    id("net.ltgt.errorprone")
}

// Invocation policy

val architectureGateEntrypoints = setOf(
    "architectureTest",
    "checkArchitecture",
    "checkViewContentModelEnforcement",
    "checkViewContributionModelEnforcement",
    "checkViewContributionEnforcement",
    "checkViewBinderEnforcement",
    "checkViewEnforcement",
    "checkViewInspectorEntryEnforcement",
    "checkViewIntentHandlerEnforcement",
    "checkViewLayerEnforcement",
    "checkViewInputEventEnforcement",
    "checkViewPublishedEventEnforcement",
    "checkViewArchitecture",
    "pmdArchitectureMain",
    "pmdViewContributionEnforcement",
    "jqassistantEffectiveRules"
)

val qualitySmellEntrypoints = setOf(
    "pmdMain",
    "pmdStrictMain",
    "spotbugsMain",
    "ckjmMain"
)

val qualityGateEntrypoints = setOf(
    "cpdMain",
    "lizardMain"
)

val resourcePolicyEntrypoints = setOf(
    "checkCentralizedStylesheets",
    "checkDefinedStyleClassSelectors",
    "checkNoCompiledArtifactsInSource",
    "checkDesktopPackagingInputs"
)

val continueOnFailureEntrypoints = setOf(
    "build",
    "check",
    "compileJava",
    "test"
)
    .plus(architectureGateEntrypoints)
    .plus(qualitySmellEntrypoints)
    .plus(qualityGateEntrypoints)
    .plus(resourcePolicyEntrypoints)

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

if (requestedTaskNames.any { it in continueOnFailureEntrypoints }) {
    gradle.startParameter.setContinueOnFailure(true)
}

val freshGateResultReason = "Quality and architecture gate diagnostics must be produced by the current invocation."

fun Task.enforceFreshGateResult() {
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf(freshGateResultReason) { true }
}

// Shared project inputs and tool locations

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
    .orElse("salt-marcher.css")
val jqassistantVersionProvider = providers.gradleProperty("saltMarcherJqassistantVersion")
    .orElse("2.9.1")
val stylesheetExtensions = listOf("css", "scss", "sass", "less", "styl")

val sourceRoots = files("bootstrap", "shell", "src")
val sourceJavaRoots = sourceRoots.filter { it.exists() }
val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }
val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
val lizardRequirementsFile = layout.projectDirectory.file("tools/quality/config/lizard/requirements.txt")
val lizardVenvDir = layout.buildDirectory.dir("tools/lizard-venv")
val lizardReadyMarker = layout.buildDirectory.file("tools/lizard-venv/.lizard-ready")
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
val jqassistantGeneratedConfigFile = layout.buildDirectory.file("tools/jqassistant/config.yml")
val jqassistantRulesDir = layout.projectDirectory.dir("tools/quality/jqassistant/rules")
val jqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-jqassistant-${UUID.randomUUID()}"
)
val jqassistantCheckStoreDir = layout.dir(providers.provider {
    jqassistantStoreRoot.resolve("check-view-architecture-store")
})
val jqassistantReportsDir = layout.buildDirectory.dir("reports/jqassistant")
val jqassistantJunitReportsDir = jqassistantReportsDir.map { it.dir("junit") }
val jqassistantJvmOpens = listOf(
    "--add-opens", "java.base/java.lang=ALL-UNNAMED",
    "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
    "--add-opens", "java.base/java.io=ALL-UNNAMED",
    "--add-opens", "java.base/java.nio=ALL-UNNAMED"
).joinToString(" ")

fun File.absoluteInvariantPath(): String {
    return absolutePath.replace(File.separatorChar, '/')
}

fun mainJavaClassesDirectoryForTooling(): File {
    return mainJavaClassesDir.get().asFile
}

// Tool configurations

val cpdCli by configurations.creating {
    isCanBeConsumed = false
}

val pmdCli by configurations.creating {
    isCanBeConsumed = false
}

val ckjmToolClasspath by configurations.creating {
    isCanBeConsumed = false
}

val jqassistantDistribution by configurations.creating {
    isCanBeConsumed = false
}

dependencies {
    errorprone("com.google.errorprone:error_prone_core:2.48.0")
    errorprone("com.uber.nullaway:nullaway:0.13.1")
    errorprone("saltmarcher.quality:quality-rules-errorprone:1.0-SNAPSHOT")

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

// Compiler hygiene and compiler-precise architecture gates

tasks.withType<JavaCompile>().configureEach {
    options.errorprone.enabled.set(false)
}

tasks.named<JavaCompile>("compileJava") {
    enforceFreshGateResult()
    dependsOn(gradle.includedBuild("quality-rules-errorprone").task(":jar"))
    options.errorprone.enabled.set(true)
    options.errorprone.disableWarningsInGeneratedCode.set(true)
    options.errorprone.disable("DuplicateBranches")
    options.errorprone.disable("StringConcatToTextBlock")
    options.errorprone.disable("ThreadJoinLoop")
    options.errorprone.error("EqualsNull")
    options.errorprone.error("DataAdapterGatewayCollaboratorBoundary")
    options.errorprone.error("DataAdapterPublicSignatureLeak")
    options.errorprone.error("DataAdapterRoleContract")
    options.errorprone.error("DataGatewayReturnTypeBoundary")
    options.errorprone.error("DataModelSourceShape")
    options.errorprone.error("DataQueryGatewayMutationBoundary")
    options.errorprone.error("DataServiceContributionConstructionPurity")
    options.errorprone.error("DomainApplicationNoSameContextPublishedDependency")
    options.errorprone.error("DomainApplicationServiceApiShape")
    options.errorprone.error("DomainForbiddenInfrastructureDependency")
    options.errorprone.error("DomainPublishedCarrierShape")
    options.errorprone.error("DomainModuleFieldPurity")
    options.errorprone.error("DomainModuleNoPublishedCarrierDependency")
    options.errorprone.error("DomainPortBoundary")
    options.errorprone.error("DomainPublicBoundarySignaturePurity")
    options.errorprone.error("DomainPublicConcreteTypeShape")
    options.errorprone.error("DomainRoleShape")
    options.errorprone.error("DomainServiceRegistryExportShape")
    options.errorprone.error("DomainServiceFactoryStatelessness")
    options.errorprone.error("FeatureShellApiAllowlist")
    options.errorprone.error("NullAway")
    options.errorprone.error("ReferenceEquality")
    options.errorprone.error("ServiceRegistryRegistrationPlacement")
    options.errorprone.error("ShellLifecycleHookOwnership")
    options.errorprone.error("StringCaseLocaleUsage")
    options.errorprone.error("StringSplitter")
    options.errorprone.error("ViewDetailsSlotBoundary")
    options.errorprone.error("ProjectionModelOwnershipNaming")
    options.errorprone.error("ViewContentModelDependencyBoundary")
    options.errorprone.error("ViewContentModelFlatSurface")
    options.errorprone.error("ViewProgrammaticStyling")
    options.errorprone.error("ViewReflectionBypass")
    options.errorprone.error("ViewRootDelegation")
    options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
    options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
}

// jQAssistant graph-shaped view architecture gate

fun ExecSpec.configureJqassistantInvocation(configFile: RegularFile, vararg arguments: String) {
    workingDir = layout.projectDirectory.asFile
    environment("JQASSISTANT_OPTS", jqassistantJvmOpens)
    commandLine(
        "/bin/bash",
        jqassistantCliFile.get().asFile.absolutePath,
        *arguments,
        "-C",
        configFile.asFile.absolutePath
    )
}

fun ExecSpec.configureJqassistantInvocation(
    configFile: RegularFile,
    storeDirectory: Directory,
    vararg arguments: String) {
    workingDir = layout.projectDirectory.asFile
    environment("JQASSISTANT_OPTS", jqassistantJvmOpens)
    commandLine(
        "/bin/bash",
        jqassistantCliFile.get().asFile.absolutePath,
        *arguments,
        "-C",
        configFile.asFile.absolutePath,
        "-D",
        "jqassistant.store.uri=file:${storeDirectory.asFile.absolutePath}"
    )
}

val installJqassistant by tasks.registering(Sync::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Install the jQAssistant command-line distribution into the build directory."
    from({
        jqassistantDistribution.resolve().map { zipTree(it) }
    })
    into(jqassistantInstallDir)
}

val prepareJqassistantConfig by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Materialize jQAssistant configuration with invocation-local build output paths."
    inputs.file(jqassistantSourceConfigFile)
    outputs.file(jqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDirectoryForTooling().absoluteInvariantPath()}"
        val generatedConfigText = jqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant/junit"
            )
        val generatedConfigFile = jqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewArchitecture by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Scan SaltMarcher bytecode and source topology for view-architecture analysis."
    enforceFreshGateResult()
    dependsOn(installJqassistant, prepareJqassistantConfig, tasks.named("classes"))
    inputs.file(jqassistantGeneratedConfigFile)
    inputs.dir(jqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(sourceJavaRoots)
    outputs.dir(jqassistantCheckStoreDir)
    doFirst {
        configureJqassistantInvocation(jqassistantGeneratedConfigFile.get(), jqassistantCheckStoreDir.get(), "scan")
    }
}

val jqassistantAnalyzeViewArchitecture by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Analyze SaltMarcher passive-view topology constraints with jQAssistant."
    enforceFreshGateResult()
    dependsOn(jqassistantScanViewArchitecture)
    inputs.file(jqassistantGeneratedConfigFile)
    inputs.dir(jqassistantRulesDir)
    outputs.dir(jqassistantReportsDir)
    doFirst {
        delete(jqassistantReportsDir)
        delete(layout.buildDirectory.dir("reports/jqassistant-mvvm-preview"))
        jqassistantReportsDir.get().asFile.mkdirs()
        jqassistantJunitReportsDir.get().asFile.mkdirs()
        configureJqassistantInvocation(jqassistantGeneratedConfigFile.get(), jqassistantCheckStoreDir.get(), "analyze")
    }
}

val jqassistantEffectiveRules by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Print the effective SaltMarcher passive-view topology rules."
    dependsOn(installJqassistant, prepareJqassistantConfig)
    inputs.file(jqassistantGeneratedConfigFile)
    inputs.dir(jqassistantRulesDir)
    doFirst {
        configureJqassistantInvocation(jqassistantGeneratedConfigFile.get(), "effective-rules")
    }
}

val jqassistantServer by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Start the local jQAssistant Neo4j server for passive-view topology rule development."
    dependsOn(installJqassistant, prepareJqassistantConfig, tasks.named("classes"))
    inputs.file(jqassistantGeneratedConfigFile)
    inputs.dir(jqassistantRulesDir)
    doFirst {
        configureJqassistantInvocation(jqassistantGeneratedConfigFile.get(), "server")
    }
}

val checkViewArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the canonical SaltMarcher cockpit view-architecture topology blocker via jQAssistant."
    dependsOn(jqassistantAnalyzeViewArchitecture)
}

// Desktop resource generation

val renderDesktopIconPng by tasks.registering(RenderDesktopIconTask::class) {
    group = "distribution"
    description = "Render the generated runtime PNG icon from the canonical SVG source."
    projectRoot.set(layout.projectDirectory)
    sourceFile.set(layout.projectDirectory.file("resources/${desktopIconSourceRelativePathProvider.get()}"))
    outputDirectory.set(generatedWindowIconDir)
    outputRelativePath.set(windowIconRelativePathProvider)
    commandName.set("magick")
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(renderDesktopIconPng)
    from(renderDesktopIconPng.flatMap { it.outputDirectory })
}

// Complexity, duplication, and metrics gates

val setupLizard by tasks.registering(SetupLizardTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Create a build-local Python environment with the pinned Lizard version."
    projectRoot.set(layout.projectDirectory)
    requirementsFile.set(lizardRequirementsFile)
    venvDirectory.set(lizardVenvDir)
    readyMarker.set(lizardReadyMarker)
    pythonCommand.set("python3")
}

val lizardMain by tasks.registering(LizardCheckTask::class) {
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

val cpdMain by tasks.registering(CpdCheckTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run PMD CPD duplicate-code checks against production Java sources."
    projectRoot.set(layout.projectDirectory)
    sourceRoots.from(sourceJavaRoots)
    toolClasspath.from(cpdCli)
    minimumTokens.set(100)
    reportFile.set(cpdReportFile)
}

val pmdStrictMain by tasks.registering(PmdSourceCheckTask::class) {
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

val ckjmMain by tasks.registering(CkjmReportTask::class) {
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

// Architecture aggregate and repository/resource policy gates

val checkArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs non-view-architecture checks from ArchUnit, PMD architecture rules, and the external build harness."
    dependsOn("architectureTest")
    dependsOn("checkViewBinderEnforcement")
    dependsOn("checkViewInspectorEntryEnforcement")
    dependsOn("checkViewLayerEnforcement")
    dependsOn("pmdArchitectureMain")
    dependsOn(gradle.includedBuild("build-harness").task(":check"))
}

val checkNoCompiledArtifactsInSource by tasks.registering(CheckNoCompiledArtifactsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if compiled .class artifacts are present in bootstrap/, shell/ or src/."
    projectRoot.set(layout.projectDirectory)
    sourceRoots.from(sourceJavaRoots)
}

val checkCentralizedStylesheets by tasks.registering(CheckCentralizedStylesheetsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if stylesheet files exist outside the central resources/salt-marcher.css file."
    projectRoot.set(layout.projectDirectory)
    stylesheetFiles.from(
        layout.projectDirectory.asFileTree.matching {
            stylesheetExtensions.forEach { extension -> include("**/*.$extension") }
            exclude("**/.git/**", "**/.gradle/**", "**/build/**")
        }
    )
    resourcesRoot.set(layout.projectDirectory.dir("resources"))
    styleExtensions.set(stylesheetExtensions)
    allowedStylesheetRelativePath.set(stylesheetRelativePathProvider.map { "resources/$it" })
}

val checkDefinedStyleClassSelectors by tasks.registering(CheckDefinedStyleClassSelectorsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if Java-authored style classes are missing from resources/salt-marcher.css selectors."
    javaSourceFiles.from(sourceRoots.asFileTree.matching {
        include("**/*.java")
        exclude("**/build/**")
    })
    stylesheetFiles.from(
        layout.projectDirectory.dir("resources").asFileTree.matching {
            stylesheetExtensions.forEach { extension -> include("**/*.$extension") }
        }
    )
}

val checkDesktopPackagingInputs by tasks.registering(CheckDesktopPackagingInputsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Validate main class, icon, stylesheet, and launcher metadata required for desktop packaging."
    mainClassSourceFile.set(layout.projectDirectory.file(mainClassNameProvider.map { "${it.replace('.', '/')}.java" }))
    preloaderClassSourceFile.set(layout.projectDirectory.file(preloaderClassNameProvider.map { "${it.replace('.', '/')}.java" }))
    desktopIconSourceFile.set(layout.projectDirectory.file(desktopIconSourceRelativePathProvider.map { "resources/$it" }))
    stylesheetFile.set(layout.projectDirectory.file(stylesheetRelativePathProvider.map { "resources/$it" }))
    mainClassName.set(mainClassNameProvider)
    preloaderClassName.set(preloaderClassNameProvider)
    desktopIconSourceRelativePath.set(desktopIconSourceRelativePathProvider)
    desktopEntryIconRelativePath.set(desktopEntryIconRelativePathProvider)
    windowIconRelativePath.set(windowIconRelativePathProvider)
    stylesheetRelativePath.set(stylesheetRelativePathProvider)
    launcherName.set(launcherNameProvider)
    startupWmClass.set(startupWmClassProvider)
}

// Central check aggregate

tasks.named("check") {
    dependsOn("compileJava")
    dependsOn("test")
    dependsOn("architectureTest")
    dependsOn("checkViewBinderEnforcement")
    dependsOn("checkViewEnforcement")
    dependsOn("checkViewInspectorEntryEnforcement")
    dependsOn("checkViewLayerEnforcement")
    dependsOn("pmdArchitectureMain")
    dependsOn(gradle.includedBuild("build-harness").task(":check"))
    dependsOn(checkViewArchitecture)
    dependsOn(checkCentralizedStylesheets)
    dependsOn(checkDefinedStyleClassSelectors)
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkDesktopPackagingInputs)
    dependsOn(cpdMain)
    dependsOn(lizardMain)
    dependsOn(ckjmMain)
}

tasks.matching { it.name == "pmdArchitectureMain" }.configureEach {
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
}

tasks.withType<Test>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<Pmd>().configureEach {
    enforceFreshGateResult()
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.withType<PmdSourceCheckTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CpdCheckTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<LizardCheckTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CkjmReportTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CheckCentralizedStylesheetsTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CheckDefinedStyleClassSelectorsTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CheckNoCompiledArtifactsTask>().configureEach {
    enforceFreshGateResult()
}

tasks.withType<CheckDesktopPackagingInputsTask>().configureEach {
    enforceFreshGateResult()
}
