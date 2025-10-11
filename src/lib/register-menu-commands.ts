import { AppContext } from "@/app-context"
import { registerLoginCommand } from "@/lib/commands/login-command"

export async function registerMenuCommands(ctx: AppContext) {
    await registerLoginCommand(ctx)
}
