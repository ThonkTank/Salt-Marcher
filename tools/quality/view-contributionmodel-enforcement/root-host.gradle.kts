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
private val contributionModelJqassistantSourceConfigFile = layout.projectDirectory.file(
    "tools/quality/view-contributionmodel-enforcement/jqassistant/config.yml"
)
private val contributionModelJqassistantGeneratedConfigFile = layout.buildDirectory.file(
    "tools/view-contributionmodel-enforcement/jqassistant/config.yml"
)
private val contributionModelJqassistantRulesDir = layout.projectDirectory.dir(
    "tools/quality/view-contributionmodel-enforcement/jqassistant/rules"
)
private val contributionModelJqassistantStoreRoot = File(
    System.getProperty("java.io.tmpdir"),
    "saltmarcher-view-contributionmodel-jqassistant-${UUID.randomUUID()}"
)
private val contributionModelJqassistantCheckStoreDir = layout.dir(providers.provider {
    contributionModelJqassistantStoreRoot.resolve("check-view-contributionmodel-enforcement-store")
})
private val contributionModelJqassistantReportsDir = layout.buildDirectory.dir(
    "reports/jqassistant-view-contributionmodel-enforcement"
)
private val contributionModelJqassistantJunitReportsDir = contributionModelJqassistantReportsDir.map { it.dir("junit") }

private fun File.absoluteInvariantPath(): String = absolutePath.replace(File.separatorChar, '/')

private fun configureContributionModelJqassistantInvocation(
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
    java.srcDir("tools/quality/view-contributionmodel-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewContributionModelDependencyBoundary",
            "ViewContributionModelFlatSurface"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val viewContributionModelArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the ViewContributionModel-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.view.contributionmodel.ViewContributionModelArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val prepareViewContributionModelJqassistantConfig by tasks.registering {
    group = "verification"
    description = "Materialize ContributionModel jQAssistant configuration with invocation-local build output paths."
    inputs.file(contributionModelJqassistantSourceConfigFile)
    outputs.file(contributionModelJqassistantGeneratedConfigFile)

    doLast {
        val buildRootPath = layout.buildDirectory.get().asFile.absoluteInvariantPath()
        val mainClasspathEntry = "        - java:classpath::${mainJavaClassesDir.get().asFile.absoluteInvariantPath()}"
        val generatedConfigText = contributionModelJqassistantSourceConfigFile.asFile.readText()
            .replace("file:build/jqassistant/store", "file:$buildRootPath/jqassistant-view-contributionmodel-enforcement/store")
            .replace("        - java:classpath::build/classes/java/main", mainClasspathEntry)
            .replace(
                "xml.report.file: build/reports/jqassistant/jqassistant-report.xml",
                "xml.report.file: $buildRootPath/reports/jqassistant-view-contributionmodel-enforcement/jqassistant-report.xml"
            )
            .replace(
                "junit.report.directory: build/reports/jqassistant/junit",
                "junit.report.directory: $buildRootPath/reports/jqassistant-view-contributionmodel-enforcement/junit"
            )
        val generatedConfigFile = contributionModelJqassistantGeneratedConfigFile.get().asFile
        generatedConfigFile.parentFile.mkdirs()
        generatedConfigFile.writeText(generatedConfigText)
    }
}

val jqassistantScanViewContributionModelEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Scan SaltMarcher ContributionModel topology for the dedicated ContributionModel enforcement bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn("installJqassistant", prepareViewContributionModelJqassistantConfig, tasks.named("compileJava"))
    inputs.file(contributionModelJqassistantGeneratedConfigFile)
    inputs.dir(contributionModelJqassistantRulesDir)
    inputs.dir(mainJavaClassesDir)
    inputs.files(files("bootstrap", "shell", "src"))
    outputs.dir(contributionModelJqassistantCheckStoreDir)
    doFirst {
        configureContributionModelJqassistantInvocation(
            this as Exec,
            contributionModelJqassistantGeneratedConfigFile.get().asFile,
            contributionModelJqassistantCheckStoreDir.get().asFile,
            "scan"
        )
    }
}

val jqassistantAnalyzeViewContributionModelEnforcement by tasks.registering(Exec::class) {
    group = "verification"
    description = "Analyze SaltMarcher ContributionModel constraints through the dedicated ContributionModel bundle."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    dependsOn(jqassistantScanViewContributionModelEnforcement)
    inputs.file(contributionModelJqassistantGeneratedConfigFile)
    inputs.dir(contributionModelJqassistantRulesDir)
    outputs.dir(contributionModelJqassistantReportsDir)
    doFirst {
        delete(contributionModelJqassistantReportsDir)
        contributionModelJqassistantReportsDir.get().asFile.mkdirs()
        contributionModelJqassistantJunitReportsDir.get().asFile.mkdirs()
        configureContributionModelJqassistantInvocation(
            this as Exec,
            contributionModelJqassistantGeneratedConfigFile.get().asFile,
            contributionModelJqassistantCheckStoreDir.get().asFile,
            "analyze"
        )
    }
}

tasks.register("checkViewContributionModelEnforcement") {
    group = "verification"
    description = "Run all currently active ViewContributionModel enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewContributionModelArchitectureTest)
    dependsOn(jqassistantAnalyzeViewContributionModelEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":viewContributionModelTopologyCheck"))
}

tasks.named("checkViewArchitecture") {
    dependsOn(jqassistantAnalyzeViewContributionModelEnforcement)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkViewContributionModelEnforcement")
}
