import { Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import Flashcards from '@/pages/Flashcards'
import InterviewReport from '@/pages/InterviewReport'
import InterviewRoom from '@/pages/InterviewRoom'
import InterviewSetup from '@/pages/InterviewSetup'
import NotFound from '@/pages/NotFound'
import Profile from '@/pages/Profile'
import SpeakingCoach from '@/pages/SpeakingCoach'
import WritingCoach from '@/pages/WritingCoach'

export const routes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'interview', element: <InterviewSetup /> },
      { path: 'interview/:sessionId', element: <InterviewRoom /> },
      { path: 'interview/:sessionId/report', element: <InterviewReport /> },
      { path: 'english', element: <Navigate to="/english/writing" replace /> },
      { path: 'english/writing', element: <WritingCoach /> },
      { path: 'english/speaking', element: <SpeakingCoach /> },
      { path: 'flashcards', element: <Flashcards /> },
      { path: 'profile', element: <Profile /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
