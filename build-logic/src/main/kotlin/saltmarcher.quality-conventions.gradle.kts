import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.language.jvm.tasks.ProcessResources
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDesktopPackagingInputsTask
import saltmarcher.buildlogic.tasks.CheckNoCompiledArtifactsTask
import saltmarcher.buildlogic.tasks.CkjmReportTask
import saltmarcher.buildlogic.tasks.CpdCheckTask
import saltmarcher.buildlogic.tasks.LizardCheckTask
import saltmarcher.buildlogic.tasks.RenderDesktopIconTask
import saltmarcher.buildlogic.tasks.SetupLizardTask

plugins {
    id("net.ltgt.errorprone")
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
val stylesheetExtensions = listOf("css", "scss", "sass", "less", "styl")

val sourceRoots = files("bootstrap", "shell", "src")
val sourceJavaRoots = sourceRoots.filter { it.exists() }
val generatedWindowIconDir = layout.buildDirectory.dir("generated/window-icon")
val lizardRequirementsFile = layout.projectDirectory.file("config/lizard/requirements.txt")
val lizardVenvDir = layout.buildDirectory.dir("tools/lizard-venv")
val lizardReadyMarker = layout.buildDirectory.file("tools/lizard-venv/.lizard-ready")
val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")

val cpdCli by configurations.creating {
    isCanBeConsumed = false
}

val ckjmToolClasspath by configurations.creating {
    isCanBeConsumed = false
}

dependencies {
    errorprone("com.google.errorprone:error_prone_core:2.48.0")
    errorprone("com.uber.nullaway:nullaway:0.13.1")

    add("cpdCli", "net.sourceforge.pmd:pmd-cli:7.23.0")
    add("cpdCli", "net.sourceforge.pmd:pmd-java:7.23.0")

    add("ckjmToolClasspath", "gr.spinellis.ckjm:ckjm_ext:2.10")
    add("ckjmToolClasspath", "org.apache.bcel:bcel:6.11.0")
    add("ckjmToolClasspath", "org.apache.ant:ant:1.10.15")
    add("ckjmToolClasspath", "org.apache.commons:commons-math3:3.6.1")
}

tasks.withType<JavaCompile>().configureEach {
    options.errorprone.enabled.set(false)
}

tasks.named<JavaCompile>("compileJava") {
    options.errorprone.enabled.set(true)
    options.errorprone.disableWarningsInGeneratedCode.set(true)
    options.errorprone.disable("StringConcatToTextBlock")
    options.errorprone.error("EqualsNull")
    options.errorprone.error("NullAway")
    options.errorprone.error("ReferenceEquality")
    options.errorprone.error("StringCaseLocaleUsage")
    options.errorprone.error("StringSplitter")
    options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
    options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
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
}

val checkArchitecture by tasks.registering {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Runs architecture checks from ArchUnit, PMD architecture rules, and the external build harness."
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
    dependsOn(checkArchitecture)
    dependsOn(checkCentralizedStylesheets)
    dependsOn(checkNoCompiledArtifactsInSource)
    dependsOn(checkDesktopPackagingInputs)
    dependsOn(cpdMain)
    dependsOn(lizardMain)
    dependsOn(ckjmMain)
}

tasks.named("build") {
    dependsOn(checkArchitecture)
    dependsOn(checkCentralizedStylesheets)
    dependsOn(checkDesktopPackagingInputs)
}

tasks.matching { it.name == "pmdArchitectureMain" }.configureEach {
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
}

tasks.withType<Pmd>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}
