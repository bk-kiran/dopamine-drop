import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SyncButton } from './sync-button'
import { DashboardClient } from './dashboard-client'
import { AutoSync } from './auto-sync'
import { Card, CardContent } from '@/components/ui/card'

interface Assignment {
  id: string
  canvas_assignment_id: string
  canvas_course_id: string
  title: string
  description: string | null
  due_at: string | null
  points_possible: number
  status?: 'pending' | 'submitted' | 'missing'
  submitted_at?: string | null
  course_name: string
  course_code: string
}

interface Course {
  id: string
  name: string
  course_code: string
  canvas_course_id: string
  assignments: Assignment[]
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user data including Canvas token, hidden courses, and stats
  const { data: userData } = await supabase
    .from('users')
    .select('canvas_token_encrypted, hidden_courses, total_points, streak_count')
    .eq('id', user.id)
    .single()

  if (!userData?.canvas_token_encrypted) {
    redirect('/dashboard/setup')
  }

  const hiddenCourses = userData.hidden_courses || []
  const userStats = {
    total_points: userData.total_points || 0,
    streak_count: userData.streak_count || 0,
  }

  // Fetch ALL courses for the user
  const { data: allCourses } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  // Fetch assignments with course information
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      *,
      courses!inner (
        id,
        name,
        course_code,
        canvas_course_id
      )
    `)
    .eq('user_id', user.id)
    .or(`due_at.gte.${new Date().toISOString()},submitted_at.gte.${sevenDaysAgo.toISOString()}`)
    .order('due_at', { ascending: true })

  // Create a map of courses with their assignments
  const courseMap = new Map<string, Course>()

  // First, add ALL courses to the map (even those with no assignments)
  if (allCourses) {
    allCourses.forEach((course: any) => {
      courseMap.set(course.canvas_course_id, {
        id: course.id,
        name: course.name,
        course_code: course.course_code,
        canvas_course_id: course.canvas_course_id,
        assignments: [],
      })
    })
  }

  // Then, add assignments to their respective courses
  if (assignments) {
    assignments.forEach((assignment: any) => {
      const canvasCourseId = assignment.courses.canvas_course_id
      const course = courseMap.get(canvasCourseId)

      if (course) {
        course.assignments.push({
          id: assignment.id,
          canvas_assignment_id: assignment.canvas_assignment_id,
          canvas_course_id: assignment.canvas_course_id,
          title: assignment.title,
          description: assignment.description,
          due_at: assignment.due_at,
          points_possible: assignment.points_possible,
          status: assignment.status,
          submitted_at: assignment.submitted_at,
          course_name: assignment.courses.name,
          course_code: assignment.courses.course_code,
        })
      }
    })
  }

  const courses = Array.from(courseMap.values())

  return (
    <div className="container max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Your Canvas assignments and progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats chips */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-semibold text-orange-900">
              {userStats.streak_count} day streak
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
            <span className="text-lg">⚡</span>
            <span className="text-sm font-semibold text-purple-900">
              {userStats.total_points} pts
            </span>
          </div>
          <SyncButton />
        </div>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground mb-4">
              No assignments found. Click &quot;Sync Canvas&quot; to fetch your latest assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DashboardClient courses={courses} hiddenCourses={hiddenCourses} />
      )}

      <AutoSync />
    </div>
  )
}
