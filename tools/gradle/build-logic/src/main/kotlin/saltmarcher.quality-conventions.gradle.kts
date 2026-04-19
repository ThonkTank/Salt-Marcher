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
import saltmarcher.buildlogic.tasks.CkjmReportTask
import saltmarcher.buildlogic.tasks.CpdCheckTask
import saltmarcher.buildlogic.tasks.LizardCheckTask
import saltmarcher.buildlogic.tasks.PmdSourceCheckTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.SetupLizardTask

plugins {
    id("net.ltgt.errorprone")
}

val continueOnFailureEntrypoints = setOf(
    "build",
    "check",
    "compileJava",
    "test",
    "architectureTest",
    "checkArchitecture",
    "checkViewArchitecture",
    "pmdMain",
    "pmdStrictMain",
    "pmdArchitectureMain",
    "spotbugsMain",
    "cpdMain",
    "lizardMain",
    "ckjmMain",
    "checkCentralizedStylesheets",
    "checkDefinedStyleClassSelectors",
    "checkNoCompiledArtifactsInSource",
    "checkDesktopPackagingInputs",
    "jqassistantEffectiveRules"
)

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
val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
val lizardRequirementsFile = layout.projectDirectory.file("tools/quality/config/lizard/requirements.txt")
val lizardVenvDir = layout.buildDirectory.dir("tools/lizard-venv")
val lizardReadyMarker = layout.buildDirectory.file("tools/lizard-venv/.lizard-ready")
val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")
val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
val jqassistantHomeDir = jqassistantInstallDir.map {
    it.dir("jqassistant-commandline-neo4jv5-${jqassistantVersionProvider.get()}")
}
val jqassistantCliFile = jqassistantHomeDir.map { it.file("bin/jqassistant") }
val jqassistantConfigFile = layout.projectDirectory.file("tools/quality/jqassistant/config.yml")
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

tasks.withType<JavaCompile>().configureEach {
    options.errorprone.enabled.set(false)
}

tasks.named<JavaCompile>("compileJava") {
    enforceFreshGateResult()
    dependsOn(gradle.includedBuild("quality-rules-errorprone").task(":jar"))
    options.errorprone.enabled.set(true)
    options.errorprone.disableWarningsInGeneratedCode.set(true)
    options.errorprone.disable("StringConcatToTextBlock")
    options.errorprone.error("EqualsNull")
    options.errorprone.error("DataAdapterPublicSignatureLeak")
    options.errorprone.error("DataAdapterRoleContract")
    options.errorprone.error("DataGatewayReturnTypeBoundary")
    options.errorprone.error("DomainPublicBoundarySignaturePurity")
    options.errorprone.error("FeatureShellApiAllowlist")
    options.errorprone.error("NullAway")
    options.errorprone.error("ReferenceEquality")
    options.errorprone.error("ServiceRegistryRegistrationPlacement")
    options.errorprone.error("ShellLifecycleHookOwnership")
    options.errorprone.error("StringCaseLocaleUsage")
    options.errorprone.error("StringSplitter")
    options.errorprone.error("ViewAssemblyDependencies")
    options.errorprone.error("ViewApiDependencies")
    options.errorprone.error("ViewApiPublicSignatureLeak")
    options.errorprone.error("ViewModelOwnershipNaming")
    options.errorprone.error("ViewModelFrameworkIndependence")
    options.errorprone.error("ViewProgrammaticStyling")
    options.errorprone.error("ViewReflectionBypass")
    options.errorprone.error("ViewRestrictedDependencies")
    options.errorprone.error("ViewRootDelegation")
    options.errorprone.error("ViewSceneGraphPlacement")
    options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
    options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
}

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

