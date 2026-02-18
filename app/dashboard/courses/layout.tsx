import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Courses',
}

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
