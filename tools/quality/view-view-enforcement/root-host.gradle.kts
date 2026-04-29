import java.io.File
import java.util.UUID
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.creating
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

private val passiveViewCallbackSeamTechnicalBaseViews = listOf(
    "src.view.slotcontent.primitives.mapcanvas.MapCanvasView",
    "src.view.slotcontent.primitives.popup.AnchoredPopupView",
    "src.view.slotcontent.topbar.dropdown.DropdownPopupView",
    "src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView",
    "src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView"
).joinToString(",")

private val jqassistantVersionProvider = providers.gradleProperty("saltMarcherJqassistantVersion")
    .orElse("2.9.1")
private val jqassistantCliFile = layout.buildDirectory.file(
    "tools/jqassistant/jqassistant-commandline-neo4jv5-${jqassistantVersionProvider.get()}/bin/jqassistant"
)
private val jqassistantJvmOpens = listOf(
    "--add-opens", "java.base/java.lang=ALL-UNNAMED",
    "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
    "--add-opens", "java.base/java.io=ALL-UNNAMED",
    "--add-opens", "java.base/java.nio=ALL-UNNAMED"
).joinToString(" ")
private val viewViewJqassistantSourceConfigFile = layout.projectDirectory.file(
    "tools/quality/view-view-enforcement/jqassistant/config.yml"
)
private val viewViewJqassistantGeneratedConfigFile = layout.buildDirectory.file(
    "tools/view-view-enforcement/jqassistant/config.yml"
)
private val viewViewJqassistantRulesDir = layout.projectDirectory.dir(
    "tools/quality/view-view-enforcement/jqassistant/rules"
)
private val viewViewJqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-view-view-jqassistant-${UUID.randomUUID()}"
)
private val viewViewJqassistantCheckStoreDir = layout.dir(providers.provider {
    viewViewJqassistantStoreRoot.resolve("check-view-enforcement-store")
})
private val viewViewJqassistantReportsDir = layout.buildDirectory.dir(
    "reports/jqassistant-view-view-enforcement"
)
private val viewViewJqassistantJunitReportsDir = viewViewJqassistantReportsDir.map { it.dir("junit") }

private fun File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

private fun configureViewViewJqassistantInvocation(
    execSpec: org.gradle.process.ExecSpec,
    configFile: File,
    storeDirectory: File?,
    vararg arguments: String
) {
    execSpec.workingDir = layout.projectDirectory.asFile
    execSpec.environment("JQASSISTANT_OPTS", jqassistantJvmOpens)
    val commandLine = mutableListOf(
        "/bin/bash",
        jqassistantCliFile.get().asFile.absolutePath
    )
    commandLine.addAll(arguments)
    commandLine.addAll(listOf("-C", configFile.absolutePath))
    if (storeDirectory != null) {
        commandLine.addAll(listOf("-D", "jqassistant.store.uri=file:${storeDirectory.absolutePath}"))
    }
    execSpec.commandLine(commandLine)
}

val sourceSets = the<SourceSetContainer>()
val viewViewEnforcementSupport by sourceSets.creating {
    java.srcDir("tools/quality/view-view-enforcement/support/src/main/java")
}
val testSourceSet = sourceSets["test"]
val viewViewEnforcementArchunit by sourceSets.creating {
    java.srcDir("tools/quality/view-view-enforcement/archunit/src/test/java")
    compileClasspath += testSourceSet.compileClasspath
    runtimeClasspath += output + compileClasspath + testSourceSet.runtimeClasspath
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "PassiveViewDependencyBoundaries",
            "PassiveViewModelReadApis",
            "PassiveViewModelMutationBoundary",
            "ViewPresentationDecisionLeak",
            "ViewInputEventApi",
            "PassiveViewCallbackSeamBoundary"
        ).forEach { checkName ->
            "error"(checkName)
        }
        "option"(
            "PassiveViewCallbackSeamBoundary:TechnicalBaseViews",
            passiveViewCallbackSeamTechnicalBaseViews
        )
    }
}

val viewSurfaceArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the passive View-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = viewViewEnforcementArchunit.output.classesDirs
    classpath = viewViewEnforcementArchunit.runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.view.view.ViewSurfaceArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val checkViewFxmlResources by tasks.registering(org.gradle.api.tasks.JavaExec::class) {
    group = "verification"
    description = "Validate declarative passive-view FXML resource placement and controller ownership."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = viewViewEnforcementSupport.runtimeClasspath
    mainClass = "saltmarcher.quality.viewview.fxml.ViewFxmlResourceCheckMain"
    args = listOf(layout.projectDirectory.asFile.absolutePath)
}

val prepareViewViewJqassistantConfig by tasks.registering {
    group = "verification"
    description = "Materialize passive View jQAssistant configuration with invocation-local build output paths."
    inputs.file(viewViewJqassistantSourceConfigFile)
    outputs.file(viewViewJqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDir.get().asFile.absoluteInvariantPath()}"
        val generatedConfigText = viewViewJqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant-view-view-enforcement/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant-view-view-enforcement/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant-view-view-enforcement/junit"
            )
        val generatedConfigFile = viewViewJqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Scan SaltMarcher passive View topology for the dedicated passive View enforcement bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn("installJqassistant", prepareViewViewJqassistantConfig, tasks.named("compileJava"))
    inputs.file(viewViewJqassistantGeneratedConfigFile)
    inputs.dir(viewViewJqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(files("bootstrap", "shell", "src"))
    outputs.dir(viewViewJqassistantCheckStoreDir)
    doFirst {
        configureViewViewJqassistantInvocation(
            this as Exec,
            viewViewJqassistantGeneratedConfigFile.get().asFile,
            viewViewJqassistantCheckStoreDir.get().asFile,
            "scan"
        )
    }
}

val jqassistantAnalyzeViewEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Analyze SaltMarcher passive View topology constraints through the dedicated passive View bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn(jqassistantScanViewEnforcement)
    inputs.file(viewViewJqassistantGeneratedConfigFile)
    inputs.dir(viewViewJqassistantRulesDir)
    outputs.dir(viewViewJqassistantReportsDir)
    doFirst {
        delete(viewViewJqassistantReportsDir)
        viewViewJqassistantReportsDir.get().asFile.mkdirs()
        viewViewJqassistantJunitReportsDir.get().asFile.mkdirs()
        configureViewViewJqassistantInvocation(
            this as Exec,
            viewViewJqassistantGeneratedConfigFile.get().asFile,
            viewViewJqassistantCheckStoreDir.get().asFile,
            "analyze"
        )
    }
}

tasks.register("checkViewEnforcement") {
    group = "verification"
    description = "Run all currently active passive View enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewSurfaceArchitectureTest)
    dependsOn(checkViewFxmlResources)
    dependsOn(jqassistantAnalyzeViewEnforcement)
}
