import { registerLoginCommand } from "@/lib/commands/login-command"
import { Mdb } from "@/lib/db"

export async function registerMenuCommands(db: Mdb) {
    await registerLoginCommand(db)
}
