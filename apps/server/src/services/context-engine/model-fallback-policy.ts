/** A second model may run only before any user-visible output exists. */
export function shouldTryNextModelCandidate(input: {
  emittedDelta: boolean;
  accumulatedContent: string;
  hasNextCandidate: boolean;
  aborted: boolean;
}): boolean {
  return (
    input.hasNextCandidate &&
    !input.aborted &&
    !input.emittedDelta &&
    input.accumulatedContent.length === 0
  );
}
