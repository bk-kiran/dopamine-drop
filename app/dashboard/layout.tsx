'use client'

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  GraduationCap,
  Trophy,
  User,
  LogOut,
  BarChart2,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter, usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { ConvexClientProvider } from "@/providers/convex-client-provider"
import { AchievementToast } from "@/components/achievement-toast"

// Custom sidebar link that supports an unreviewed count badge
function InsightsSidebarLink({ unreviewedCount }: { unreviewedCount: number }) {
  const { open, animate } = useSidebar()
  const pathname = usePathname()
  const isActive = pathname === '/dashboard/insights'
  return (
    <Link
      href="/dashboard/insights"
      className={[
        'relative flex items-center gap-3 py-3 px-2 rounded-lg transition-all duration-200',
        open ? 'justify-start' : 'justify-center',
        'hover:bg-purple-50 dark:hover:bg-purple-500/10',
      ].join(' ')}
    >
      <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
        <BarChart2 className={`w-5 h-5 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-neutral-200'}`} />
        {unreviewedCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 text-[8px] font-black text-white flex items-center justify-center leading-none">
            {unreviewedCount > 9 ? '9+' : unreviewedCount}
          </span>
        )}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-flex' : 'none') : 'inline-flex',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm font-medium whitespace-nowrap text-gray-700 dark:text-neutral-200 items-center gap-2 p-0! m-0!"
      >
        Insights
        {unreviewedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-black leading-none">
            {unreviewedCount}
          </span>
        )}
      </motion.span>
    </Link>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user: clerkUser } = useUser()
  const { signOut } = useClerk()
  const supabaseUserId = clerkUser?.id ?? null
  const router = useRouter();
  const pathname = usePathname();

  // Get user data from Convex
  const dashboardData = useQuery(
    api.users.getDashboardData,
    supabaseUserId ? { clerkId: supabaseUserId } : 'skip'
  )

  const userData = dashboardData?.user

  // Get avatar URL
  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    supabaseUserId ? { clerkId: supabaseUserId } : 'skip'
  )

  // Get user initials
  const getInitials = () => {
    if (!userData?.displayName) return '?'
    const names = userData.displayName.split(' ')
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase()
    }
    return names[0][0].toUpperCase()
  }

  const activeIconClass = (href: string) =>
    `w-5 h-5 ${pathname === href ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-neutral-200'}`

  const unreviewedCount = useQuery(
    api.customTasks.getUnreviewedInsightsCount,
    supabaseUserId ? { clerkId: supabaseUserId } : 'skip'
  ) ?? 0

  const links = [
    { label: "Dashboard",   href: "/dashboard",            icon: <LayoutDashboard className={activeIconClass('/dashboard')} /> },
    { label: "Courses",     href: "/dashboard/courses",    icon: <BookOpen className={activeIconClass('/dashboard/courses')} /> },
    { label: "Schedule",    href: "/dashboard/schedule",   icon: <Calendar className={activeIconClass('/dashboard/schedule')} /> },
    { label: "Grades",      href: "/dashboard/grades",     icon: <GraduationCap className={activeIconClass('/dashboard/grades')} /> },
    { label: "Leaderboard", href: "/dashboard/leaderboard",icon: <Trophy className={activeIconClass('/dashboard/leaderboard')} /> },
    { label: "Profile",     href: "/dashboard/profile",    icon: <User className={activeIconClass('/dashboard/profile')} /> },
  ];

  const handleLogout = async () => {
    await signOut({ redirectUrl: '/login' })
  };

  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/10 dark:bg-purple-500/20 blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/8 dark:bg-violet-600/15 blur-[100px] pointer-events-none" />

        {/* Main Layout */}
        <div className="relative z-10 flex flex-col md:flex-row w-full h-screen overflow-hidden">
          <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between">
              {/* Top: Logo + Nav */}
              <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <div className="mb-6">
                  {open ? <Logo /> : <LogoIcon />}
                </div>
                <div className="flex flex-col gap-1">
                  {links.slice(0, 5).map((link, idx) => (
                    <SidebarLink key={idx} link={link} />
                  ))}
                  <InsightsSidebarLink unreviewedCount={unreviewedCount} />
                  {links.slice(5).map((link, idx) => (
                    <SidebarLink key={idx + 5} link={link} />
                  ))}
                </div>
              </div>

              {/* Bottom: Theme + Profile + Logout */}
              <div className="flex flex-col gap-1 border-t border-gray-200 dark:border-white/10 pt-4">
                {/* Theme Toggle */}
                <div className={`flex items-center py-3 px-2 rounded-lg ${open ? 'justify-start' : 'justify-center'}`}>
                  <ThemeToggle />
                </div>

                {/* Profile */}
                <SidebarLink
                  link={{
                    label: userData?.displayName || "Student",
                    href: "/dashboard/profile",
                    icon: (
                      <div className="w-5 h-5 shrink-0 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-[9px] font-bold text-purple-400">{getInitials()}</span>
                        )}
                      </div>
                    ),
                  }}
                />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-3 py-3 px-2 w-full rounded-lg transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 ${open ? 'justify-start' : 'justify-center'}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <LogOut className="w-5 h-5 text-gray-700 dark:text-neutral-200" />
                  </div>
                  <motion.span
                    animate={{
                      display: open ? "inline-block" : "none",
                      opacity: open ? 1 : 0,
                    }}
                    className="text-sm font-medium text-gray-700 dark:text-neutral-200 p-0! m-0!"
                  >
                    Logout
                  </motion.span>
                </button>
              </div>
            </SidebarBody>
          </Sidebar>

          {/* Main Dashboard Content */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>

        <AchievementToast />
        <Toaster />
      </div>
    </ConvexClientProvider>
  );
}

// dopamine drop Logo (expanded)
export const Logo = () => {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 py-2 px-1">
      <div className="h-10 w-10 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg shrink-0 flex items-center justify-center">
        <span className="text-white font-bold text-base">DD</span>
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-black text-lg text-gray-900 dark:text-white whitespace-nowrap lowercase"
      >
        dopamine drop
      </motion.span>
    </Link>
  );
};

// dopamine drop Logo Icon (collapsed)
export const LogoIcon = () => {
  return (
    <Link href="/dashboard" className="flex items-center justify-center py-2">
      <div className="h-10 w-10 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg shrink-0 flex items-center justify-center">
        <span className="text-white font-bold text-base">DD</span>
      </div>
    </Link>
  );
};
