package features.hello.task;

import features.hello.input.MessageInput;

@SuppressWarnings("unused")
public final class MessageTask {
    private MessageTask() {
        throw new AssertionError("No instances");
    }

    public static MessageInput message(MessageInput input) {
        return new MessageInput("Hello, Salt Marcher.");
    }
}
