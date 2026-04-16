# Architecture

SaltMarcher uses two complementary architectural rules at the same time:

1. Presentation uses MVCI.
2. Backend logic behind the UI uses standard Clean Architecture.

MVCI is only the presentation pattern. Domain and Data follow Clean Architecture with strict inward-pointing dependencies. View components do not talk to persistence, HTTP, files, SQL, JSON or framework-specific backend adapters directly. Features must hide internal details behind one public feature API.

## Project Structure

```text
bootstrap/      # Application startup and generic feature discovery.
shell/
    host/  # Passive host shell built once at startup.
    panel/ # Passive host panels / slots that components target.
src/
    view/
        <componentName>/
            <PascalComponentName>ViewContribution.java
            Model/
            Controller/
            View/
            interactor/
    domain/
        <featureName>/
            <featureName>API.java # Only public entrypoint for view interactors or other features.
            entity/
            valueobject/
            usecase/
            repository/
    data/
        <featureName>/
            repository/
            datasource/
                local/
                remote/
            model/
            mapper/
```

## Build And Commit Workflow

Use the existing Salt Marcher GitHub repository for this codebase. `salt-marcher/` remains a legacy reference directory, while active work happens in this `SaltMarcher/` working tree against the same upstream repository.

Build and install steps are mandatory after code changes:

- Run `./gradlew build --console=plain 2>&1` after every completed code change and fix all build failures before proceeding.
- Do not stop at `./gradlew build` alone when the desktop app is the manual test surface.
- By default, run `./gradlew installDesktopApp --console=plain 2>&1` after the build before handoff unless the user explicitly waives the reinstall or the task is purely planning/review work.
- Verification claims must stay literal. Do not imply that build, install, or manual checks happened unless they were actually run.

Commit discipline is mandatory as well:

- Create a focused commit for the completed change unless the user explicitly asks not to commit.
- Use Conventional Commits such as `feat: ...`, `fix: ...`, or `refactor: ...`.
- Keep each commit to one concern and call out packaging or workflow impacts explicitly when relevant.

## Dependency Rule

Presentation startup and composition live in `bootstrap/`. The shell stays passive after construction. Features describe themselves from inside `src/view/<component>/`, and bootstrap discovers those feature entrypoints generically without knowing concrete feature classes. Backend dependencies follow Clean Architecture, so domain defines the contracts and data implements them.

Allowed dependencies:

- `bootstrap -> shell`
- `view/<component>/<PascalComponentName>ViewContribution -> shell.host registration contracts`
- `view/<component>/interactor -> domain/<featureName>/<featureName>API`
- `domain/<featureName>/<featureName>API -> usecase/`
- `usecase/ -> repository/`
- `data/<featureName> -> domain/<featureName>`

Forbidden dependencies:

- `view/View -> domain/*`
- `view/Controller -> domain/*`
- `view/* -> data/*`
- `shell -> view/*`
- `shell -> view/<component>/interactor`
- `shell -> domain/*`
- `shell -> data/*`
- `shell -> domain internals`
- `bootstrap -> view/<component>`
- `bootstrap -> domain/*`
- `bootstrap -> data/*`
- `domain -> view`
- `domain -> shell`
- `domain -> data`
- `domain -> JavaFX`
- `domain -> HTTP/SQL/JSON/filesystem frameworks`

The shell is passive. It is built once, exposes pre-existing slots and open registration contracts, and is not revisited for feature-specific runtime composition. Features provide their own shell registration entrypoint under `src/view/<component>/`, and `bootstrap/` discovers those entrypoints generically. `<featureName>API.java` remains the only public feature boundary below the view interactor. Repository interfaces, use cases, entities, mappers and data sources are internal feature details and are not exposed outside the feature.

For view startup wiring, the only allowed shell-facing contracts are the generic types in `shell.host`: `ShellViewContribution`, `ShellContributionSpec`, `ShellScreen`, `ShellRuntimeContext`, `ContributionKey`, `NavigationGroupSpec`, `ShellTabSpec`, `ShellTopBarSpec`, `ShellRuntimeStateSpec` and `ShellTabMode`. The only currently supported runtime port from shell into feature wiring is `ShellRuntimeContext.inspector()` returning `InspectorSink`.

## Layer Responsibilities

### Bootstrap

`bootstrap/` owns application startup and presentation composition.

- It builds the shell once at startup.
- It starts component registration without implementing feature business logic.
- It may depend on generic shell registration contracts, but it must not import concrete feature classes from `src/view/<component>/`.
- It must not become a second shell or a domain orchestration layer.

### Shell

The shell is a passive host around the application UI.

