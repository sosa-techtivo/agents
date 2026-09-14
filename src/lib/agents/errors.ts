/** Turns a caught error into a short, secret-free message safe to persist and show in the UI. */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Playwright errors put the useful summary on the first line and an
    // optional verbose call log after it; keep only the summary.
    return error.message.split("\n")[0].slice(0, 300);
  }
  return "Step failed with an unknown error.";
}
