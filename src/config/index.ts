import * as yaml from 'js-yaml';
import logger from '../utils/logger';
import makePath from '../utils/makePath';

// Tipos mínimos para o retorno do config
export interface AgentConfig {
  GOOGLE_API_KEY: string;
  GEMINI_MODEL: string;
  XAI_API_KEY: string;
  XAI_MODEL: string;
  GITHUB_PAT: string;
  AZURE_DEVOPS_ORGANIZATION: string;
  AZURE_DEVOPS_USER_EMAIL: string;
  AZURE_DEVOPS_DEFAULT_PROJECT: string;
  AZURE_DEVOPS_PAT: string;
  AZURE_DEVOPS_SPRINT_PATH: string;
  RULES: string;
}

// Se necessário, crie um arquivo src/types/js-yaml.d.ts com: declare module 'js-yaml';
// Tipos para o objeto de configuração carregado do YAML
type RawConfig = {
  gemini: { api_key: string; model?: string };
  xai: { api_key: string; model?: string };
  github: { pat: string };
  azure_devops: {
    organization: string;
    user_email: string;
    default_project: string;
    pat: string;
    sprint_path: string;
  };
};

export async function loadConfig(): Promise<AgentConfig> {
  try {
    const rulesFile = Bun.file(makePath("rules.md"));
    const rulesContent = await rulesFile.text();

    const configFile = Bun.file(makePath("config.yml"));
    const configContent = await configFile.text();
    const config = yaml.load(configContent) as RawConfig;

    // Validar configurações obrigatórias
    const requiredFields = [
      { path: 'xai.api_key', name: 'xai.api_key' },
      { path: 'github.pat', name: 'github.pat' },
      { path: 'azure_devops.pat', name: 'azure_devops.pat' },
      { path: 'gemini.api_key', name: 'google.api_key' },
    ];

    for (const field of requiredFields) {
      const value = field.path.split('.').reduce((obj, key) => (obj && typeof obj === 'object' ? (obj as any)[key] : undefined), config);
      if (!value) {
        throw new Error(`Configuração obrigatória ${field.name} não definida em config.yml`);
      }
    }

    return {
      GOOGLE_API_KEY: config.gemini.api_key,
      GEMINI_MODEL: config.gemini?.model || 'gemini-2.0-flash',
      XAI_API_KEY: config.xai.api_key,
      XAI_MODEL: config.xai?.model || 'grok-3',
      GITHUB_PAT: config.github.pat,
      AZURE_DEVOPS_ORGANIZATION: config.azure_devops.organization,
      AZURE_DEVOPS_USER_EMAIL: config.azure_devops.user_email,
      AZURE_DEVOPS_DEFAULT_PROJECT: config.azure_devops.default_project,
      AZURE_DEVOPS_PAT: config.azure_devops.pat,
      AZURE_DEVOPS_SPRINT_PATH: config.azure_devops.sprint_path,
      RULES: rulesContent,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Falha ao carregar configurações, verifique o config.yml e rules.md: ${message}`);
    throw new Error(`Falha ao carregar configurações: ${message}`);
  }
}