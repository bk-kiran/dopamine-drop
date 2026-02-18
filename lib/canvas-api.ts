export interface CanvasUser {
  id: number
  name: string
  primary_email: string
}

export interface CanvasCourse {
  id: number
  name: string
  course_code: string
  enrollment_term_id: number
  workflow_state: string
  enrollments?: {
    type: string
    computed_current_score: number | null
    computed_final_score: number | null
    computed_current_grade: string | null
  }[]
}

export interface CanvasAssignment {
  id: number
  name: string
  description: string
  due_at: string | null
  points_possible: number
  course_id: number
  submission?: CanvasSubmission | null
  assignment_group?: { id: number; name: string; group_weight: number }
}

export interface CanvasSubmission {
  id: number
  user_id: number
  assignment_id: number
  submitted_at: string | null
  workflow_state: string
  late: boolean
  score: number | null
}

export class CanvasClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  /**
   * Makes an authenticated GET request to the Canvas API
   */
  private async get<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    console.log('[Canvas API] Request URL:', url)
    console.log('[Canvas API] Token length:', this.token.length)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Canvas API] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url,
      })
      throw new Error(
        `Canvas API error: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    return response.json()
  }

  /**
   * Gets the current user's Canvas profile
   * @returns The user's Canvas profile (id, name, primary_email)
   */
  async getMe(): Promise<CanvasUser> {
    return this.get<CanvasUser>('/api/v1/users/self')
  }

  /**
   * Gets the user's active courses
   * @returns List of active courses
   */
  async getCourses(): Promise<CanvasCourse[]> {
    return this.get<CanvasCourse[]>(
      '/api/v1/courses?enrollment_state=active&per_page=50&include[]=total_scores'
    )
  }

  /**
   * Gets assignments for a specific course with embedded submission data
   * @param courseId - The Canvas course ID
   * @returns List of assignments ordered by due date, each with embedded submission data
   */
  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    return this.get<CanvasAssignment[]>(
      `/api/v1/courses/${courseId}/assignments?per_page=50&order_by=due_at&include[]=submission&include[]=assignment_group`
    )
  }
}
