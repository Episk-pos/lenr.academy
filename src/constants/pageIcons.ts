import {
  Home,
  FlaskConical,
  GitMerge,
  Scissors,
  ArrowLeftRight,
  Workflow,
  RefreshCw,
  TableProperties,
  Database,
  Waves,
  Beaker,
  HelpCircle,
  Shield,
  Bug,
  type LucideIcon,
} from 'lucide-react'

/**
 * Single source of truth for page icons. The sidebar navigation (Layout.tsx)
 * and each page's <PageHeader> both read from here so they can never drift.
 */
export const PAGE_ICONS = {
  home: Home,
  elementData: FlaskConical,
  fusion: GitMerge,
  fission: Scissors,
  twoToTwo: ArrowLeftRight,
  cascades: Workflow,
  cycles: RefreshCw,
  tablesInDetail: TableProperties,
  allTables: Database,
  mullerResonance: Waves,
  transmutations: Beaker,
  help: HelpCircle,
  privacy: Shield,
  sentryTest: Bug,
} as const satisfies Record<string, LucideIcon>
