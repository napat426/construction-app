import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <ReadOnlyBanner />
      <div className="flex-1 flex flex-col w-full">
        {children}
      </div>
    </div>
  )
}