- `shell/host`: Owns the passive host shell built once at startup.
- `shell/panel`: Defines passive host panels or slots that components target.
- The shell may define slot structure plus open registration contracts, but it must not know, start or mount feature components.
- The shell must not contain feature enums, feature-specific registries or per-feature switch statements.
- The shell must not implement domain rules.
- `ShellRuntimeContext` is the shell-owned runtime boundary exposed to feature roots. It is intentionally narrow and must not grow into a general service locator.

### View Layer

The view layer is JavaFX-specific, globally organized by component and follows MVCI.

- `Model`: JavaFX observable UI state only. No business rules, persistence or IO knowledge.
- `View`: Layout, bindings, UI events and view-local presentation behavior.
- `Controller`: UI orchestration, action wiring, background task setup, FX thread handoff and integration with the mounted component lifecycle.
- `interactor`: The only bridge from a view component to domain content. It invokes feature APIs, interprets results and updates the presentation model.
- public startup entrypoint: Exactly one public root entrypoint in `src/view/<component>/` named `<PascalComponentName>ViewContribution.java` that implements the shell registration contract, exposes a public no-arg constructor, returns one passive `ShellContributionSpec`, and creates a `ShellScreen` from `ShellRuntimeContext`.

Interactor rules:

- An interactor may depend on a feature's public API and on returned domain types that the API intentionally exposes.
- `View` and `Controller` must not depend on feature APIs or other domain internals.
- A view component must only interact with domain content through its interactor.
- An interactor must not call `data/` classes directly.
- An interactor must not call use cases, repository interfaces or repository implementations directly.
- An interactor must not contain HTTP, SQL, file, JSON or persistence logic.
- An interactor must not instantiate repository implementations, use case internals or data sources.

### Domain Layer

The domain layer is organized by feature and contains the business core of each feature.

- `entity/`: Core business entities with domain behavior and invariants.
- `valueobject/`: Immutable domain values with validation and domain meaning.
- `usecase/`: Application-specific business operations. Each use case answers one clear action or question.
- `repository/`: Interfaces required by use cases to load or persist domain objects.
- `<featureName>API.java`: The only public feature boundary exposed to view interactors or other features.

Domain rules:

- No JavaFX properties, nodes, tasks or bindings.
- No DTO/JSON/database record types as domain types.
- No infrastructure concerns such as HTTP clients, SQL queries, file handling or serialization libraries.
- Use cases depend on repository interfaces, never on repository implementations.
- Internal feature details stay hidden behind `<featureName>API.java`.

### Data Layer

The data layer is organized by feature and contains technical adapters around external systems and storage.

- `repository/`: Implements domain repository interfaces. Coordinates data sources and mapping.
- `datasource/remote`: External APIs, web services and other remote gateways.
- `datasource/local`: Database, cache, preferences or file-based storage.
- `model/`: Data-transfer and persistence models shaped for APIs, files or storage.
- `mapper/`: Translates between data models and domain entities/value objects.

Data rules:

- Data models may mirror JSON or storage format and may contain serialization code.
- Repository implementations return domain types, not raw data models, to the domain layer.
- Business rules do not live in data sources, data models or repository implementations beyond technical merge/cache concerns.

## Standard Flow

A normal feature flow looks like this:

`Bootstrap builds shell -> Bootstrap discovers feature entrypoints under src/view/<component>/ -> Feature entrypoint supplies ShellContributionSpec + ShellScreen -> Bootstrap registers contribution by spec type -> Shell mounts slot content generically into the passive host -> View event -> Controller action -> Interactor -> Feature API -> Domain use case -> Domain repository interface <- Data repository implementation -> Data source -> Data model -> Mapper -> Domain result -> Interactor -> Presentation model`

Inspector flow is the one supported runtime exception to purely static slot mounting:

`View/Controller/Interactor -> ShellRuntimeContext.inspector().push(...) -> shared shell inspector history`

The interactor is the only boundary translator between reactive JavaFX state and the clean backend core. Feature APIs are the public entrypoints into business logic. Data is only reached through domain repository contracts inside the feature, and data depends on domain contracts rather than the other way around. The shell remains unchanged after startup construction.

## Placement Rules

Use these default decisions when adding code:

