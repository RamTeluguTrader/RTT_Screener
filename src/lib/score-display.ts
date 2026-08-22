export function formatScoreWithMaximum(score: number | null, maximum: number): string {
  if (score === null) {
    return `N/A/${maximum}`;
  }

  return `${score}/${maximum}`;
}
