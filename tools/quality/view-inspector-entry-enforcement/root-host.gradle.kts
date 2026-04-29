import java.io.File
import java.util.UUID
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

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
private val inspectorEntryJqassistantSourceConfigFile = layout.projectDirectory.file(
    "tools/quality/view-inspector-entry-enforcement/jqassistant/config.yml"
)
private val inspectorEntryJqassistantGeneratedConfigFile = layout.buildDirectory.file(
    "tools/view-inspector-entry-enforcement/jqassistant/config.yml"
)
private val inspectorEntryJqassistantRulesDir = layout.projectDirectory.dir(
    "tools/quality/view-inspector-entry-enforcement/jqassistant/rules"
)
private val inspectorEntryJqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-view-inspector-entry-jqassistant-${UUID.randomUUID()}"
)
private val inspectorEntryJqassistantCheckStoreDir = layout.dir(providers.provider {
    inspectorEntryJqassistantStoreRoot.resolve("check-view-inspector-entry-enforcement-store")
})
private val inspectorEntryJqassistantReportsDir = layout.buildDirectory.dir(
    "reports/jqassistant-view-inspector-entry-enforcement"
)
private val inspectorEntryJqassistantJunitReportsDir = inspectorEntryJqassistantReportsDir.map { it.dir("junit") }

private fun File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

private fun configureInspectorEntryJqassistantInvocation(
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

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewInspectorEntryDependencyBoundary",
            "ViewInspectorEntryShellApiAllowlist"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val prepareViewInspectorEntryJqassistantConfig by tasks.registering {
    group = "verification"
    description = "Materialize InspectorEntry jQAssistant configuration with invocation-local build output paths."
    inputs.file(inspectorEntryJqassistantSourceConfigFile)
    outputs.file(inspectorEntryJqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDir.get().asFile.absoluteInvariantPath()}"
        val generatedConfigText = inspectorEntryJqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant-view-inspector-entry-enforcement/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant-view-inspector-entry-enforcement/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant-view-inspector-entry-enforcement/junit"
            )
        val generatedConfigFile = inspectorEntryJqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewInspectorEntryEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Scan SaltMarcher InspectorEntry topology for the dedicated InspectorEntry enforcement bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn("installJqassistant", prepareViewInspectorEntryJqassistantConfig, tasks.named("compileJava"))
    inputs.file(inspectorEntryJqassistantGeneratedConfigFile)
    inputs.dir(inspectorEntryJqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(files("bootstrap", "shell", "src"))
    outputs.dir(inspectorEntryJqassistantCheckStoreDir)
    doFirst {
        configureInspectorEntryJqassistantInvocation(
            this as Exec,
            inspectorEntryJqassistantGeneratedConfigFile.get().asFile,
            inspectorEntryJqassistantCheckStoreDir.get().asFile,
            "scan"
        )
    }
}

val jqassistantAnalyzeViewInspectorEntryEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Analyze SaltMarcher InspectorEntry topology constraints through the dedicated InspectorEntry bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn(jqassistantScanViewInspectorEntryEnforcement)
    inputs.file(inspectorEntryJqassistantGeneratedConfigFile)
    inputs.dir(inspectorEntryJqassistantRulesDir)
    outputs.dir(inspectorEntryJqassistantReportsDir)
    doFirst {
        delete(inspectorEntryJqassistantReportsDir)
        inspectorEntryJqassistantReportsDir.get().asFile.mkdirs()
        inspectorEntryJqassistantJunitReportsDir.get().asFile.mkdirs()
        configureInspectorEntryJqassistantInvocation(
            this as Exec,
            inspectorEntryJqassistantGeneratedConfigFile.get().asFile,
            inspectorEntryJqassistantCheckStoreDir.get().asFile,
            "analyze"
        )
    }
}

tasks.register("checkViewInspectorEntryEnforcement") {
    group = "verification"
    description = "Run all currently active InspectorEntry enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(jqassistantAnalyzeViewInspectorEntryEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":viewInspectorEntryTopologyCheck"))
}
