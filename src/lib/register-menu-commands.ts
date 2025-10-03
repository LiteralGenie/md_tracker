import { registerLoginCommand } from "@/lib/commands/login-command"
import { MdTrackerDb } from "@/lib/db"

export async function registerMenuCommands(db: MdTrackerDb) {
    await registerLoginCommand(db)
}
