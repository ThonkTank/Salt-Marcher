import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.creating
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder

val sourceSets = the<SourceSetContainer>()
val testSourceSet = sourceSets["test"]
val viewIntentHandlerEnforcementArchunit by sourceSets.creating {
    java.srcDir("tools/quality/viewintenthandler-enforcement/archunit/src/test/java")
    compileClasspath += testSourceSet.output + testSourceSet.compileClasspath
    runtimeClasspath += output + compileClasspath + testSourceSet.output + testSourceSet.runtimeClasspath
}

val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap { task -> task.destinationDirectory }

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "ViewIntentHandlerDependencyBoundary",
            "ViewIntentHandlerApplicationSinkBoundary",
            "ViewIntentHandlerViewInputEvent"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val viewIntentHandlerArchitectureTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Run only the ViewIntentHandler-focused architecture test suite."
    dependsOn(tasks.named("compileJava"))
    inputs.dir(mainJavaClassesDir)
    testClassesDirs = viewIntentHandlerEnforcementArchunit.output.classesDirs
    classpath = viewIntentHandlerEnforcementArchunit.runtimeClasspath
    useJUnitPlatform()
    doFirst {
        systemProperty("saltmarcher.mainClassesDir", mainJavaClassesDir.get().asFile.absolutePath)
    }
}

tasks.register("checkViewIntentHandlerEnforcement") {
    group = "verification"
    description = "Run all currently active ViewIntentHandler enforcement checks through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(viewIntentHandlerArchitectureTest)
    dependsOn(gradle.includedBuild("build-harness").task(":viewIntentHandlerTopologyCheck"))
}