- If the code exists to start the application, build the shell once, or generically discover feature entrypoints without naming concrete features, put it in `bootstrap/`.
- If the code exists to host passive slots or define shell structure without domain logic, put it in `shell/`.
- If the code exists to render or bind JavaFX UI, put it in `src/view/<componentName>/View`.
- If the code exists to manage JavaFX screen state, put it in `src/view/<componentName>/Model`.
- If the code exists to wire actions, tasks or UI lifecycle, put it in `src/view/<componentName>/Controller`.
- If the code exists to convert UI intent into feature API calls and results back into UI state, put it in `src/view/<componentName>/interactor`.
- If the code exists to declare a component's public shell registration entrypoint, keep that one public startup surface in `src/view/<componentName>/<PascalComponentName>ViewContribution.java`.
- If the code expresses business meaning or invariants for one feature, put it in `src/domain/<featureName>/entity` or `valueobject`.
- If the code represents a user-triggered or system-triggered application action for one feature, put it in `src/domain/<featureName>/usecase`.
- If business logic feels like it would need a separate `service`, move it into the owning `entity`, the relevant `valueobject`, or a single-purpose `usecase` unless that would clearly violate one of those boundaries.
- If the code is the public boundary of a feature, put it in `src/domain/<featureName>/<featureName>API.java`.
- If the code defines required persistence/query operations for one feature, put the interface in `src/domain/<featureName>/repository`.
- If the code talks to a database, file, API, cache or device service for one feature, put it in `src/data/<featureName>/datasource`.
- If the code adapts raw external data to domain objects, put it in `src/data/<featureName>/mapper`.
- If the code implements a domain repository interface, put it in `src/data/<featureName>/repository`.

## Explicit Non-Goals

To keep the architecture stable, do not:

- pass JavaFX types into `domain/` or `data/`
- expose `data/` classes through `<featureName>API.java`
- return data-layer models from use cases
- call domain content directly from views or controllers
- call repositories or data sources directly from view components
- let the shell compose, start or mount feature components
- let the shell implement feature logic
- let the shell call feature APIs or interactors directly
- let the shell hold closed feature enums or a manually curated feature registry
- let controllers own application startup or slot mounting as the default convention
- let bootstrap import concrete feature classes from `src/view/<component>/`
- let bootstrap call feature APIs or data adapters directly
- expose internal feature details outside `<featureName>API.java`
- skip the interactor and let a view component talk to a feature API directly
- skip a feature API and let the interactor talk to feature internals for convenience
- introduce `service/` or `services/` as a domain directory or architectural escape hatch
- introduce a second shell wiring path besides `ShellViewContribution -> ShellScreen -> ShellSlot`
- use `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry` or concrete shell panel classes from `src/view/`
- register content directly in `AppShell` from feature code
- create feature-owned alternate registries for top bar, runtime state or inspector content
- couple runtime state content to one specific runtime tab instead of publishing autonomous global runtime-state tabs

## Feature Registration Convention

- A new top-level feature must be addable by creating code only inside `src/`.
- Each navigable feature owns exactly one public shell entrypoint in `src/view/<component>/`.
- The entrypoint file must be named `<PascalComponentName>ViewContribution.java` and declare package `src.view.<component>`.
- That entrypoint must be a `public final` class with a public no-arg constructor.
- That entrypoint implements `shell.host.ShellViewContribution`, declares exactly one passive contribution spec, and returns a feature-owned `ShellScreen`.
- Allowed contribution spec types are:
  - `ShellTabSpec` for navigable tabs in the left bar
  - `ShellTopBarSpec` for always-visible top bar dropdown or control content
  - `ShellRuntimeStateSpec` for autonomous runtime-state tabs in the shared lower-right panel
- Navigation groups are open metadata supplied by the feature. They are not closed enums maintained in `shell/`.
- The component root under `src/view/<component>/` is reserved for that entrypoint only. All other presentation classes live under `Model/`, `Controller/`, `View/` or `interactor/`.
- `bootstrap/` must discover these entrypoints generically. Adding a new feature must not require routine edits in `bootstrap/` or `shell/`.
- There is exactly one allowed shell wiring path for new `src/` content: `ShellViewContribution -> ShellScreen -> ShellSlot`.
- `ShellScreen` may only target the fixed shell-owned slots `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS` and `COCKPIT_STATE`.
- Slot rules depend on the contribution spec type:
  - `ShellTabSpec`: `COCKPIT_MAIN` is required and `COCKPIT_CONTROLS` is optional.
  - `ShellTabSpec` with `ShellTabMode.RUNTIME`: feature code must not provide `COCKPIT_STATE`; the shell shows the shared runtime-state panel there.
  - `ShellTabSpec` with `ShellTabMode.EDITOR`: `COCKPIT_STATE` is optional and fills the lower-right panel when present.
  - `ShellTopBarSpec`: only `TOP_BAR` is allowed.
  - `ShellRuntimeStateSpec`: only `COCKPIT_STATE` is allowed.
