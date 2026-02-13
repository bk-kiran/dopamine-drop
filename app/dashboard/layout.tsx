import { Toaster } from "@/components/ui/toaster"
import { ConvexClientProvider } from "@/providers/convex-client-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexClientProvider>
      {children}
      <Toaster />
    </ConvexClientProvider>
  )
}
