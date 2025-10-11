import { AppContext } from "@/appContext"
import { registerLoginCommand } from "@/lib/commands/login-command"

export async function registerMenuCommands(ctx: AppContext) {
    await registerLoginCommand(ctx)
}
