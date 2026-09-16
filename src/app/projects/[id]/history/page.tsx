import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface HistoryPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectHistoryPage({ params }: HistoryPageProps) {
  const { id } = await params
  redirect(`/activities?projectId=${id}`)
}
