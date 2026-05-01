import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("ViewDirectRenderStylingPlacement")
    }
}

val checkStylingViewEnforcement by tasks.registering {
    group = "verification"
    description = "Run the passive View direct-render styling enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
}
