package features.hello;

import features.hello.input.MessageInput;
import features.hello.task.MessageTask;

/**
 * Minimal sample owner seam used to exercise the owner-boundary build checks with a tiny end-to-end flow.
 */
public final class HelloObject {

    public MessageInput message(MessageInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return MessageTask.message(input);
    }

    public static final class Main {
        public static void main(String[] args) {
            String target = args != null && args.length > 0 ? args[0] : "Salt Marcher";
            System.out.println(new HelloObject().message(new MessageInput(target)).text());
        }
    }
}
