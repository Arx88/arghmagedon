/**
 * How each of the four guns looks while its shot is in the air.
 *
 * These lived inside game.js as bare arrays, which is exactly why the projectiles
 * all read the same: one shared sphere, one alpha, one spin rate and two kinds of
 * smoke for four different guns. Keeping the tables here makes them pinnable — the
 * test suite can assert the guns actually differ instead of trusting a comment.
 */

/** Iron is cold grey, chain is pale steel, the firepot burns amber, the bomb is scorched red. */
export const BALL_COLOR = [0x5a6672, 0xaeb8ab, 0xffb15b, 0x8a3a26];

/** Body shape per gun: a round shot, a tumbling bar of linked iron, a pot, a heavy shell. */
export const BALL_SCALE = [[1, 1, 1], [2.5, .55, .55], [1.35, 1.35, 1.35], [1.95, 1.95, 1.95]];

/** Radians per second. Iron spins fast and reads as a smooth dot; chain turns slowly. */
export const BALL_SPIN = [15, 6, 11, 8];

/** What streams off it: smoke for cold iron, fire for the pot, soot for the rising bomb. */
export const WAKE_PUFF = ['smoke', 'smoke', 'fire', 'soot'];

export const WAKE_SIZE = [.13, .1, .22, .19];
export const WAKE_LIFE = [.45, .35, .6, .5];

/**
 * How far a wake puff expands between spawning and fading out.
 *
 * Smoke and soot swell to roughly 2.8x their spawn size; fire shrinks instead,
 * because an open flame has nothing left to billow into. These are the numbers
 * the spacing below is derived from, kept here so the wake cannot be tuned
 * against the wrong one.
 */
export const WAKE_GROWTH = [2.8, 2.8, 1, 2.8];

/**
 * Spacing between wake puffs, in world units travelled — not in seconds.
 *
 * On a timer the spacing is speed times interval, and these guns run at 24-38
 * units per second, so a puff every 25ms landed most of a unit from the last
 * one: the wake came out as a dotted line of separate blobs. Measuring distance
 * keeps the gap constant however fast the shot is going.
 *
 * Each gap is a fraction of the puff's *grown* size, which is what actually has
 * to close for consecutive puffs to read as one trail.
 */
export const WAKE_GAP = WAKE_SIZE.map((size, i) => +(size * WAKE_GROWTH[i] * .68).toFixed(3));