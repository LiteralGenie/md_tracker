import { AppContext } from "@/app-context"
import { registerConfigCommand } from "@/lib/commands/config-command"
import { registerLoginCommand } from "@/lib/commands/login-command"
import { registerViewLogsCommand } from "@/lib/commands/view-logs-command"

export async function registerMenuCommands(ctx: AppContext) {
    await registerConfigCommand(ctx)
    await registerLoginCommand(ctx)
    await registerViewLogsCommand(ctx)
}
