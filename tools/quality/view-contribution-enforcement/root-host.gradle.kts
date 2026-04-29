import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/view-contribution-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }
val viewContributionRulesetFile = layout.projectDirectory.file(
    "tools/quality/view-contribution-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("ViewContributionDependencyBoundary")
    }
}

val viewContributionArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the ViewContribution-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.view.contribution.ViewContributionArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val pmdViewContributionEnforcement by tasks.registering(Pmd::class) {
    group = "verification"
    description = "Run the dedicated ViewContribution PMD architecture rule bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(viewContributionRulesetFile)
    source = files("bootstrap", "shell", "src").asFileTree
    include("**/*.java")
    classpath = files()

    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.register("checkViewContributionEnforcement") {
    group = "verification"
    description = "Run all currently active ViewContribution enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewContributionArchitectureTest)
    dependsOn(pmdViewContributionEnforcement)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkViewContributionEnforcement")
}

tasks.named("check") {
    dependsOn("checkViewContributionEnforcement")
}
