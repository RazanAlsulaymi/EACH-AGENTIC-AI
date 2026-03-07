/**
 * Simple classnames utility for conditional classes
 */
export function cn(...inputs) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ')
}
