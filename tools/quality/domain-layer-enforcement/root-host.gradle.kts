import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

val sourceSets = the<SourceSetContainer>()
sourceSets.named("test") {
    java.srcDir("tools/quality/domain-layer-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DomainForbiddenInfrastructureDependency")
        "error"("DomainModuleNoPublishedCarrierDependency")
    }
}

val domainLayerArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Domain Layer-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.domain.layer.DomainLayerArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkDomainLayerEnforcement") {
    group = "verification"
    description = "Run the dedicated Domain Layer enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(domainLayerArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":domainLayerTopologyCheck"))
    dependsOn(gradle.includedBuild("build-harness").task(":domainLayerDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkDomainLayerEnforcement")
}

tasks.named("check") {
    dependsOn("checkDomainLayerEnforcement")
}
