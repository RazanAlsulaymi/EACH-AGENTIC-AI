// lib/thread.ts
export function getThreadId(studentId: string) {
  const key = `each_thread_${studentId}`
  let v = localStorage.getItem(key)
  if (!v) {
    v = `student_${studentId}_${crypto.randomUUID()}`
    localStorage.setItem(key, v)
  }
  return v
}