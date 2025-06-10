// Determinar o diretório do binário
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import chalk from 'chalk';
import { Command } from 'commander';
import { GitService } from './services/git.service';
import { SystemService } from './services/system.service';
import { GeminiClient } from './core/gemini.client';
import { ServiceRegistry } from './core/service.registry';
import { DevOpsService } from './services/azure.service';
import { InstructionsService } from './services/instructions.service';
import { LambdaService } from './services/aws.service';
import { GitHubService } from './services/github.service';
import { OpenAIClient } from './core/openai.client';
import logger from './utils/logger';
import { loadConfig } from './config';

// CLI setup using commander
const program = new Command();

program
  .name('agent')
  .description('CLI para interagir com o Agent, suportando comandos interativos e diretos.')
  .version('1.0.0', '-v, --version', 'Exibe a versão da CLI')
  .on('--help', () => {
    logger.info('Exibindo ajuda da CLI');
    console.log(chalk.yellow('\nExemplos de uso:'));
    console.log('  $ agent run "listar arquivos no diretório atual"');
    console.log('  $ agent run -g "criar nova branch teste"');
    console.log('  $ agent run -o "pesquisar na web por TypeScript"');
  });

program
  .command('run')
  .description('Executa um único comando passado como argumento.')
  .argument('<command>', 'Comando a ser executado')
  .option('-g, --gemini', 'Usar GeminiClient')
  .option('-o, --openai', 'Usar OpenAIClient em vez de GeminiClient')
  .option('-w, --web', 'Pesquisa web')
  .action(async (command, options) => {
    try {
      logger.info(`Iniciando execução da CLI com comando: ${command}`);
      logger.debug(`Opções fornecidas: ${JSON.stringify(options)}`);

      const config = await loadConfig();

      const registry = new ServiceRegistry();
      logger.info('Registrando serviços...');
      registry.registerService(new SystemService());
      registry.registerService(new GitService());
      registry.registerService(new DevOpsService(config));
      registry.registerService(new InstructionsService());
      registry.registerService(new LambdaService());
      registry.registerService(new GitHubService(config));
      logger.info('Serviços registrados com sucesso.');

      // logger.debug(`Regras carregadas: ${config.substring(0, 100)}...`);

      let result;
      if (options?.web) {
        logger.info('Executando pesquisa na web com GeminiClient');
        const client = new GeminiClient(config, registry);
        result = await client.webSearch(command);
      } else {
        const clientType = options?.gemini ? 'GeminiClient' : 'OpenAIClient';
        logger.info(`Usando ${clientType} para processar o comando`);
        const client = options?.gemini
          ? new GeminiClient(config, registry)
          : new OpenAIClient(config, registry);
        result = await client.processCommand(command);
      }

      if (result.text) {
        console.log(chalk.greenBright('► ' + result.text));
      } else {
        logger.warn('Nenhum texto retornado pelo cliente.');
        console.log(chalk.yellow('Nenhum resultado retornado.'));
      }

      if (result.function_calls.length > 0) {
        logger.debug(`\n Chamadas de função realizadas: ${JSON.stringify(result.function_calls, null, 2)}`);
      }
    } catch (error) {
      logger.error(`Erro durante a execução da CLI: ${error.message}`, { stack: error.stack });
      console.error(chalk.red(`Erro: ${error.message}`));
      process.exit(1);
    }
  });

// Capturar erros não tratados
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Erro não tratado na promessa: ${reason}`, { promise, stack: reason.stack });
  console.error(chalk.red('Erro inesperado. Veja os logs para mais detalhes.'));
  process.exit(1);
});

// Verificar se nenhum comando foi fornecido
if (process.argv.length <= 2) {
  logger.warn('Nenhum comando fornecido. Exibindo ajuda.');
  console.log(chalk.yellow('Nenhum comando fornecido. Use --help para ver as opções disponíveis.'));
  program.help();
}

// Execute CLI
logger.info('Iniciando CLI...');
program.parse(process.argv);