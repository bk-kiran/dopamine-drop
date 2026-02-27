/**
 * Parse and clean up Canvas course names
 * Input: "Artificial Intelligence COMPSCI 383 (168646) SP26"
 * Output: { name: "Artificial Intelligence", code: "CS383" }
 */
export function parseCourseName(rawName: string): { name: string; code: string } {
  // Remove Canvas ID in parentheses: (168646)
  let cleaned = rawName.replace(/\(\d+\)/g, '').trim()

  // Remove semester codes: SP26, FA25, etc.
  cleaned = cleaned.replace(/\s+(SP|FA|SU|WI)\d{2}\s*$/i, '').trim()

  // Extract course code (e.g., COMPSCI 383, CS 345, MATH 101)
  const codeMatch = cleaned.match(/([A-Z]+)\s*(\d{3,4})/i)
  let courseCode = ''
  let courseName = cleaned

  if (codeMatch) {
    const dept = codeMatch[1]
    const number = codeMatch[2]

    // Abbreviate common department names
    const deptAbbreviations: Record<string, string> = {
      COMPSCI: 'CS',
      'COMPUTER SCIENCE': 'CS',
      MATHEMATICS: 'MATH',
      CHEMISTRY: 'CHEM',
      BIOLOGY: 'BIO',
      PHYSICS: 'PHYS',
      PSYCHOLOGY: 'PSYCH',
      'POLITICAL SCIENCE': 'POLSCI',
      ECONOMICS: 'ECON',
      ENGINEERING: 'ENGR',
      HISTORY: 'HIST',
      ENGLISH: 'ENG',
      PHILOSOPHY: 'PHIL',
      SOCIOLOGY: 'SOC',
      ANTHROPOLOGY: 'ANTH',
      STATISTICS: 'STAT',
      // Add more as needed
    }

    const abbrev = deptAbbreviations[dept.toUpperCase()] || dept
    courseCode = `${abbrev}${number}`

    // Remove the code from the course name
    courseName = cleaned
      .replace(codeMatch[0], '')
      .replace(/\s+—\s+/g, ' ')
      .replace(/\s+-\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // If course name is empty or just the code repeated, use code as name
  if (!courseName || courseName === courseCode) {
    courseName = courseCode
    courseCode = ''
  }

  return {
    name: courseName,
    code: courseCode,
  }
}

/**
 * Format for display: "Name — CODE" or just "Name" if no code
 */
export function formatCourseName(rawName: string): string {
  const { name, code } = parseCourseName(rawName)
  return code ? `${name} — ${code}` : name
}

/**
 * Get just the abbreviated course code
 */
export function getCourseCode(rawName: string): string {
  const { code } = parseCourseName(rawName)
  return code
}
