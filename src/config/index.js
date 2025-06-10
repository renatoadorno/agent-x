import * as yaml from 'js-yaml';
import logger from '../utils/logger';
import makePath from '../utils/makePath';

export async function loadConfig() {
  try {
    const rulesFile = Bun.file(makePath("rules.md"));
    const rulesContent = await rulesFile.text();

    const configFile = Bun.file(makePath("config.yml"));
    const configContent = await configFile.text();
    const config = yaml.load(configContent);

    // Validar configurações obrigatórias
    const requiredFields = [
      { path: 'xai.api_key', name: 'xai.api_key' },
      { path: 'github.pat', name: 'github.pat' },
      { path: 'azure_devops.pat', name: 'azure_devops.pat' },
      { path: 'gemini.api_key', name: 'google.api_key' },
    ];

    for (const field of requiredFields) {
      const value = field.path.split('.').reduce((obj, key) => obj?.[key], config);
      if (!value) {
        throw new Error(`Configuração obrigatória ${field.name} não definida em config.yml`);
      }
    }

    return {
      GOOGLE_API_KEY: config.gemini.api_key,
      GEMINI_MODEL: config.gemini?.model || 'gemini-2.0-flash', // gemini-2.5-flash-preview-05-20, gemini-2.0-flash

      XAI_API_KEY: config.xai.api_key,
      XAI_MODEL: config.xai?.model || 'grok-3', // grok-3, grok-3-mini-fast

      GITHUB_PAT: config.github.pat,

      AZURE_DEVOPS_ORGANIZATION: config.azure_devops.organization,
      AZURE_DEVOPS_USER_EMAIL: config.azure_devops.user_email,
      AZURE_DEVOPS_DEFAULT_PROJECT: config.azure_devops.default_project,
      AZURE_DEVOPS_PAT: config.azure_devops.pat,
      AZURE_DEVOPS_SPRINT_PATH: config.azure_devops.sprint_path,
      RULES: rulesContent,
    };
  } catch (error) {
    logger.error(`Falha ao carregar configurações, verifique o config.yml e rules.md: ${error.message}`);
    throw new Error(`Falha ao carregar configurações: ${error.message}`);
  }
}