import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grades',
}

export default function GradesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
