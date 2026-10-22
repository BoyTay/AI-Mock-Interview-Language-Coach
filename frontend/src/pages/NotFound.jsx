import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'

export default function NotFound() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Page not found" description="The page you are looking for does not exist." />
      <Link to="/" className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
        Back to the dashboard
      </Link>
    </div>
  )
}
