import { AREA_LABEL, type Area } from '@/data/types'

/** The tender's audit areas, in the order they are shown. */
export const AREA_ORDER: Area[] = ['procurement', 'scrap', 'receivables', 'cash_bank', 'fixed_assets', 'establishment', 'compliance', 'internal_controls', 'cag']

export const areaName = (a: Area): string => (a === 'compliance' ? 'Statutory Compliance' : AREA_LABEL[a])
