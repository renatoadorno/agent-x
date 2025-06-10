import { $, Glob } from 'bun';
import logger from '../utils/logger';
import { SchemaType } from '@google/generative-ai';

// Interface para parâmetros de cada função
interface GitInitParams {
  directory: string;
}

interface GitStatusParams {
  directory: string;
}

interface GitAddParams {
  directory: string;
  files: string | string[];
}

interface GitCommitParams {
  directory: string;
  message: string;
}

interface GitPushParams {
  directory: string;
  remote?: string;
  branch?: string;
}

interface NewBranchParams {
  newBranchName: string;
}

interface RemoveBranchParams {
  branchName: string;
}

// Interface para declarações de função OpenAI
interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: SchemaType;
    properties?: Record<string, { type: SchemaType; description: string; enum?: string[]; nullable?: boolean }>;
    required?: string[];
    items?: { type: SchemaType; description?: string };
  };
}

export class GitService {
  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'git_status',
        description: 'Mostra o status do repositório Git no diretório especificado.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Caminho do diretório do repositório Git' },
          },
          required: ['directory'],
        },
      },
      {
        name: 'git_commit',
        description: 'Realiza um commit no repositório Git com a mensagem fornecida.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Caminho do diretório do repositório Git' },
            message: { type: SchemaType.STRING, description: 'Mensagem do commit' },
          },
          required: ['directory', 'message'],
        },
      },
      {
        name: 'git_push',
        description: 'Envia as alterações para o repositório remoto.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Caminho do diretório do repositório Git' },
            remote: { type: SchemaType.STRING, description: 'Nome do repositório remoto (ex.: origin)', nullable: true },
            branch: { type: SchemaType.STRING, description: 'Nome da branch (ex.: main)', nullable: true },
          },
          required: ['directory'],
        },
      },
      {
        name: 'gitBranchList',
        description: 'Lista as branches do repositório e workdir atual',
      },
      {
        name: 'gitBranchListDetails',
        description: 'Lista as branches do repositório e workdir atual, de forma mais detalhada e com mais informações',
      },
      {
        name: 'newBranch',
        description: 'Cria uma nova branch para o repositório e workdir atual',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            newBranchName: { type: SchemaType.STRING, description: 'Nome da nova branch' },
          },
          required: ['newBranchName'],
        },
      },
      {
        name: 'remove_branch',
        description: 'Remove uma branch Git local com git branch -D.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            branchName: { type: SchemaType.STRING, description: 'Nome da branch a ser removida' },
          },
          required: ['branchName'],
        },
      },
      {
        name: 'listBranchsNoSyncRemote',
        description: 'Lista as branches que ainda não foram sincronizadas com o remoto',
      },
    ];
  }

  getFunctionMap(): Record<string, (params: any) => Promise<string>> {
    return {
      git_status: this.gitStatus.bind(this),
      git_commit: this.gitCommit.bind(this),
      git_push: this.gitPush.bind(this),
      gitBranchList: this.gitBranchList.bind(this),
      newBranch: this.newBranch.bind(this),
      remove_branch: this.removeBranch.bind(this),
      listBranchsNoSyncRemote: this.listBranchsNoSyncRemote.bind(this),
      gitBranchListDetails: this.gitBranchListDetails.bind(this),
    };
  }

  async gitStatus({ directory }: GitStatusParams): Promise<string> {
    try {
      const output = await $`cd ${directory} && git status`.text();
      return `**Status do repositório em ${directory}**:\n\`\`\`\n${output}\n\`\`\``;
    } catch (error: any) {
      logger.error(`Erro ao verificar status do repositório em ${directory}: ${error.message}`);
      return `**Erro ao verificar status do repositório em ${directory}**: ${error.message}`;
    }
  }

  async gitCommit({ directory, message }: GitCommitParams): Promise<string> {
    try {
      await $`cd ${directory} && git commit -m ${message}`;
      return `**Commit realizado em ${directory}**: ${message}`;
    } catch (error: any) {
      logger.error(`Erro ao realizar commit em ${directory}: ${error.message}`);
      return `**Erro ao realizar commit em ${directory}**: ${error.message}`;
    }
  }

  async gitPush({ directory, remote = 'origin', branch = 'main' }: GitPushParams): Promise<string> {
    try {
      await $`cd ${directory} && git push ${remote} ${branch}`;
      return `**Alterações enviadas para ${remote}/${branch} a partir de ${directory}**`;
    } catch (error: any) {
      logger.error(`Erro ao enviar alterações para ${remote}/${branch} em ${directory}: ${error.message}`);
      return `**Erro ao enviar alterações para ${remote}/${branch} em ${directory}**: ${error.message}`;
    }
  }

  async gitBranchList(): Promise<string> {
    try {
      return await $`git branch`.text();
    } catch (error: any) {
      logger.error(`Erro ao listar branches: ${error.message}`);
      return `**Erro ao listar branches**: ${error.message}`;
    }
  }

  async gitBranchListDetails(): Promise<string> {
    try {
      return await $`git branch -vv`.text();
    } catch (error: any) {
      logger.error(`Erro ao listar branches detalhadamente: ${error.message}`);
      return `**Erro ao listar branches detalhadamente**: ${error.message}`;
    }
  }

  async newBranch({ newBranchName }: NewBranchParams): Promise<string> {
    try {
      const branches = await $`git branch`.text();
      const baseBranch = branches.includes('master') ? 'master' : 'main';
      await $`git checkout -b ${newBranchName} origin/${baseBranch}`;
      return `Nova branch ${newBranchName} criada com sucesso!`;
    } catch (error: any) {
      logger.error(`Erro ao criar branch ${newBranchName}: ${error.message}`);
      return `**Erro ao criar branch ${newBranchName}**: ${error.message}`;
    }
  }

  async listBranchsNoSyncRemote(): Promise<string> {
    try {
      const result = await $`git for-each-ref --format="%(refname:short)" refs/heads/ | grep -vE "^$(git ls-remote --heads origin | cut -f2 | sed 's#refs/heads/##')"`.text();
      return result || 'Nenhuma branch local não sincronizada encontrada.';
    } catch (error: any) {
      logger.error(`Erro ao listar branches não sincronizadas: ${error.message}`);
      return `**Erro**: ${error.message}`;
    }
  }

  async removeBranch({ branchName }: RemoveBranchParams): Promise<string> {
    try {
      // Validar branchName
      if (!branchName || typeof branchName !== 'string') {
        const errorMsg = `Nome da branch inválido: ${JSON.stringify(branchName)}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      const cleanedBranchName = branchName
        .replace(/\\+$/, '') // Remove barras invertidas
        .replace(/^['"]|['"]$/g, '') // Remove aspas
        .trim(); // Remove espaços

      if (!cleanedBranchName || cleanedBranchName.match(/[\s;|$&]/)) {
        const errorMsg = `Nome da branch contém caracteres inválidos ou está vazio: ${cleanedBranchName}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      const result = await $`git branch -D ${cleanedBranchName}`.quiet().text();
      logger.info(`Branch ${cleanedBranchName} removida com sucesso.`);
      return `Branch ${cleanedBranchName} removida com sucesso.`;
    } catch (error: any) {
      const errorMessage = error.stderr?.toString() || error.message || 'Erro desconhecido ao remover a branch.';
      logger.error(`Erro ao remover branch ${branchName}: ${errorMessage}`);
      return `**Erro**: ${errorMessage}`;
    }
  }
}