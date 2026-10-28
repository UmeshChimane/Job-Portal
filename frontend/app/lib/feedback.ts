// Browser/network and JSON parsing errors are technical details, not useful form feedback.
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof SyntaxError || error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
    return `${fallback.replace(/[.!]$/, "")}. Check your connection and try again.`;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
