import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { CanvasClient } from '@/lib/canvas-api'
import { decryptToken } from '@/lib/encryption'
import { getConvexClient, getConvexUserId } from '@/lib/convex-client'
import { api } from '@/convex/_generated/api'
import { logInternalError, logSecurityEvent } from '@/lib/logger'

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      logSecurityEvent('unauthorized', { route: '/api/canvas/sync-grades' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const convex = getConvexClient()
    const userData = await convex.query(api.users.getUser, { authUserId: userId })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userData.hasOptedInToGrades) {
      return NextResponse.json({ error: 'Grades sync not enabled' }, { status: 403 })
    }

    if (!userData.canvasTokenEncrypted || !userData.canvasTokenIv) {
      return NextResponse.json({ error: 'Canvas not connected' }, { status: 400 })
    }

    const canvasBaseUrl = process.env.NEXT_PUBLIC_CANVAS_BASE_URL
    if (!canvasBaseUrl) {
      return NextResponse.json({ error: 'Canvas configuration missing' }, { status: 500 })
    }

    const canvasToken = decryptToken(userData.canvasTokenEncrypted, userData.canvasTokenIv)
    const canvasClient = new CanvasClient(canvasBaseUrl, canvasToken)
    const convexUserId = await getConvexUserId(userId)

    // Fetch courses with grade data
    let courses
    try {
      courses = await canvasClient.getCourses()
    } catch (err) {
      logInternalError('sync-grades getCourses', err, { userId })
      return NextResponse.json({ error: 'Failed to fetch grades from Canvas' }, { status: 502 })
    }

    let synced = 0

    for (const course of courses) {
      const studentEnrollment = course.enrollments?.find((e) => e.type === 'student')
      const currentGrade = studentEnrollment?.computed_current_score ?? undefined
      const finalGrade = studentEnrollment?.computed_final_score ?? undefined

      if (currentGrade === undefined && finalGrade === undefined) continue

      await convex.mutation(api.courses.upsertCourse, {
        userId: convexUserId,
        canvasCourseId: course.id.toString(),
        name: course.name,
        courseCode: course.course_code,
        currentGrade,
        finalGrade,
      })

      synced++
    }

    return NextResponse.json({ success: true, synced })
  } catch (err) {
    logInternalError('sync-grades', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