- `defaultLanding` only applies to `ShellTabSpec`.
- `ShellTabMode.RUNTIME` means the tab uses the shared runtime-state panel. `ShellTabMode.EDITOR` means the tab may provide its own lower-right state content.
- Inspector content is not a static contribution type. Features push inspector entries through `ShellRuntimeContext.inspector()` and the shell owns the shared history.
- Runtime-state tabs are global and autonomous. They appear whenever any runtime tab is active and are not owned by one specific runtime tab.
- Features must not talk to `AppShell` directly and must not use `AppView`, `ShellServices`, `DetailsNavigator`, `SceneRegistry` or concrete shell panels as alternate wiring paths.

### Minimal Feature Skeleton

```text
src/
    view/
        encounter/
            EncounterViewContribution.java
            Model/
            Controller/
            View/
            interactor/
    domain/
        encounter/
            encounterAPI.java
            api/
            entity/
            valueobject/
            usecase/
            repository/
    data/
        encounter/
            repository/
            datasource/
                local/
                remote/
            model/
            mapper/
```

```java
package src.view.encounter;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.NavigationGroupSpec;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellScreen;
import shell.host.ShellTabMode;
import shell.host.ShellTabSpec;
import shell.host.ShellViewContribution;
import shell.panel.ShellSlot;

import java.util.Map;

public final class EncounterViewContribution implements ShellViewContribution {

    public EncounterViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("encounter"),
                new NavigationGroupSpec("session", "Session", 10),
                20,
                false,
                ShellTabMode.RUNTIME);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Encounter";
            }

            @Override
            public String getNavigationLabel() {
                return "Enc";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_MAIN, createMainContent());
            }
        };
    }

    private Node createMainContent() {
        return null; // Replace with the feature-owned main component.
    }
}
```

### Contribution Cheatsheet

- `ShellTabSpec` + `ShellTabMode.RUNTIME`: navigable left-bar tab, requires `COCKPIT_MAIN`, gets shared runtime-state panel, may optionally provide `COCKPIT_CONTROLS`.
- `ShellTabSpec` + `ShellTabMode.EDITOR`: navigable left-bar tab, requires `COCKPIT_MAIN`, may optionally provide `COCKPIT_CONTROLS` and `COCKPIT_STATE`.
- `ShellTopBarSpec`: global always-on top bar content, may only provide `TOP_BAR`.
- `ShellRuntimeStateSpec`: global autonomous runtime-state tab, may only provide `COCKPIT_STATE`.

### Additional Examples

```java
public final class GlobalToolsViewContribution implements ShellViewContribution {
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("global-tools"), 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Global Tools";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.TOP_BAR, createTopBarMenu());
            }
        };
    }
}
```

```java
public final class PartyStateViewContribution implements ShellViewContribution {
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("party-state"), "Party", 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Party State";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, createPartyStateView());
            }
        };
    }
}
```

## MVCI View
Reactive Programming

Let’s talk a little bit about “Reactive” programming. What is it?

There’s a few ways to look at it:

Static Layouts that Behave Dynamically
    This is a really important concept. Reactive systems allow you to create a layout as static elements, meaning that you don’t actually change the Nodes that are on the screen, add new Nodes or take any away. Instead the screen Nodes are connected to data elements that control how they work. Changes in those data elements result in dynamic changes to the screen that the user sees. At the back-end of the system, there are business rules that update those data elements as nothing more than data, without any knowledge of how those data elements will impact the screen.
State Data is a Pipeline Between the Business Logic and the View
    This is another way to look at it. The “State” of the GUI is represented by some collection of data which is connected to the various properties of the elements of the View. Either end can potentially change some of that data, at which point it is available to the other end instantly. Both ends of the pipeline are free to interpret that data in a context which has meaning to it, without understanding what it means to the other end. So a layout may use a Boolean State element to control whether a Button is enabled, but the business logic end may interpret that same Boolean State element to mean that a date value somewhere is invalid.

In JavaFX this means that you have an Object composed of Observables of some sort. These can be Properties, Bindings, ObservableLists or any their relatives. These Observables are bound to various properties of the Node elements that make up the layout.

Generic Reactive programming descriptions talk about “streams”, which is essentially the function provided by the Observables and the Binding classes.

The simple truth is that JavaFX provides all of the tools to build Reactive applications and, in fact, it works best when you use it that way.
Why Use a Framework?Permalink

Frameworks are designed to limit coupling between the GUI, the business logic and the control logic. Excessive coupling is by far the biggest issue with application design, and it makes it very difficult to understand how an application works, to make changes, find and fix bugs, and to extend the application.

