import type { Class, Student, ChatSession, StudentContext } from "./types"

export const mockClasses: Class[] = [
  { id: "c1", name: "Class A", studentCount: 5, description: "Grade 3 - Morning Section" },
  { id: "c2", name: "Class B", studentCount: 4, description: "Grade 3 - Afternoon Section" },
  { id: "c3", name: "Class C", studentCount: 6, description: "Grade 4 - Morning Section" },
]

export const mockStudents: Student[] = [
  { id: "s1", name: "Ahmed Al-Rashid", classId: "c1", className: "Class A" },
  { id: "s2", name: "Fatima Hassan", classId: "c1", className: "Class A" },
  { id: "s3", name: "Omar Khalil", classId: "c1", className: "Class A" },
  { id: "s4", name: "Layla Ibrahim", classId: "c1", className: "Class A" },
  { id: "s5", name: "Yusuf Nasser", classId: "c1", className: "Class A" },
  { id: "s6", name: "Sara Al-Fahad", classId: "c2", className: "Class B" },
  { id: "s7", name: "Hassan Mahmoud", classId: "c2", className: "Class B" },
  { id: "s8", name: "Noor Al-Din", classId: "c2", className: "Class B" },
  { id: "s9", name: "Rania Yousef", classId: "c2", className: "Class B" },
  { id: "s10", name: "Ali Kareem", classId: "c3", className: "Class C" },
  { id: "s11", name: "Maryam Saleh", classId: "c3", className: "Class C" },
  { id: "s12", name: "Tariq Zayed", classId: "c3", className: "Class C" },
  { id: "s13", name: "Huda Abbas", classId: "c3", className: "Class C" },
  { id: "s14", name: "Khaled Omran", classId: "c3", className: "Class C" },
  { id: "s15", name: "Dina Faris", classId: "c3", className: "Class C" },
]

export const mockRecentChats: ChatSession[] = [
  {
    id: "chat1",
    title: "Ahmed's reading progress",
    studentId: "s1",
    studentName: "Ahmed Al-Rashid",
    classId: "c1",
    className: "Class A",
    messages: [
      {
        id: "m1",
        role: "assistant",
        content: "Hello! How can I help you with Ahmed's learning today?",
        timestamp: new Date("2026-03-02T10:00:00"),
      },
      {
        id: "m2",
        role: "teacher",
        content: "I noticed Ahmed is struggling with reading comprehension. Can you suggest a plan?",
        timestamp: new Date("2026-03-02T10:01:00"),
      },
      {
        id: "m3",
        role: "assistant",
        content: "Based on Ahmed's profile, I recommend focusing on guided reading sessions with vocabulary building. Here's a structured approach:\n\n1. Start with 15-minute daily reading sessions\n2. Use context clues exercises\n3. Implement a reading journal for reflection\n\nWould you like me to generate a detailed plan?",
        timestamp: new Date("2026-03-02T10:02:00"),
      },
    ],
    createdAt: new Date("2026-03-02T10:00:00"),
  },
  {
    id: "chat2",
    title: "General classroom tips",
    messages: [
      {
        id: "m4",
        role: "assistant",
        content: "Welcome! I'm here to assist you. Ask me anything about teaching strategies or student management.",
        timestamp: new Date("2026-03-01T14:00:00"),
      },
    ],
    createdAt: new Date("2026-03-01T14:00:00"),
  },
  {
    id: "chat3",
    title: "Fatima's math assessment",
    studentId: "s2",
    studentName: "Fatima Hassan",
    classId: "c1",
    className: "Class A",
    messages: [],
    createdAt: new Date("2026-02-28T09:00:00"),
  },
]

export const mockStudentContexts: Record<string, StudentContext> = {
  s1: {
    studentId: "s1",
    studentName: "Ahmed Al-Rashid",
    classId: "c1",
    className: "Class A",
    summary:
      "Ahmed is a Grade 3 student showing strong potential in mathematics but struggling with reading comprehension. He is an active participant in class discussions and works well in group settings. Recent assessments indicate improvement in vocabulary but continued difficulty with inference-based questions.",
    plan: "## Reading Improvement Plan\n\n**Duration:** 6 weeks\n\n### Week 1-2: Foundation\n- Daily 15-min guided reading sessions\n- Vocabulary journal with 5 new words/day\n- Context clues worksheets\n\n### Week 3-4: Building Skills\n- Paired reading with stronger reader\n- Comprehension question practice\n- Story mapping exercises\n\n### Week 5-6: Assessment & Adjustment\n- Mid-plan assessment\n- Adjust based on progress\n- Parent feedback session",
  },
  s2: {
    studentId: "s2",
    studentName: "Fatima Hassan",
    classId: "c1",
    className: "Class A",
    summary:
      "Fatima excels in language arts and creative writing. She shows natural leadership skills and often helps peers. Her math performance has been declining in recent weeks, particularly in multiplication and division concepts.",
    plan: "## Math Support Plan\n\n**Duration:** 4 weeks\n\n### Focus Areas\n- Multiplication tables practice\n- Division concept reinforcement\n- Word problems involving both operations\n\n### Daily Activities\n- 10-min math drills\n- Visual learning aids\n- Peer tutoring sessions",
  },
}
