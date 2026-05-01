import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

private val dataModelRulesetFile = layout.projectDirectory.file(
    "tools/quality/data-model-enforcement/pmd/ruleset.xml"
)

val sourceSets = the<org.gradle.api.tasks.SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/data-model-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DataModelSourceShape")
    }
}

val dataModelArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Data Model-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.data.model.DataModelArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val pmdDataModelEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Data Model PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(dataModelRulesetFile)
    source = files("bootstrap", "shell", "src").asFileTree
    include("**/*.java")
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.register("checkDataModelEnforcement") {
    group = "verification"
    description = "Run the dedicated Data Model enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDataModelEnforcement)
    dependsOn(dataModelArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":dataModelTopologyCheck"))
    dependsOn(gradle.includedBuild("build-harness").task(":dataModelDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkDataModelEnforcement")
}

tasks.named("check") {
    dependsOn("checkDataModelEnforcement")
}