One of the ways to evaluate coupling is to look at how much of its functionality a component exposes to the rest of the application, and how much it “knows” about the functionality of other components of the application. The more of this that you have, the more coupling that you have.

When a component exposes some of its functionality to the rest of the application and that functionality is changed, then you have to look at all of the places that knowledge of that functionality is used, and evaluate how it needs to be changed as well. Often, you’ll find that some of those places are in functionality of other components that are also exposed to the rest of the application, so you need to track down where that knowledge is used and change them too. And so on, and so on…

These couplings are also called “dependencies”. Dependencies also have direction and we can say that, “This component is dependent on this aspect of this other component”. Coupling becomes even worse when you have multiple dependencies between two components that go in either direction. A good framework should also try to manage the direction of the dependencies, in order to limit complexity of the coupling.

At the end of the day, a framework is just a “Design Pattern”. That is to say, an accepted way of coding something that has already been thought out so that you don’t have to “reinvent the wheel” in your application code. Other programmers can look at your code and say, “I recognize this”, even if they’ve never seen your code before.
Why Use MVCI?Permalink

Because it works, it dovetails nicely with Reactive JavaFX, and it’s easy to understand.

We’re not going to talk a great deal about the other frameworks here, but there are two questions that need to be addressed:

Why not use Model-View-Controller?
    For one simple reason: MVC does not allow for Reactive programming. You can bind View elements to the Model, but exclusively in a Read-Only mode. Any changes to the Model from the View have to be transmitted through the Controller. It’s a basic element of this framework. You can ignore this, but then you’re not using MVC any more.
Why not use Model-View-ViewModel?
    MVVM does provide for binding between the ViewModel and the View elements, so that’s a step in the right direction. However, there’s no Reactive connection allowed for between the Model and the ViewModel. You end up with a lot of methods to handle data transfer between the ViewModel and the Model which creates an enormous amount of coupling. This gets very confusing very quickly.

Both of these answers sound a bit like technical nit-picking that you could probably just ignore. In practice though, these represent issues that you end up having to work around - even if you don’t realize it. It gets messy very quickly.

If you use MVCI, you really don’t have to worry about these things. They’re just not a factor. MVCI deals with it for you and you’re not going to get tangled up in unexpected consequences of your design decisions.
What Does MVCI Look Like?Permalink

MVCI has four components: a Model, a Controller, a View and an Interactor. Let’s look at what each of these do:

The Model
    The Model is the data representation of the “State” of the GUI. It’s just a POJO with the fields composed of JavaFX Observable types. There’s no logic, or any other code that’s not directly related to sharing the data fields.
The View
    The View is not just a passive layout, but a complete user interface for the framework. This means that it has all of the logic to handle user clicks and to capture and handle any GUI events. The View is passed a reference to the Model, and it binds the properties of the various Nodes contained in the layout to the properties contained in the Model.
The Controller
    The Controller is responsible for “how” things happen in the framework. It instantiates all of the other components, provides for integration with other parts of the application, defines “actions” for GUI events, and handles all of the threading.
The Interactor
    The Interactor is the presentation-side application logic component of MVCI. It translates between the JavaFX Model and the domain layer through the public Feature API of a feature. It may work with domain types that the Feature API intentionally exposes, but it does not call use cases, repositories or data adapters directly.

Here’s a diagram of how it all goes together:

MVCI Diagram
Dependencies in MVCIPermalink

Since managing coupling is the whole point of a framework, let’s look at how the dependencies work in MVCI.

Dependencies almost always manifest themselves in non-private methods, including the constructors. Every time you see a non-private method, you’re looking at a potential dependency. It also tells you the direction of the dependency because the other components become dependent on that method. At the same time, the parameters required by a non-private method represent dependencies in the other direction, as these are things that the calling objects need to provide.

From this perspective, you can consider constructors with parameters to be dependencies from the object back to the object that constructs it. Because every class needs a constructor, having one doesn’t increase the coupling in that direction at all, but adding parameters creates dependencies back to the constructing class.

Let’s look at where the non-private methods are found in MVCI:

The Model
    You can see from the diagram above that all of the other three components have access to the Model. In fact, this is the main dependency in MVCI as the View, the Controller and the Interactor all have it as a dependency. As a POJO, it’s going to consist entirely of a bunch of field declarations, plus all of the accompanying getters and setters to allow other objects to access those fields. I’ve never seen a reason to have any constructor parameters in a Model.
The Controller
    We’ll look at this a bit later, but the only non-private method in the Controller is something like a getView() method that returns a reference to the View as a Node or a Region (usually Region). In a complex application with multiple MVCI frameworks that need to share data or functionality, it is possible to have constructor parameters in Controllers, essentially creating dependencies on those external frameworks.
