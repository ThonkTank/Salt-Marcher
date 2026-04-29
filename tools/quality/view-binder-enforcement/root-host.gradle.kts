import java.io.File
import java.util.UUID
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
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
private val viewBinderJqassistantSourceConfigFile = layout.projectDirectory.file(
    "tools/quality/view-binder-enforcement/jqassistant/config.yml"
)
private val viewBinderJqassistantGeneratedConfigFile = layout.buildDirectory.file(
    "tools/view-binder-enforcement/jqassistant/config.yml"
)
private val viewBinderJqassistantRulesDir = layout.projectDirectory.dir(
    "tools/quality/view-binder-enforcement/jqassistant/rules"
)
private val viewBinderJqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-view-binder-jqassistant-${UUID.randomUUID()}"
)
private val viewBinderJqassistantCheckStoreDir = layout.dir(providers.provider {
    viewBinderJqassistantStoreRoot.resolve("check-view-binder-enforcement-store")
})
private val viewBinderJqassistantReportsDir = layout.buildDirectory.dir(
    "reports/jqassistant-view-binder-enforcement"
)
private val viewBinderJqassistantJunitReportsDir = viewBinderJqassistantReportsDir.map { it.dir("junit") }

private fun File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

private fun configureViewBinderJqassistantInvocation(
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
sourceSets.named("test") {
    java.srcDir("tools/quality/view-binder-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewBinderDependencyBoundary",
            "ViewBinderViewInputEventWiring",
            "ViewBinderApplicationSinkWiring"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val viewBinderArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Binder-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.view.binder.ViewBinderArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val prepareViewBinderJqassistantConfig by tasks.registering {
    group = "verification"
    description = "Materialize Binder jQAssistant configuration with invocation-local build output paths."
    inputs.file(viewBinderJqassistantSourceConfigFile)
    outputs.file(viewBinderJqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDir.get().asFile.absoluteInvariantPath()}"
        val generatedConfigText = viewBinderJqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant-view-binder-enforcement/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant-view-binder-enforcement/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant-view-binder-enforcement/junit"
            )
        val generatedConfigFile = viewBinderJqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewBinderEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Scan SaltMarcher Binder topology for the dedicated Binder enforcement bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn("installJqassistant", prepareViewBinderJqassistantConfig, tasks.named("compileJava"))
    inputs.file(viewBinderJqassistantGeneratedConfigFile)
    inputs.dir(viewBinderJqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(files("bootstrap", "shell", "src"))
    outputs.dir(viewBinderJqassistantCheckStoreDir)
    doFirst {
        configureViewBinderJqassistantInvocation(
            this as Exec,
            viewBinderJqassistantGeneratedConfigFile.get().asFile,
            viewBinderJqassistantCheckStoreDir.get().asFile,
            "scan"
        )
    }
}

val jqassistantAnalyzeViewBinderEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Analyze SaltMarcher Binder topology constraints through the dedicated Binder bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn(jqassistantScanViewBinderEnforcement)
    inputs.file(viewBinderJqassistantGeneratedConfigFile)
    inputs.dir(viewBinderJqassistantRulesDir)
    outputs.dir(viewBinderJqassistantReportsDir)
    doFirst {
        delete(viewBinderJqassistantReportsDir)
        viewBinderJqassistantReportsDir.get().asFile.mkdirs()
        viewBinderJqassistantJunitReportsDir.get().asFile.mkdirs()
        configureViewBinderJqassistantInvocation(
            this as Exec,
            viewBinderJqassistantGeneratedConfigFile.get().asFile,
            viewBinderJqassistantCheckStoreDir.get().asFile,
            "analyze"
        )
    }
}

tasks.register("checkViewBinderEnforcement") {
    group = "verification"
    description = "Run all currently active Binder enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewBinderArchitectureTest)
    dependsOn(jqassistantAnalyzeViewBinderEnforcement)
}
