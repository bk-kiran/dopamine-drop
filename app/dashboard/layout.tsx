import { Toaster } from "@/components/ui/toaster"
import { ConvexClientProvider } from "@/providers/convex-client-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 dark:bg-purple-500/20 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/8 dark:bg-violet-600/15 blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          {children}
        </div>
      </div>
      <Toaster />
    </ConvexClientProvider>
  )
}
