// Aqui nesse codigo quero colocar uma option
// option -o utiliza OpenAIClient
// caso ao contrario utiliza o GeminiClient
import chalk from 'chalk';
import { Command } from 'commander';
import { GitService } from './services/git.service';
import { SystemService } from './services/system.service';
import { GeminiClient } from './core/gemini.client';
import { ServiceRegistry } from './core/service.registry';
import { settings } from './config/env';
import { getRules } from './config/rules';
import { DevOpsService } from './services/azure.service';
import { InstructionsService } from './services/instructions.service';
import { LambdaService } from './services/aws.service';
import { GitHubService } from './services/github.service';
import { OpenAIClient } from './core/openai.client';
import logger from './utils/logger';

// CLI setup using commander
const program = new Command();

program
  .name('agent')
  .description('CLI para interagir com o Agent, suportando comandos interativos e diretos.');

program
  .command('run')
  .description('Executa um único comando passado como argumento.')
  .argument('<command>', 'Comando a ser executado')
  .option('-g, --gemini', 'Usar GeminiClient')
  .option('-o, --openai', 'Usar OpenAIClient em vez de GeminiClient')
  .option('-w, --web', 'Pesquisa web')
  .action(async (command, options) => {
    const registry = new ServiceRegistry();
    registry.registerService(new SystemService());
    registry.registerService(new GitService());
    registry.registerService(new DevOpsService());
    registry.registerService(new InstructionsService());
    registry.registerService(new LambdaService());
    registry.registerService(new GitHubService());

    const rules = await getRules();

    if (options?.web) {
      const client = new GeminiClient(rules, registry)
      const result = await client.webSearch(command);
      console.log(chalk.greenBright('► ' + result.text));
      return;
    }

    const client = options?.gemini ? new GeminiClient(rules, registry) : new OpenAIClient(rules, registry);

    const result = await client.processCommand(command);
    if (result.text) {
      console.log(chalk.greenBright('► ' + result.text));
    }
  });

// Execute CLI
program.parse(process.argv);