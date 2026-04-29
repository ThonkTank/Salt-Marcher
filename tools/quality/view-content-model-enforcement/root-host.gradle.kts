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
private val contentModelJqassistantSourceConfigFile = layout.projectDirectory.file(
    "tools/quality/view-content-model-enforcement/jqassistant/config.yml"
)
private val contentModelJqassistantGeneratedConfigFile = layout.buildDirectory.file(
    "tools/view-content-model-enforcement/jqassistant/config.yml"
)
private val contentModelJqassistantRulesDir = layout.projectDirectory.dir(
    "tools/quality/view-content-model-enforcement/jqassistant/rules"
)
private val contentModelJqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-view-contentmodel-jqassistant-${UUID.randomUUID()}"
)
private val contentModelJqassistantCheckStoreDir = layout.dir(providers.provider {
    contentModelJqassistantStoreRoot.resolve("check-view-content-model-enforcement-store")
})
private val contentModelJqassistantReportsDir = layout.buildDirectory.dir(
    "reports/jqassistant-view-content-model-enforcement"
)
private val contentModelJqassistantJunitReportsDir = contentModelJqassistantReportsDir.map { it.dir("junit") }

private fun File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

private fun configureContentModelJqassistantInvocation(
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
    java.srcDir("tools/quality/view-content-model-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewContentModelDependencyBoundary",
            "ViewContentModelFlatSurface"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val viewContentModelArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the ViewContentModel-focused architecture test suite."
    dependsOn(tasks.named("classes"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.view.contentmodel.ViewContentModelArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val prepareViewContentModelJqassistantConfig by tasks.registering {
    group = "verification"
    description = "Materialize ContentModel jQAssistant configuration with invocation-local build output paths."
    inputs.file(contentModelJqassistantSourceConfigFile)
    outputs.file(contentModelJqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDir.get().asFile.absoluteInvariantPath()}"
        val generatedConfigText = contentModelJqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant-view-content-model-enforcement/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant-view-content-model-enforcement/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant-view-content-model-enforcement/junit"
            )
        val generatedConfigFile = contentModelJqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewContentModelEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Scan SaltMarcher ContentModel topology for the dedicated ContentModel enforcement bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn("installJqassistant", prepareViewContentModelJqassistantConfig, tasks.named("classes"))
    inputs.file(contentModelJqassistantGeneratedConfigFile)
    inputs.dir(contentModelJqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(files("bootstrap", "shell", "src"))
    outputs.dir(contentModelJqassistantCheckStoreDir)
    doFirst {
        configureContentModelJqassistantInvocation(
            this as Exec,
            contentModelJqassistantGeneratedConfigFile.get().asFile,
            contentModelJqassistantCheckStoreDir.get().asFile,
            "scan"
        )
    }
}

val jqassistantAnalyzeViewContentModelEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Analyze SaltMarcher ContentModel constraints through the dedicated ContentModel bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn(jqassistantScanViewContentModelEnforcement)
    inputs.file(contentModelJqassistantGeneratedConfigFile)
    inputs.dir(contentModelJqassistantRulesDir)
    outputs.dir(contentModelJqassistantReportsDir)
    doFirst {
        delete(contentModelJqassistantReportsDir)
        contentModelJqassistantReportsDir.get().asFile.mkdirs()
        contentModelJqassistantJunitReportsDir.get().asFile.mkdirs()
        configureContentModelJqassistantInvocation(
            this as Exec,
            contentModelJqassistantGeneratedConfigFile.get().asFile,
            contentModelJqassistantCheckStoreDir.get().asFile,
            "analyze"
        )
    }
}

tasks.register("checkViewContentModelEnforcement") {
    group = "verification"
    description = "Run all currently active ViewContentModel enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewContentModelArchitectureTest)
    dependsOn(jqassistantAnalyzeViewContentModelEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":viewContentModelTopologyCheck"))
}

tasks.named("checkViewArchitecture") {
    dependsOn(jqassistantAnalyzeViewContentModelEnforcement)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkViewContentModelEnforcement")
}
