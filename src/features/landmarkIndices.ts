/**
 * Centralized landmark index definitions for the MediaPipe Face Landmarker
 * (468-point face mesh topology). Keeping these in one place means the eye/
 * mouth geometry used for EAR/MAR/overlays is defined once and reused
 * everywhere, instead of magic numbers scattered through the codebase.
 */

/**
 * Six-point eye contours, ordered [outerCorner, upperLid1, upperLid2,
 * innerCorner, lowerLid1, lowerLid2] to match the standard EAR formulation:
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 */
export const LEFT_EYE_EAR = [362, 385, 387, 263, 373, 380] as const
export const RIGHT_EYE_EAR = [33, 160, 158, 133, 153, 144] as const

/** Fuller eye outline used purely for drawing the eye overlay. */
export const LEFT_EYE_OUTLINE = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
]
export const RIGHT_EYE_OUTLINE = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
]

/** Inner-mouth landmarks used for MAR, sampled as three vertical pairs plus width. */
export const MOUTH_MAR = {
  verticalPairs: [
    [82, 87],
    [13, 14],
    [312, 317],
  ] as const,
  horizontal: [78, 308] as const,
}

/** Outer lip outline used for drawing the mouth overlay. */
export const MOUTH_OUTLINE = [
  61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181, 61,
]

/** Approximate nose-tip landmark, used as the head-pose axis origin. */
export const NOSE_TIP = 1