The Interactor
    The Interactor gets a reference to the Model passed to it from the Controller via a parameter in its constructor. This is generally the only parameter in the Interactor’s constructor. In order to do work, the Interactor needs to have a number of non-private methods that Controller can call. These all create dependencies on the Interactor in the Controller.
The View
    From the perspective of non-private methods, the View as an instance of Region has no dependencies at all (other than those of Region). However, it’s usually implemented via a Builder, and that has at least one constructor parameter - the Model. Additionally, the ViewBuilder can have constructor parameters to provide handlers for actions. These put dependencies from the ViewBuilder to the Controller. In order to create the View, the Controller must pass a reference to the Model plus any action handlers required.

What Goes Where in MVCI?Permalink

Now let’s look at this from the other direction. How do you know where to put various pieces of functionality? MVCI is designed to make this extremely easy, so let’s look at the main items:

Layout
    Layout goes in the View. This includes creating binding between the Model and the properties of the Nodes in the layout.
Event Handlers
    Events are GUI elements, and their handlers go in the View. When EventHandlers need to perform actions that involve something other than the layout, they invoke “Action Performers” provided by the Controller.
Action Performers
    Action Performers are functional elements that perform some kind of action. These are defined in the Controller. If an Action Performer is needed by the View so that it can invoke it from an EventHandler, then it will be passed to the View via a constructor parameter.
Threading
    In JavaFX, threading is generally implemented using something like Task. Creation and configuration of Task objects and running them in background Threads is handled in the Controller.
Business/Application Logic
    Presentation-specific application logic goes into the Interactor. This includes initializing bindings in the Model, translating UI actions into domain requests and translating domain results back into presentation state. Core business rules belong in domain Entities, Value Objects and Use Cases.
Domain Stuff
    Domain logic lives in the Domain layer. The Interactor should call the public Feature API of a feature. That API delegates to Use Cases, which depend on Domain Repository interfaces. Technical access to persistence, files, APIs or other systems is implemented behind those interfaces in the Data layer.
ChangeListeners
    These can go in one of two places. If the actions performed by the ChangeListener are entirely related to the View, then put it there. Otherwise it goes in the Controller, which will probably call a method in the Interactor to do the work.

The ViewBuilderPermalink

The MVCI framework doesn’t specifically call for a ViewBuilder, but I’d call this a “best practice”.

There’s a general rule in JavaFX:

    Extend a class to add new functionality, use a Builder when all you are doing is configuring an existing Node subclass.

What does “add new functionality” mean? In this case it really boils down to adding new non-private methods. In practice, you’re usually not going to add functionality, you’re just going to configure a Node or create a layout by adding configured Nodes via getChildren(). So builders are usually the way to go.

A “Builder” can be any method that returns a Node subclass. JavaFX provides a handy interface called Builder which just defines a single method, build(). It’s generic, so you specify the type for the returned Node subclass.

In MVCI we’re going to create a Region subtype (like Pane, StackPane, VBox or BorderPane) that we’re going to return as an instance of Region. So in the Controller, we’ll instantiate a ViewBuilder that implements Builder<Region> and pass any dependencies, like the Model to it in its constructor. Then we’ll call ViewBuilder.build() to get the View.

What I usually do is set the ViewBuilder as a field in the Controller and instantiate it in the Controller’s constructor. Then I create a delegate method in the Controller like this:

public Region getView() {
   return viewBuilder.build();
}

If you’re paying even the tiniest bit of attention, you’ll realize that this means that there’s no reference to the View itself that’s maintained inside of the MVCI framework! So there’s no formal dependencies to or from the View anywhere inside the framework. Of course, the Bindings used in the layout to create the View create coupling between the View and the Model, but this can be completely managed by ignoring them in the View, and concentrating on the ViewBuilder and its dependencies.

The other important thing to note is that the Builder allows us to return a Region instead of whatever actual class was used to create the layout. Region only exposes a small number of methods that are useful for controlling its presentation in another layout. Things like Region.setMaxWidht(), or Region.setPadding(). You can get rid of those by returning Node instead.

This is important because it turns your View into a “black box” screen component that you can use anywhere you can use any other Node or Region. And you can do this without worrying about about what’s going on inside it, or any of the other parts of the framework, because they don’t matter from this perspective.
An ExamplePermalink

Let’s look at how you’d actually code this up. This is just a simple example with enough data in the Model and enough features to give an idea of how it all goes together and works.
The ModelPermalink

We’ll look at the Model first, since it’s the simplest class:

public class Model {

