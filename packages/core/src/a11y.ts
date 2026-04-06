/**
 * Accessibility-aware text extraction utilities.
 *
 * Pass `a11yTextExtractor` as the `textExtractor` option to
 * `createAskableContext()` to prefer accessible names and ARIA labels over
 * raw `textContent`:
 *
 * ```ts
 * import { createAskableContext, a11yTextExtractor } from '@askable-ui/core';
 *
 * const ctx = createAskableContext({ textExtractor: a11yTextExtractor });
 * ```
 */

/**
 * Returns the accessible text for an element, following a priority order that
 * mirrors the W3C Accessible Name and Description Computation algorithm
 * (simplified):
 *
 * 1. `aria-label` — explicit author-provided label
 * 2. `aria-labelledby` — references to other elements' text
 * 3. `title` attribute — tooltip/fallback label
 * 4. `alt` attribute — image alternative text
 * 5. `placeholder` — form field hint
 * 6. `textContent.trim()` — visible text (default fallback)
 *
 * This is the recommended extractor for applications where elements may have
 * accessible labels that differ from their visible content (icon buttons,
 * data cells with screen-reader-only descriptions, etc.).
 */
export function a11yTextExtractor(el: HTMLElement): string {
  // 1. aria-label — highest priority
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // 2. aria-labelledby — concatenate text from referenced elements
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy?.trim()) {
    const root = el.ownerDocument ?? document;
    const parts = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => root.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  // 3. title attribute
  const title = el.getAttribute('title');
  if (title?.trim()) return title.trim();

  // 4. alt attribute (img, area, input[type=image])
  const alt = el.getAttribute('alt');
  if (alt !== null && alt.trim()) return alt.trim();

  // 5. placeholder (inputs, textareas)
  const placeholder = el.getAttribute('placeholder');
  if (placeholder?.trim()) return placeholder.trim();

  // 6. Fallback to trimmed textContent
  return el.textContent?.trim() ?? '';
}
