import type { ToolExecutor } from "./types.js";

export class ToolExecutorRegistry {
  private readonly executors = new Map<string, ToolExecutor>();

  register(executor: ToolExecutor): void {
    this.executors.set(executor.type, executor);
  }

  get(type: string): ToolExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`Tidak ada executor untuk tipe tool: ${type}`);
    }
    return executor;
  }
}
