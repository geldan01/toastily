/**
 * Achievements / milestones (PRD §11, issue #64). Lightweight badges that
 * celebrate member progress, derived *purely* from participation we already
 * record — no new schema, no destructive writes. Earned badges are computed on
 * the fly from the per-member aggregate counts.
 *
 * The catalog is data-driven (a typed list of metric + threshold definitions),
 * so a club tunes milestones in one place. Role-based milestones key off role
 * *flags* (e.g. `grants_meeting_authority` → "chaired a meeting") rather than a
 * hard-coded role name, per the "roles are data, not enums" rule.
 */

/** A countable signal a milestone tests against (see `MilestoneMetrics`). */
export type MilestoneMetric
  = | 'attended'
    | 'speeches'
    | 'evaluations'
    | 'roles'
    | 'distinctRoles'
    | 'chaired'
    | 'awards'

/** Grouping for display (an icon/colour is chosen per category in the UI). */
export type MilestoneCategory
  = | 'attendance'
    | 'speaking'
    | 'evaluation'
    | 'roles'
    | 'leadership'
    | 'awards'

export interface MilestoneDef {
  /** Stable key — drives the bilingual i18n name/description (`milestones.<key>.*`). */
  key: string
  category: MilestoneCategory
  metric: MilestoneMetric
  /** Inclusive count at which the badge is earned. */
  threshold: number
}

/** A member's participation reduced to the counts the catalog tests. */
export interface MilestoneMetrics {
  attended: number
  speeches: number
  evaluations: number
  roles: number
  /** Distinct meeting roles ever held — powers role-variety badges. */
  distinctRoles: number
  /** Times signed up for a role that grants meeting authority (the chair). */
  chaired: number
  awards: number
}

export interface EarnedMilestone {
  key: string
  category: MilestoneCategory
  /** The threshold reached — lets the UI label tiers and sort within a category. */
  threshold: number
}

/**
 * The milestone catalog. Tunable in one place; clubs can add tiers or adjust
 * thresholds without touching the aggregation logic. Order is the display order
 * within each category (ascending threshold).
 */
export const MILESTONE_CATALOG: readonly MilestoneDef[] = [
  // Attendance
  { key: 'first_meeting', category: 'attendance', metric: 'attended', threshold: 1 },
  { key: 'ten_meetings', category: 'attendance', metric: 'attended', threshold: 10 },
  { key: 'twenty_five_meetings', category: 'attendance', metric: 'attended', threshold: 25 },
  // Prepared speeches
  { key: 'first_speech', category: 'speaking', metric: 'speeches', threshold: 1 },
  { key: 'five_speeches', category: 'speaking', metric: 'speeches', threshold: 5 },
  { key: 'ten_speeches', category: 'speaking', metric: 'speeches', threshold: 10 },
  // Evaluations given
  { key: 'first_evaluation', category: 'evaluation', metric: 'evaluations', threshold: 1 },
  { key: 'ten_evaluations', category: 'evaluation', metric: 'evaluations', threshold: 10 },
  // Meeting roles
  { key: 'first_role', category: 'roles', metric: 'roles', threshold: 1 },
  { key: 'role_variety', category: 'roles', metric: 'distinctRoles', threshold: 3 },
  { key: 'role_explorer', category: 'roles', metric: 'distinctRoles', threshold: 5 },
  // Leadership — keyed off the grants_meeting_authority flag, not the role name
  { key: 'first_chair', category: 'leadership', metric: 'chaired', threshold: 1 },
  { key: 'five_chairs', category: 'leadership', metric: 'chaired', threshold: 5 },
  // Awards
  { key: 'first_award', category: 'awards', metric: 'awards', threshold: 1 },
  { key: 'five_awards', category: 'awards', metric: 'awards', threshold: 5 },
]

/**
 * The badges a member has earned, given their participation metrics. Pure — a
 * milestone is earned when its metric meets or exceeds the threshold. Catalog
 * order is preserved (attendance → speaking → … → awards, ascending tiers).
 */
export function earnedMilestones(metrics: MilestoneMetrics): EarnedMilestone[] {
  return MILESTONE_CATALOG
    .filter(def => (metrics[def.metric] ?? 0) >= def.threshold)
    .map(def => ({ key: def.key, category: def.category, threshold: def.threshold }))
}