    private final StringProperty property1 = new SimpleStringProperty("");
    private final StringProperty property2 = new SimpleStringProperty("");
    private final BooleanProperty property3 = new SimpleBooleanProperty(false);

    public String getProperty1() {
        return property1.get();
    }

    public StringProperty property1Property() {
        return property1;
    }

    public void setProperty1(String property1) {
        this.property1.set(property1);
    }

    public String getProperty2() {
        return property2.get();
    }

    public StringProperty property2Property() {
        return property2;
    }

    public void setProperty2(String property2) {
        this.property2.set(property2);
    }

    public void bindProperty3(BooleanBinding binding) {
        property3.bind(binding);
    }

    public ObservableBooleanValue property3Property() {
        return property3;
    }

    public String getProperty3() {
        return property3.get();
    }

}

This is basically the JavaFX version of a “Bean”. Each field is final and private, and there are delegate methods for getting and setting the values. Finally, there are getters for references to the properties themselves. Note that there is no logic or any relationships between the fields established in the Model - it’s just a wrapper for Observable data.

The field property3 is a bit different. Since this is intended to be a read-only value based upon one or more of the other fields, it does not have delegate setter for the value. The getter for the property returns a type of ObservableBooleanValue which means that it’s read only, so no program can attempt to set its value via set(). There’s a method to allow the Binding to be set on the property. We’ll see how this works in the Interactor.
The ControllerPermalink

public class Controller {

    private final Model model;
    private final Interactor interactor;
    private final ViewBuilder viewBuilder;

    public Controller() {
        model = new Model();
        interactor = new Interactor(model);
        viewBuilder = new ViewBuilder(model, this::saveData);
        setProperty1Listener();
    }

    private void saveData(Runnable postActionGuiCleanup) {
        Task<Void> saveTask = new Task<>() {
            @Override
            protected Void call() {
                interactor.saveData();
                return null;
            }
        };
        saveTask.setOnSucceeded(evt -> {
            interactor.updateModelAfterSave();
            postActionGuiCleanup.run();
        });
        Thread saveThread = new Thread(saveTask);
        saveThread.start();
    }

    private void setProperty1Listener() {
        model.property1Property().addListener(ob -> interactor.updateChangeCount());
    }

    public Region getView() {
        return viewBuilder.build();
    }
}

The constructor for the Controller is the bootstrap for the framework. It instantiates the Model first, then passes it to the constructors of the Interactor and the ViewBuilder. The Controller doesn’t actually do anything itself, but it does control how things are done. The saveData() method handles the background threading for the “Save” action, and calls Interactor methods to do the various stages of the work.

The method getView() is just a delegate to the build() method of the ViewBuilder. It’ll create a new view every time you call it, which shouldn’t really cause any problems as far as the framework is concerned. You could convert this to a “lazy load” model if you wanted to limit it to a single instance of the View.

Finally, just to show how it would work, there’s an InvalidationListener installed on Model.property1. You can see how it just calls a method in the Interactor to do the actual work.
The ViewBuilderPermalink

public class ViewBuilder implements Builder<Region> {

    private final Model model;
    private final Consumer<Runnable> actionHandler;

    public ViewBuilder(Model model, Consumer<Runnable> actionHandler) {
        this.model = model;
        this.actionHandler = actionHandler;
    }

    @Override
    public Region build() {
        BorderPane results = new BorderPane();
        results.setCenter(createMainBox());
        results.setBottom(createButton());
        results.setMinWidth(300);
        results.setMinHeight(200);
        return results;
    }

    private Node createMainBox() {
        VBox results = new VBox(10,
                new HBox(6, new Label("Value 1:"), createBoundTextField(model.property1Property())),
                new HBox(6, new Label("Value 2:"), createBoundTextField(model.property2Property()))
        );
        results.setPadding(new Insets(20));
        return results;
    }

    private Node createBoundTextField(StringProperty boundProperty) {
        TextField results = new TextField();
        results.textProperty().bindBidirectional(boundProperty);
        return results;
    }

    private Node createButton() {
        Button button = new Button("Save");
        BooleanProperty saveRunning = new SimpleBooleanProperty(false);
        button.disableProperty().bind(Bindings.createBooleanBinding(() -> (!model.property3Property().get() || saveRunning.get()),
                model.property3Property(),
                saveRunning));
        button.setOnAction(evt -> {
            saveRunning.set(true);
            actionHandler.accept(() -> saveRunning.set(false));
        });
        HBox results = new HBox(button);
        results.setAlignment(Pos.CENTER_RIGHT);
        return results;
    }
}

