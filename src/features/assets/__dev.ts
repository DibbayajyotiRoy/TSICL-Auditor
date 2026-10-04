import { useAudit } from '@/data/store'
import type { Asset } from '@/data/types'
const locs = ['Agartala HO', 'Dharmanagar', 'Udaipur', 'Belonia', 'Kailashahar']
const cats: Asset['category'][] = ['IT', 'Furniture', 'Vehicle', 'Machinery', 'Building', 'Other']
const names = ['Dell Latitude Laptop', 'Steel Almirah', 'Bolero Jeep', 'Power Loom', 'Godown Shed', 'Water Purifier']
const assets: Asset[] = Array.from({ length: 64 }, (_, i) => ({
  id: `A${i}`, tag: i === 5 ? 'TSICL-000007' : i === 6 ? 'TSICL-000007' : i === 0 ? 'TSICL-000193' : `TSICL-${String(1000 + i * 7).padStart(6, '0')}`,
  name: i === 0 ? 'Laptop' : names[i % 6], category: i === 0 ? 'IT' : cats[i % 6], cost: i === 0 ? 82000 : 15000 + ((i * 37919) % 900000),
  purchaseDate: '2022-04-01', location: i === 0 ? 'Agartala HO' : locs[i % 5], assignedTo: i % 3 ? 'S. Debbarma' : undefined,
  lastVerified: i % 3 === 1 ? '2026-06-12' : i % 7 === 0 && i > 0 ? '2024-02-01' : undefined,
  verification: i % 3 === 1 ? (i % 11 === 0 ? 'damaged' : 'found') : i % 13 === 0 ? 'missing' : undefined,
}))
useAudit.setState({ assets })
