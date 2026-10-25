import { hasPendingCommit } from './commit-confirmation';

interface BookingDialogOptions {
  campaignId: string;
  current: () => boolean;
  send: (failed: (message: string) => void) => Promise<boolean>;
  lock: (busy: boolean) => void;
  report: (message: string) => void;
  confirmed: () => void;
}
/** The dialog owns presentation; writeConfirmed continues to own durable receipts. */
export class BookingDialog {
  private opening = 0;
  private running = false;
  get busy() {
    return this.running;
  }
  reset() {
    this.opening++;
    this.running = false;
  }
  async run(options: BookingDialogOptions): Promise<boolean> {
    if (this.running || !options.current()) return false;
    const opening = this.opening,
      current = () => opening === this.opening && options.current();
    const report = (message: string) =>
      options.report(
        message +
          (hasPendingCommit(options.campaignId)
            ? ' Über „Schließen“ zum Buchungsstatus wechseln.'
            : ' Eingaben bleiben erhalten.'),
      );
    if (hasPendingCommit(options.campaignId)) {
      report('Eine Buchung ist noch ungeklärt.');
      return false;
    }
    this.running = true;
    options.lock(true);
    let confirmed = false,
      failure: string | undefined;
    try {
      confirmed = await options.send((message) => {
        failure = message;
      });
    } catch (error) {
      failure = (error as Error).message;
    } finally {
      if (opening === this.opening) this.running = false;
      if (current()) options.lock(false);
    }
    if (!current()) return false;
    if (confirmed) options.confirmed();
    else report(failure ?? 'Buchung nicht bestätigt.');
    return confirmed;
  }
}
