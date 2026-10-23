import CompetencyRadar from '@/components/dashboard/CompetencyRadar'
import MetricCards from '@/components/dashboard/MetricCards'
import RecentSessions from '@/components/dashboard/RecentSessions'
import ScoreProgression from '@/components/dashboard/ScoreProgression'
import PageHeader from '@/components/PageHeader'
import { radar, recentSessions, weekly } from '@/mocks/dashboard'

export default function Dashboard() {
  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-6">
      <PageHeader title="Dashboard" description="Your technical interview and English progress at a glance." />
      <MetricCards />
      <section aria-label="Progress charts" className="flex flex-wrap gap-4">
        <CompetencyRadar labels={radar.labels} current={radar.current} target={radar.target} />
        <ScoreProgression tech={weekly.tech} english={weekly.english} />
      </section>
      <RecentSessions rows={recentSessions} />
    </div>
  )
}
