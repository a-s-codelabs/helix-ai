import { ChatMessage } from ".";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error occurred';
}

export function getErrorDetails(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export function safeDestroySession(session: AILanguageModel | null): void {
  if (session) {
    try {
      session.destroy();
    } catch (err) {
      console.warn('Error destroying session:', err);
    }
  }
}

export function createErrorMessage(error: unknown): ChatMessage {
  let msg = getErrorMessage(error)
  if (msg.includes("Requires a user gesture when availability")) {
    msg += " Please click here and try again."
  }
  return {
    id: Date.now() + 1,
    type: 'assistant',
    content: `❌ Error: ${getErrorMessage(error)}`,
    timestamp: new Date(),
  };
}
