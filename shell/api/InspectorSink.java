package shell.api;

/**
 * Shell-owned runtime port for pushing global inspector entries.
 */
public interface InspectorSink {

    void push(InspectorEntrySpec entry);

    void clear();

    boolean isShowing(Object entryKey);
}
