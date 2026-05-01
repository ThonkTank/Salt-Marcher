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
    java.srcDir("tools/quality/data-gateway-enforcement/archunit/src/test/java")
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DataGatewayReturnTypeBoundary")
    }
}

val dataGatewayArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the Data Gateway-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    useJUnitPlatform()
    filter {
        includeTestsMatching("architecture.data.gateway.DataGatewayArchitectureTest")
    }
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

val checkDataGatewayEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Data Gateway enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(dataGatewayArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":dataGatewayEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDataGatewayEnforcement)
}

tasks.named("check") {
    dependsOn(checkDataGatewayEnforcement)
}
