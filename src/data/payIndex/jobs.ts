// The Pay Index fixed job basket — 60 titles spanning real occupations.
//
// This list changes ONLY via a dated basket_changelog entry (changelog.ts)
// plus a bump to BASKET_VERSION (basket.ts). Editing a row here without both
// of those breaks tests/payindex/fingerprint.test.ts by design — see the
// header comment in basket.ts.
//
// canonicalKeywords are used verbatim to search every source tier. A gap
// stays a gap: nothing here is ever swapped for a "similar" title at query
// time.

import type { Job } from './types'
import { BASKET_VERSION, BASKET_EFFECTIVE_DATE } from './basket'

function job(
  id: string,
  title: string,
  category: string,
  canonicalKeywords: string[],
  negativeKeywords: string[] = [],
): Job {
  return {
    id,
    title,
    category,
    canonicalKeywords,
    negativeKeywords,
    addedAt: BASKET_EFFECTIVE_DATE,
    active: true,
    basketVersion: BASKET_VERSION,
  }
}

export const jobs: Job[] = [
  // ---- Retail & customer service ----
  job('retail-cashier', 'Retail Cashier', 'Retail', ['cashier', 'retail cashier']),
  job('retail-sales-associate', 'Retail Sales Associate', 'Retail', ['retail sales associate', 'sales associate']),
  job('retail-store-manager', 'Retail Store Manager', 'Retail', ['retail store manager', 'store manager']),
  job('customer-service-rep', 'Customer Service Representative', 'Retail', ['customer service representative']),
  job('call-center-rep', 'Call Center Representative', 'Retail', ['call center representative', 'call center agent']),

  // ---- Food service ----
  job('line-cook', 'Line Cook', 'Food Service', ['line cook']),
  job('restaurant-server', 'Restaurant Server', 'Food Service', ['restaurant server', 'waiter', 'waitress']),
  job('fast-food-crew', 'Fast Food Crew Member', 'Food Service', ['fast food crew member', 'fast food worker']),
  job('barista', 'Barista', 'Food Service', ['barista']),
  job('restaurant-shift-manager', 'Restaurant Shift Manager', 'Food Service', ['restaurant shift manager', 'assistant restaurant manager']),

  // ---- Healthcare ----
  job('registered-nurse', 'Registered Nurse', 'Healthcare', ['registered nurse', 'rn'], ['nurse practitioner', 'np-c', 'travel nurse']),
  job('licensed-practical-nurse', 'Licensed Practical Nurse', 'Healthcare', ['licensed practical nurse', 'lpn']),
  job('certified-nursing-assistant', 'Certified Nursing Assistant', 'Healthcare', ['certified nursing assistant', 'cna']),
  job('dental-hygienist', 'Dental Hygienist', 'Healthcare', ['dental hygienist']),
  job('medical-assistant', 'Medical Assistant', 'Healthcare', ['medical assistant']),
  job('pharmacy-technician', 'Pharmacy Technician', 'Healthcare', ['pharmacy technician']),
  job('physical-therapist', 'Physical Therapist', 'Healthcare', ['physical therapist']),
  job('radiologic-technologist', 'Radiologic Technologist', 'Healthcare', ['radiologic technologist', 'x-ray technologist']),

  // ---- Trades ----
  job('journeyman-electrician', 'Journeyman Electrician', 'Trades', ['journeyman electrician', 'electrician'], ['apprentice', 'electrical engineer', 'trainee']),
  job('apprentice-electrician', 'Apprentice Electrician', 'Trades', ['apprentice electrician']),
  job('plumber', 'Plumber', 'Trades', ['plumber']),
  job('hvac-technician', 'HVAC Technician', 'Trades', ['hvac technician', 'hvac tech']),
  job('carpenter', 'Carpenter', 'Trades', ['carpenter']),
  job('welder', 'Welder', 'Trades', ['welder']),
  job('heavy-equipment-operator', 'Heavy Equipment Operator', 'Trades', ['heavy equipment operator']),
  job('construction-laborer', 'Construction Laborer', 'Trades', ['construction laborer']),

  // ---- Transportation & logistics ----
  job('heavy-truck-driver', 'Heavy Truck Driver (CDL Class A)', 'Transportation', ['heavy truck driver', 'cdl class a driver', 'otr truck driver']),
  job('delivery-driver', 'Delivery Driver', 'Transportation', ['delivery driver']),
  job('warehouse-associate', 'Warehouse Associate', 'Transportation', ['warehouse associate']),
  job('forklift-operator', 'Forklift Operator', 'Transportation', ['forklift operator']),
  job('bus-driver', 'Bus Driver', 'Transportation', ['bus driver']),

  // ---- Education ----
  job('elementary-school-teacher', 'Elementary School Teacher', 'Education', ['elementary school teacher', 'elementary teacher']),
  job('secondary-school-teacher', 'Secondary School Teacher', 'Education', ['secondary school teacher', 'high school teacher']),
  job('special-education-teacher', 'Special Education Teacher', 'Education', ['special education teacher']),
  job('teachers-aide', "Teacher's Aide", 'Education', ["teacher's aide", 'teaching assistant']),

  // ---- Office, admin & professional ----
  job('accountant', 'Accountant', 'Office & Professional', ['accountant']),
  job('bookkeeper', 'Bookkeeper', 'Office & Professional', ['bookkeeper']),
  job('administrative-assistant', 'Administrative Assistant', 'Office & Professional', ['administrative assistant']),
  job('executive-assistant', 'Executive Assistant', 'Office & Professional', ['executive assistant']),
  job('hr-generalist', 'Human Resources Generalist', 'Office & Professional', ['human resources generalist', 'hr generalist']),
  job('paralegal', 'Paralegal', 'Office & Professional', ['paralegal']),
  job('office-manager', 'Office Manager', 'Office & Professional', ['office manager']),
  job('data-entry-clerk', 'Data Entry Clerk', 'Office & Professional', ['data entry clerk']),

  // ---- Tech ----
  job('software-developer', 'Software Developer', 'Tech', ['software developer', 'software engineer'], ['senior', 'staff', 'principal', 'engineering manager', 'intern']),
  job('it-support-specialist', 'IT Support Specialist', 'Tech', ['it support specialist', 'help desk technician']),
  job('systems-administrator', 'Systems Administrator', 'Tech', ['systems administrator', 'sysadmin']),
  job('qa-engineer', 'QA Engineer', 'Tech', ['qa engineer', 'quality assurance engineer']),
  job('data-analyst', 'Data Analyst', 'Tech', ['data analyst']),
  job('network-engineer', 'Network Engineer', 'Tech', ['network engineer']),

  // ---- Manufacturing & warehouse ----
  job('assembly-line-worker', 'Assembly Line Worker', 'Manufacturing', ['assembly line worker', 'assembler']),
  job('machine-operator', 'Machine Operator', 'Manufacturing', ['machine operator']),
  job('quality-control-inspector', 'Quality Control Inspector', 'Manufacturing', ['quality control inspector']),
  job('production-supervisor', 'Production Supervisor', 'Manufacturing', ['production supervisor']),

  // ---- Personal care & services ----
  job('hair-stylist', 'Hair Stylist', 'Personal Care', ['hair stylist', 'hairdresser']),
  job('massage-therapist', 'Massage Therapist', 'Personal Care', ['massage therapist']),
  job('childcare-worker', 'Childcare Worker', 'Personal Care', ['childcare worker', 'daycare worker']),
  job('home-health-aide', 'Home Health Aide', 'Personal Care', ['home health aide']),

  // ---- Hospitality & security ----
  job('hotel-front-desk-agent', 'Hotel Front Desk Agent', 'Hospitality', ['hotel front desk agent']),
  job('housekeeper-hospitality', 'Housekeeper (Hospitality)', 'Hospitality', ['hotel housekeeper', 'housekeeping room attendant']),
  job('security-guard', 'Security Guard', 'Hospitality', ['security guard']),
]
