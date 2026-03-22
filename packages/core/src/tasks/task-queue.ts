import type { Agent, Task, TaskStatus, TaskUpdate } from "../types/index.js";
import { generateId } from "../utils.js";

// ─── Task Queue ───────────────────────────────────────────────────────────────

export class TaskQueue {
  private tasks = new Map<string, Task>();

  create(input: Omit<Task, "id" | "status" | "createdAt" | "updatedAt">): Task {
    const task: Task = {
      ...input,
      id: generateId("task"),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);

    return task;
  }

  update(id: string, update: TaskUpdate): Task {
    const task = this.get(id);
    const updated: Task = { ...task, ...update, updatedAt: new Date() };

    this.tasks.set(id, updated);

    return updated;
  }

  get(id: string): Task {
    const task = this.tasks.get(id);

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    return task;
  }

  getAll(): Task[] {
    return Array.from(this.tasks.values());
  }

  getByStatus(status: TaskStatus): Task[] {
    return this.getAll().filter((t) => t.status === status);
  }

  /** Returns tasks whose dependencies are all completed */
  getReady(): Task[] {
    const done = new Set(this.getByStatus("done").map((t) => t.id));

    return this.getByStatus("pending").filter((task) => {
      if (!task.dependsOn?.length) return true;
      return task.dependsOn.every((dep) => done.has(dep));
    });
  }

  clear(): void {
    this.tasks.clear();
  }
}

// ─── Task Router ──────────────────────────────────────────────────────────────

export class TaskRouter {
  constructor(private agents: Agent[]) {}

  /** Find the best agent for a task based on skills */
  route(task: Task): Agent | null {
    const capable = this.agents.filter((a) => a.canHandle(task) && a.status === "idle");
    if (!capable.length) return null;

    if (task.requiredSkill) {
      const withSkill = capable.filter((a) =>
        a.config.skills?.some((s) => s.name === task.requiredSkill),
      );
      if (withSkill.length) return withSkill[0] ?? null;
    }

    return capable[0] ?? null;
  }

  addAgent(agent: Agent): void {
    this.agents.push(agent);
  }

  removeAgent(id: string): void {
    this.agents = this.agents.filter((a) => a.id !== id);
  }
}