val jqassistantScanViewArchitecture by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Scan SaltMarcher bytecode and source topology for view-architecture analysis."
    enforceFreshGateResult()
    dependsOn(installJqassistant, tasks.named("classes"))
    inputs.file(jqassistantConfigFile)
    inputs.dir(jqassistantRulesDir)
    inputs.dir(layout.buildDirectory.dir("classes/java/main"))
    inputs.files(sourceJavaRoots)
    outputs.dir(jqassistantCheckStoreDir)
    doFirst {
        configureJqassistantInvocation(jqassistantConfigFile, jqassistantCheckStoreDir.get(), "scan")
    }
}

val jqassistantAnalyzeViewArchitecture by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Analyze SaltMarcher MVVM view-architecture constraints with jQAssistant."
    enforceFreshGateResult()
    dependsOn(jqassistantScanViewArchitecture)
    inputs.file(jqassistantConfigFile)
    inputs.dir(jqassistantRulesDir)
    outputs.dir(jqassistantReportsDir)
    doFirst {
        delete(jqassistantReportsDir)
        delete(layout.buildDirectory.dir("reports/jqassistant-mvvm-preview"))
        jqassistantReportsDir.get().asFile.mkdirs()
        jqassistantJunitReportsDir.get().asFile.mkdirs()
        configureJqassistantInvocation(jqassistantConfigFile, jqassistantCheckStoreDir.get(), "analyze")
    }
}

val jqassistantEffectiveRules by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Print the effective SaltMarcher MVVM view-architecture rules."
    dependsOn(installJqassistant)
    inputs.file(jqassistantConfigFile)
    inputs.dir(jqassistantRulesDir)
    doFirst {
        configureJqassistantInvocation(jqassistantConfigFile, "effective-rules")
    }
}

val jqassistantServer by tasks.registering(Exec::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Start the local jQAssistant Neo4j server for MVVM view-architecture rule development."
    dependsOn(installJqassistant, tasks.named("classes"))
    inputs.file(jqassistantConfigFile)
    inputs.dir(jqassistantRulesDir)
    doFirst {
        configureJqassistantInvocation(jqassistantConfigFile, "server")
    }
}

val checkViewArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the canonical SaltMarcher MVVM view-architecture blocker via jQAssistant."
    dependsOn(jqassistantAnalyzeViewArchitecture)
}

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
    minimumTokens.set(80)
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
    dependsOn(pmdStrictMain)
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
    compiledClasses.from(layout.buildDirectory.dir("classes/java/main"))
    toolClasspath.from(ckjmToolClasspath)
    runtimeClasspath.from(configurations.named("runtimeClasspath"))
    reportFile.set(ckjmReportFile)
    summaryFile.set(ckjmSummaryFile)
    maxWeightedMethodsPerClass.set(50)
    maxDepthOfInheritanceTree.set(5)
    maxNumberOfChildren.set(3)
    maxCouplingBetweenObjects.set(14)
    maxResponseForClass.set(50)
    maxLackOfCohesionInMethods.set(50)
    maxAfferentCouplings.set(14)
    maxNumberOfPublicMethods.set(30)
}

val checkArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs non-view-architecture checks from ArchUnit, PMD architecture rules, and the external build harness."
    dependsOn("architectureTest")
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
    description = "Fail if stylesheet files exist outside the top-level resources/ directory."
    projectRoot.set(layout.projectDirectory)
    stylesheetFiles.from(
        layout.projectDirectory.asFileTree.matching {
            stylesheetExtensions.forEach { extension -> include("**/*.$extension") }
            exclude("**/.git/**", "**/.gradle/**", "**/build/**")
        }
    )
    resourcesRoot.set(layout.projectDirectory.dir("resources"))
    styleExtensions.set(stylesheetExtensions)
}

val checkDefinedStyleClassSelectors by tasks.registering(CheckDefinedStyleClassSelectorsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if Java-authored style classes are missing from centralized resources/*.css selectors."
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

tasks.named("check") {
    dependsOn("compileJava")
    dependsOn("test")
    dependsOn("pmdMain")
    dependsOn("architectureTest")
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
