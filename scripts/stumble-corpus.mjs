import { stumbleSeedPages } from '../src/data/stumblePages.js'
import {
  stumbleInterests,
  stumbleInterestGroups,
  stumbleInterestSlugs,
} from '../src/data/stumbleInterests.js'
import {
  CONTENT_TYPES,
  canonicalizeUrl,
  domainOf,
  normalizeFramePolicy,
  normalizePageRecord,
} from '../netlify/functions/_lib/stumble.mjs'

const MIN_CORPUS_SIZE = 150
const DOMAIN_CAP = 4
const MIN_INTEREST_COVERAGE = 3

const byCount = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])

function bump(map, key) {
  if (!key) return
  map.set(key, (map.get(key) || 0) + 1)
}

function groupedInterests() {
  const names = new Map(stumbleInterestGroups.map((group) => [group.id, group.name]))
  const result = new Map()
  for (const interest of stumbleInterests) {
    const group = names.get(interest.group) || 'Other'
    if (!result.has(group)) result.set(group, [])
    result.get(group).push(interest.slug)
  }
  return result
}

function analyze() {
  const errors = []
  const warnings = []
  const canonicalUrls = new Map()
  const domains = new Map()
  const interests = new Map()
  const groups = new Map()
  const contentTypes = new Map()
  const framePolicies = new Map()
  const statuses = new Map()
  const interestGroups = groupedInterests()
  const groupForInterest = new Map()

  for (const [group, slugs] of interestGroups) {
    for (const slug of slugs) groupForInterest.set(slug, group)
  }

  stumbleSeedPages.forEach((seed, idx) => {
    const label = seed.title || seed.url || `seed ${idx + 1}`
    const canonicalUrl = canonicalizeUrl(seed.url)

    if (!canonicalUrl) errors.push(`${label}: invalid or unsafe URL`)
    if (!String(seed.title || '').trim()) errors.push(`${label}: missing title`)
    if (!String(seed.description || '').trim()) errors.push(`${label}: missing description`)
    if (!Array.isArray(seed.interests) || seed.interests.length === 0) {
      errors.push(`${label}: missing interests`)
    }
    if (!CONTENT_TYPES.has(seed.contentType)) {
      errors.push(`${label}: invalid contentType "${seed.contentType}"`)
    }
    if (normalizeFramePolicy(seed.framePolicy) !== seed.framePolicy) {
      errors.push(`${label}: invalid framePolicy "${seed.framePolicy}"`)
    }
    if (!Array.isArray(seed.safetyFlags)) {
      errors.push(`${label}: safetyFlags must be an array`)
    }
    if (typeof seed.qualityScore !== 'number' || seed.qualityScore < 0 || seed.qualityScore > 1) {
      errors.push(`${label}: qualityScore must be a number from 0 to 1`)
    }

    for (const slug of seed.interests || []) {
      if (!stumbleInterestSlugs.includes(slug)) errors.push(`${label}: invalid interest "${slug}"`)
    }

    if (canonicalUrl) {
      if (canonicalUrls.has(canonicalUrl)) {
        errors.push(`${label}: duplicate canonical URL with ${canonicalUrls.get(canonicalUrl)}`)
      } else {
        canonicalUrls.set(canonicalUrl, label)
      }
    }

    const normalized = normalizePageRecord(seed)
    bump(domains, normalized.domain || domainOf(seed.url))
    bump(contentTypes, normalized.contentType)
    bump(framePolicies, normalized.framePolicy)
    bump(statuses, normalized.status)

    for (const slug of normalized.interests) {
      bump(interests, slug)
      bump(groups, groupForInterest.get(slug))
    }
  })

  if (stumbleSeedPages.length < MIN_CORPUS_SIZE) {
    errors.push(`corpus has ${stumbleSeedPages.length} pages; expected at least ${MIN_CORPUS_SIZE}`)
  }

  for (const [domain, count] of domains) {
    if (count > DOMAIN_CAP) errors.push(`${domain}: ${count} pages exceeds domain cap ${DOMAIN_CAP}`)
  }

  for (const slug of stumbleInterestSlugs) {
    const count = interests.get(slug) || 0
    if (count < MIN_INTEREST_COVERAGE) {
      errors.push(`${slug}: only ${count} pages; expected at least ${MIN_INTEREST_COVERAGE}`)
    }
  }

  if (contentTypes.size < 8) warnings.push(`only ${contentTypes.size} content types represented`)
  if (domains.size < 80) warnings.push(`only ${domains.size} domains represented`)

  return {
    count: stumbleSeedPages.length,
    errors,
    warnings,
    canonicalUrls,
    domains,
    interests,
    groups,
    contentTypes,
    framePolicies,
    statuses,
  }
}

function printSection(title, map, limit = Infinity) {
  console.log(`\n${title}`)
  for (const [key, count] of [...map.entries()].sort(byCount).slice(0, limit)) {
    console.log(`  ${key}: ${count}`)
  }
}

function report() {
  const data = analyze()
  console.log(`Stumble corpus report: ${data.count} seed pages`)
  printSection('Domains', data.domains, 25)
  printSection('Interests', data.interests)
  printSection('Interest groups', data.groups)
  printSection('Content types', data.contentTypes)
  printSection('Frame policies', data.framePolicies)
  printSection('Statuses', data.statuses)

  if (data.warnings.length) {
    console.log('\nWarnings')
    for (const warning of data.warnings) console.log(`  - ${warning}`)
  }
  if (data.errors.length) {
    console.log('\nErrors')
    for (const error of data.errors) console.log(`  - ${error}`)
  }
}

function validate() {
  const data = analyze()
  if (data.warnings.length) {
    console.warn('Stumble corpus warnings:')
    for (const warning of data.warnings) console.warn(`  - ${warning}`)
  }
  if (data.errors.length) {
    console.error('Stumble corpus validation failed:')
    for (const error of data.errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  console.log(`Stumble corpus validation passed: ${data.count} pages, ${data.domains.size} domains.`)
}

const command = process.argv[2] || 'validate'

if (command === 'report') report()
else if (command === 'validate') validate()
else {
  console.error('Usage: node scripts/stumble-corpus.mjs <validate|report>')
  process.exit(1)
}
