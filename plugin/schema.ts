import { z } from "zod"

export const todoSchema = z.strictObject({
  content: z.string().trim().min(1).max(2000),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
})
export type Todo = z.infer<typeof todoSchema>
export const todosSchema = z.array(todoSchema).max(100).refine(
  (todos) => todos.filter((todo) => todo.status === "in_progress").length <= 1,
  "At most one todo can be in_progress",
)

export const inputSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("status") }),
  z.strictObject({ action: z.literal("models") }),
  z.strictObject({ action: z.literal("todos"), todos: todosSchema.optional() }),
  z.strictObject({
    action: z.literal("transcripts"), scope: z.enum(["current", "project"]).default("current"),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  z.strictObject({
    action: z.literal("loop"), operation: z.enum(["schedule", "list", "stop"]),
    prompt: z.string().trim().min(1).max(8000).optional(),
    every: z.string().max(20).optional(), after: z.string().max(20).optional(),
    maxRuns: z.number().int().min(1).max(10).default(3),
  }),
])
export type Input = z.infer<typeof inputSchema>

export const renderTodos = (todos: Todo[]) => todos.map((t, i) =>
  `${i + 1}. ${{ pending: "[ ]", in_progress: "[~]", completed: "[x]", cancelled: "[-]" }[t.status]} ${t.content}`,
).join("\n")