We’re not going to look at this too closely, because this article isn’t about creating layouts. The result is a BorderPane with a couple of Labels and TextFields in the centre, and a Button at the bottom. The two TextFields have their text properties bound to the two StringProperties in the Model, and the Disable property of the Button is bound to the BooleanProperty in the Model.

The OnAction EventHandler on the Button might need some explanation. One of the big problems with Buttons is that people can double click them - or at least click them while the action is still running. Unless you’re OK with that, you need to disable a Button as soon as it’s clicked, and then enable it when the action is completed.

Since we’re going to have some binding logic that disables the Button if Model.property1 is empty, we can’t directly disable the Button when it’s clicked. So we introduce a BooleanProperty that indicates that the action is running, and then we Bind the Disable property of the Button to a combination of the two properties. Then we control that property that indicates the action is running to ensure that the Button stays disabled.

If you go back to the Controller, you can see how the Runnable that sets that BooleanProperty back to false is invoked when the Task has completed.
The InteractorPermalink

public class Interactor {

    private final Model model;
    private int changeCount = 0;
    private DomainObject domainObject;
    private SaveDataUseCase saveDataUseCase = new SaveDataUseCase();

    public Interactor(Model model) {
        this.model = model;
        createModelBindings();
    }

    private void createModelBindings() {
        model.bindProperty3(Bindings.createBooleanBinding(() -> !model.getProperty1().isEmpty(), model.property1Property()));
    }

    public void updateModelAfterSave() {
        model.setProperty1("");
        model.setProperty2(domainObject.getSomeValue());
        changeCount = 0;

    }

    public void saveData() {
        domainObject = saveDataUseCase.execute(model.getProperty1() + " --> " + changeCount);
    }

    public void updateChangeCount() {
        changeCount++;
    }
}

First, take a look at the constructor, and you can see how the Interactor contains the presentation-side logic to bind the value in Model.property1 to the value in Model.property3. This idea, that the save action shouldn’t be allowed if the value in Model.property1 is empty, belongs outside the View. In a larger feature, the Interactor would call a domain Use Case for the actual save and then map the result back into the Model.

There’s also a method, updateChangeCount(), that supports the InvalidationListener in the Controller.

Finally, we have the two methods that handle the save. The first, saveData() is the code that runs on the background thread. It can read data from the Model, but it cannot update it (that has to happen on the FXAT), while it can freely update other data stored as fields in the Interactor. The other method, updateModelAfterSave() is intended to run on the FXAT, it can freely read and write data in the Model, as well as all of the other fields in the Interactor.

Note that both of these methods are intended to run specifically on either a background thread or the FXAT, but they don’t have any logic (or knowledge at all, really) about the threads contained within them.
Domain StuffPermalink

Just so that you don’t have to use your imagination to see how the Interactor interacts with domain objects, we’ve got some of that stuff too. In the actual project structure, a real save flow should go through a Domain Use Case and a Domain Repository interface, with any DAO or API implementation living in the Data layer.

public class SaveDataUseCase {

    public DomainObject execute(String string) {
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        return new DomainObject(string + " - Saved");
    }

}

The use case is very simple, it only has one method, execute(), and it just waits for 3 seconds and returns an instance of the DomainObject.

public class DomainObject {

    private final String someValue;

    public DomainObject(String someValue) {
        this.someValue = someValue;
    }

    public String getSomeValue() {
        return someValue;
    }
}

The DomainObject is just a POJO to hold a single data value.
Using the FrameworkPermalink

So, how do you get all this stuff on the screen?

You need to get the JavaFX engine up and running, and that means using the Application class, and using Application.start() to configure your Stage and Scene:

public class MvciApplication extends Application {
    @Override
    public void start(Stage stage) throws Exception {
        stage.setScene(new Scene(new Controller().getView()));
        stage.show();
    }
}

This is pretty simple, instantiate the Controller and then call getView() to get the View. Put the View in a Scene which is, in turn, put into the Stage. Show the Stage. Voila!
What it Looks LikePermalink

At the beginning:

Demo Start

While it’s running:

Demo Running

When it’s done:

Demo Done
FXML PolicyPermalink

FXML is not used in this project. JavaFX Views are built exclusively in Java code, typically through a ViewBuilder, and all layout, bindings and event wiring are implemented directly in code.
ConclusionPermalink

If you’re going to use JavaFX as a Reactive platform, which you should, then Model-View-Controller-Interactor is the way to go. It’s easy to understand and yet deals with all of the issues that you’re likely to encounter in a logic and straight-forward fashion.

Personally, I find it so easy to implement MVCI that even when I’m writing the simplest of example code I immediately just create the 4 classes that you need and go from there. I don’t feel any temptation to skip those classes and chuck everything into one place - there’s literally no advantage to that.
