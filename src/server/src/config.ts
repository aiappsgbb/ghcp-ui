export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;

  azure: {
    foundryEndpoint: string;
    foundryApiKey: string;
    foundryModel: string;
  };

  copilot: {
    githubToken?: string;
    useByok: boolean;
  };
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  const foundryEndpoint = process.env.AZURE_FOUNDRY_ENDPOINT ?? "";
  const foundryApiKey = process.env.AZURE_FOUNDRY_API_KEY ?? "";
  const foundryModel = process.env.AZURE_FOUNDRY_MODEL ?? "gpt-4.1";
  const githubToken = process.env.COPILOT_GITHUB_TOKEN;

  const useByok = Boolean(foundryEndpoint && foundryApiKey);

  return {
    port: parseInt(process.env.PORT ?? "3001", 10),
    nodeEnv,
    isProduction: nodeEnv === "production",
    azure: {
      foundryEndpoint,
      foundryApiKey,
      foundryModel,
    },
    copilot: {
      githubToken,
      useByok,
    },
  };
}
