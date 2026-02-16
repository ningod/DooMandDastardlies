import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import {
  rollCommandData,
  rCommandData,
  secretCommandData,
  sCommandData,
} from "./commands/roll.js";
import { helpCommandData } from "./commands/help.js";
import { timerCommandData } from "./commands/timer.js";

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional: for dev/testing

if (!token || !clientId) {
  console.error(
    "Missing required environment variables: DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID"
  );
  process.exit(1);
}

const commands = [
  rollCommandData.toJSON(),
  rCommandData.toJSON(),
  secretCommandData.toJSON(),
  sCommandData.toJSON(),
  helpCommandData.toJSON(),
  timerCommandData.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash command(s)...`);

    if (guildId) {
      // Guild-scoped (instant, good for development)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Commands registered for guild ${guildId}.`);
    } else {
      // Global (can take up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(
        "Commands registered globally. May take up to 1 hour to appear."
      );
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
})();
