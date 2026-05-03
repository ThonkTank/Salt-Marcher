import java.io.File
import java.util.Properties
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Task
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.language.jvm.tasks.ProcessResources
import org.gradle.process.ExecSpec
import saltmarcher.buildlogic.tasks.CheckDesktopPackagingInputsTask
import saltmarcher.buildlogic.tasks.CheckNoCompiledArtifactsTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.hygiene.CkjmReportTask
import saltmarcher.buildlogic.tasks.hygiene.CpdCheckTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantAnalyzeTask
import saltmarcher.buildlogic.tasks.hygiene.JqassistantScanTask
import saltmarcher.buildlogic.tasks.hygiene.LizardCheckTask
import saltmarcher.buildlogic.tasks.hygiene.PmdSourceCheckTask
import saltmarcher.buildlogic.tasks.hygiene.SetupLizardTask

plugins {
    id("net.ltgt.errorprone")
}

fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

fun loadDescriptorEnforcementTaskNames(projectDir: File): Set<String> {
    val qualityDir = File(projectDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptySet()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .flatMap { descriptorFile ->
            val properties = Properties()
            descriptorFile.inputStream().use(properties::load)
            properties.list("taskNames").asSequence()
        }
        .toSet()
}

// Invocation policy

val descriptorEnforcementTaskNames = loadDescriptorEnforcementTaskNames(project.projectDir)

val architectureGateEntrypoints = setOf(
    "architectureTest",
    "checkArchitecture",
    "checkViewLayerEnforcement",
    "checkViewInputEventEnforcement",
    "checkViewArchitecture",
    "pmdArchitectureMain",
    "jqassistantEffectiveRules"
).plus(descriptorEnforcementTaskNames)

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
    "productionBuild",
    "checkQualityHygiene",
    "compileJava",
    "test",
    "production-build",
    "quality-hygiene",
    "architecture",
    "view-topology",
    "docs",
    "metrics-report",
    "desktop-install",
    "production-handoff"
)
    .plus(architectureGateEntrypoints)
    .plus(qualitySmellEntrypoints)
    .plus(qualityGateEntrypoints)
    .plus(resourcePolicyEntrypoints)

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

val enforcementBundleTaskNames = setOf(
    "checkViewInputEventEnforcement",
    "viewInputEventArchitectureTest",
    "viewInputEventTopologyCheck"
).plus(descriptorEnforcementTaskNames)

val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty()
    && requestedTaskNames.any { taskName -> taskName in enforcementBundleTaskNames }
    && requestedTaskNames.none { taskName ->
        taskName in setOf(
            "build",
            "check",
            "productionBuild",
            "checkQualityHygiene",
            "assemble",
            "classes",
            "compileJava",
            "jar",
            "test",
            "installDesktopApp",
            "installDist",
            "run",
            "checkArchitecture",
            "checkViewArchitecture",
            "architectureTest",
            "pmdArchitectureMain",
            "jqassistantEffectiveRules"
        )
    }
    && requestedTaskNames.all { taskName -> taskName in enforcementBundleTaskNames }

if (requestedTaskNames.any { it in continueOnFailureEntrypoints }) {
    gradle.startParameter.setContinueOnFailure(true)
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
val jqassistantGeneratedConfigFile = layout.buildDirectory.file("tools/jqassistant/config.yml")
val jqassistantRulesDir = layout.projectDirectory.dir("tools/quality/jqassistant/rules")
val jqassistantCheckStoreDir = layout.buildDirectory.dir("tools/jqassistant/check-view-architecture-store")
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

val jqassistantScanViewArchitecture by tasks.registering(JqassistantScanTask::class) {
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

val jqassistantAnalyzeViewArchitecture by tasks.registering(JqassistantAnalyzeTask::class) {
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
    if (!focusedEnforcementBundleMode) {
        dependsOn(renderDesktopIconPng)
        from(renderDesktopIconPng.flatMap { it.outputDirectory })
    }
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

val productionBuild by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the staged production build surface without the broader repository quality aggregates."
    dependsOn("assemble")
    dependsOn("test")
}

val checkQualityHygiene by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the staged non-architecture hygiene gates without the architecture or view-topology aggregates."
    dependsOn(tasks.named("pmdMain"))
    dependsOn(tasks.named("spotbugsMain"))
    dependsOn(cpdMain)
    dependsOn(lizardMain)
    dependsOn(checkNoCompiledArtifactsInSource)
}

val checkArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs non-documentation architecture checks from ArchUnit, PMD architecture rules, and the external build harness."
    dependsOn("architectureTest")
    dependsOn("checkViewIntentHandlerEnforcement")
    dependsOn("checkLayeringArchitectureEnforcement")
    dependsOn("checkViewBinderEnforcement")
    dependsOn("checkViewLayerEnforcement")
    dependsOn("pmdArchitectureMain")
    dependsOn(gradle.includedBuild("build-harness").task(":architectureCheck"))
}

val checkNoCompiledArtifactsInSource by tasks.registering(CheckNoCompiledArtifactsTask::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Fail if compiled .class artifacts are present in bootstrap/, shell/ or src/."
    projectRoot.set(layout.projectDirectory)
    sourceRoots.from(sourceJavaRoots)
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
    dependsOn(productionBuild)
    dependsOn(checkArchitecture)
    dependsOn(checkViewArchitecture)
    dependsOn(checkQualityHygiene)
    dependsOn(ckjmMain)
}

tasks.matching { it.name == "pmdArchitectureMain" }.configureEach {
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
}

tasks.withType<Test>().configureEach {
}

tasks.withType<Pmd>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.withType<PmdSourceCheckTask>().configureEach {
}

tasks.withType<CpdCheckTask>().configureEach {
}

tasks.withType<LizardCheckTask>().configureEach {
}

tasks.withType<CkjmReportTask>().configureEach {
}

tasks.withType<CheckNoCompiledArtifactsTask>().configureEach {
}

tasks.withType<CheckDesktopPackagingInputsTask>().configureEach {
}
