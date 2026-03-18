import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import type { MCPServerConfig } from "@github/copilot-sdk";

/**
 * Per-user MCP server configuration service.
 * Stores user configs as JSON files on Azure Files mount: {basePath}/{userId}/mcp-config.json
 */
export class UserMcpService {
  constructor(private basePath: string) {}

  private userDir(userId: string): string {
    const dir = join(this.basePath, userId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private configPath(userId: string): string {
    return join(this.userDir(userId), "mcp-config.json");
  }

  /** Get all MCP servers configured by a user */
  getUserServers(userId: string): Record<string, MCPServerConfig> {
    const path = this.configPath(userId);
    if (!existsSync(path)) return {};
    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);
      return (parsed.mcpServers ?? parsed) as Record<string, MCPServerConfig>;
    } catch (err) {
      console.warn(`[UserMcpService] Failed to read config for ${userId}:`, err);
      return {};
    }
  }

  /** Save full MCP server config for a user (replaces all) */
  setUserServers(userId: string, servers: Record<string, MCPServerConfig>): void {
    const path = this.configPath(userId);
    writeFileSync(path, JSON.stringify({ mcpServers: servers }, null, 2));
    console.log(`[UserMcpService] Saved ${Object.keys(servers).length} server(s) for user ${userId}`);
  }

  /** Add or update a single MCP server for a user */
  setUserServer(userId: string, name: string, config: MCPServerConfig): void {
    const servers = this.getUserServers(userId);
    servers[name] = config;
    this.setUserServers(userId, servers);
  }

  /** Remove a single MCP server from user config */
  removeUserServer(userId: string, name: string): boolean {
    const servers = this.getUserServers(userId);
    if (!(name in servers)) return false;
    delete servers[name];
    this.setUserServers(userId, servers);
    return true;
  }

  /** Check if a user has any config file */
  hasConfig(userId: string): boolean {
    return existsSync(this.configPath(userId));
  }
}
