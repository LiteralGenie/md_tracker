import { AppContext } from "@/app-context"
import { registerConfigCommand } from "@/lib/commands/config-command"
import { registerLoginCommand } from "@/lib/commands/login-command"

export async function registerMenuCommands(ctx: AppContext) {
    await registerConfigCommand(ctx)
    await registerLoginCommand(ctx)
}
