import MetricCards from '@/components/dashboard/MetricCards'
import RecentSessions from '@/components/dashboard/RecentSessions'
import PageHeader from '@/components/PageHeader'
import { recentSessions } from '@/mocks/dashboard'

export default function Dashboard() {
  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-6">
      <PageHeader title="Dashboard" description="Your technical interview and English progress at a glance." />
      <MetricCards />
      <RecentSessions rows={recentSessions} />
    </div>
  )
}
