import { FileUser, Layers, LayoutDashboard, PenLine, SquareTerminal } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/interview', label: 'Tech Mock Interview', icon: SquareTerminal },
  { to: '/english', label: 'English Writing & Speaking', icon: PenLine },
  { to: '/flashcards', label: 'Mistake Flashcards', icon: Layers },
  { to: '/profile', label: 'CV & JD Profile', icon: FileUser },
]
