/**
 * How a list or table follows the data detail slider.
 *
 * Level 6 is the Analyze level: the list is hidden when the slider reaches it and shown again when
 * the slider leaves it. Only a change of the level acts. Acting on every check would force the list
 * visible again right after the user hid it with the list's own button.
 */

/** The slider level at which the list gives its place to the Analyze section. */
export const ANALYZE_DETAIL_LEVEL = 6;

/**
 * What a change of the slider level does to the list.
 *
 * @param previousLevel The level the list last saw (null before it has seen any).
 * @param currentLevel The level now.
 * @param analyzeSectionAvailable False when the list has no Analyze section: it then stays at every level.
 * @param mayShowAgain False when the list must stay as it is when the slider leaves the Analyze level.
 * @returns "hide" or "show" to change the list, or "keep" to leave it as the user left it.
 */
export const resolveListVisibilityOnDetailLevelChange = (
    previousLevel: unknown,
    currentLevel: unknown,
    analyzeSectionAvailable: boolean,
    mayShowAgain: boolean,
): "hide" | "show" | "keep" => {
    if (currentLevel === previousLevel) return "keep";
    if (currentLevel === ANALYZE_DETAIL_LEVEL && analyzeSectionAvailable) return "hide";
    if (previousLevel === ANALYZE_DETAIL_LEVEL && mayShowAgain) return "show";
    return "keep";
};
