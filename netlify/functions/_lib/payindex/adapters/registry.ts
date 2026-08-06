// The full adapter registry, in priority order per methodology: Tier A
// (Adzuna, the backbone) first, Tier B (the four ATS platforms) second,
// Tier C (role-specific authoritative sources) third. This is the single
// list the ingest CLI iterates — adding a new adapter means adding it here,
// nowhere else.

import type { SourceAdapter } from './index.ts'
import { adzunaAdapter } from './adzuna.ts'
import { greenhouseAdapter } from './ats/greenhouse.ts'
import { leverAdapter } from './ats/lever.ts'
import { ashbyAdapter } from './ats/ashby.ts'
import { workdayAdapter } from './ats/workday.ts'
import { unionScaleAdapter } from './roles/unionScale.ts'
import { districtScheduleAdapter } from './roles/districtSchedule.ts'
import { vivianAdapter } from './roles/vivian.ts'
import { carrierPayAdapter } from './roles/carrierPay.ts'
import { levelsFyiAdapter } from './roles/levelsfyi.ts'

export const allAdapters: readonly SourceAdapter[] = [
  adzunaAdapter,
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  unionScaleAdapter,
  districtScheduleAdapter,
  vivianAdapter,
  carrierPayAdapter,
  levelsFyiAdapter,
]
