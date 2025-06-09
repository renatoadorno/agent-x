import { $, Glob } from 'bun';
import logger from '../utils/logger';
import { SchemaType } from '@google/generative-ai';

export class GitService {
  getFunctionDeclarations() {
    return [
      // {
      //   name: 'git_init',
      //   description: 'Inicializa um repositório Git no diretório especificado.',
      //   parameters: {
      //     type: SchemaType.OBJECT,
      //     properties: {
      //       directory: { type: SchemaType.STRING, description: 'Caminho do diretório onde inicializar o repositório' },
      //     },
      //     required: ['directory'],
      //   },
      // },
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
        name: 'git_add',
        description: 'Adiciona arquivos ao índice do Git no diretório especificado.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Caminho do diretório do repositório Git' },
            files: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Lista de arquivos a adicionar (ou "." para todos)' },
          },
          required: ['directory', 'files'],
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
        description: 'Lista as branches do repositorio e workdir atual',
      },
      {
        name: 'gitBranchListDetails',
        description: 'Lista as branches do repositorio e workdir atual, de forma mais dedalhada e com mais informacaoes',
      },
      {
        name: 'newBranch',
        description: 'Cria uma nova branch para o repositorio e workdir atual',
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
            branchName: {
              type: 'string',
              description: 'Nome da branch a ser removida.',
            },
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

  getFunctionMap() {
    return {
      // git_init: this.gitInit.bind(this),
      git_status: this.gitStatus.bind(this),
      git_add: this.gitAdd.bind(this),
      git_commit: this.gitCommit.bind(this),
      git_push: this.gitPush.bind(this),
      gitBranchList: this.gitBranchList.bind(this),
      newBranch: this.newBranch.bind(this),
      remove_branch: this.removeBranch.bind(this),
      listBranchsNoSyncRemote: this.listBranchsNoSyncRemote.bind(this),
      gitBranchListDetails: this.gitBranchListDetails.bind(this),
    };
  }

  async gitInit(directory) {
    try {
      await $`cd ${directory} && git init`;
      return `**Repositório Git inicializado em**: ${directory}`;
    } catch (error) {
      return `**Erro ao inicializar repositório Git em ${directory}**: ${error.message}`;
    }
  }

  async gitStatus(directory) {
    try {
      const output = await $`cd ${directory} && git status`.text();
      return `**Status do repositório em ${directory}**:\n\`\`\`\n${output}\n\`\`\``;
    } catch (error) {
      return `**Erro ao verificar status do repositório em ${directory}**: ${error.message}`;
    }
  }

  async gitAdd(directory, files) {
    try {
      const fileList = Array.isArray(files) ? files.join(' ') : files;
      await $`cd ${directory} && git add ${fileList}`;
      return `**Arquivos adicionados ao índice em ${directory}**: ${fileList}`;
    } catch (error) {
      return `**Erro ao adicionar arquivos em ${directory}**: ${error.message}`;
    }
  }

  async gitCommit(directory, message) {
    try {
      await $`cd ${directory} && git commit -m ${message}`;
      return `**Commit realizado em ${directory}**: ${message}`;
    } catch (error) {
      return `**Erro ao realizar commit em ${directory}**: ${error.message}`;
    }
  }

  async gitPush(directory, remote = 'origin', branch = 'main') {
    try {
      await $`cd ${directory} && git push ${remote} ${branch}`;
      return `**Alterações enviadas para ${remote}/${branch} a partir de ${directory}**`;
    } catch (error) {
      return `**Erro ao enviar alterações para ${remote}/${branch} em ${directory}**: ${error.message}`;
    }
  }

  async gitBranchList() {
    return await $`git branch`.text();
  }

  async gitBranchListDetails() {
    return await $`git branch -vv`.text();
  }

  async newBranch(newBranchName) {
    const branchs = await $`git branch`.text();

    if (branchs.includes("master")) {
      await $`git checkout -b ${newBranchName} origin/master`;

      return `Nova branch ${newBranchName} criada com sucesso!`
    }

    await $`git checkout -b ${newBranchName} origin/main`;

    return `Nova branch ${newBranchName} criada com sucesso!`
  }

  async listBranchsNoSyncRemote() {
    try {
      const result =  await $`git for-each-ref --format="%(refname:short)" refs/heads/ | grep -vE "^$(git ls-remote --heads origin | cut -f2 | sed 's#refs/heads/##')"`.text();
      return result
    } catch(err) {
      // logger.info(err)
      return `Erro: ${err}`
    }
  }

  // como executar esse tipo de comando no shell do bun, estou tendo problemas
  async removeBranch(params) {
    try {
      // Extrair branchName do objeto ou usar diretamente se for string
      let branchName = typeof params === 'object' && params !== null ? params.branchName : params;

      // Depurar o branchName recebido
      logger.debug(`branchName recebido: ${JSON.stringify(branchName)} (tipo: ${typeof branchName})`);

      // Verificar se branchName é uma string válida
      if (branchName == null || typeof branchName !== 'string') {
        const errorMsg = `Nome da branch inválido: ${JSON.stringify(branchName)} (esperado: string, recebido: ${typeof branchName})`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Limpar o branchName
      let cleanedBranchName = branchName
        .replace(/\\+$/, '') // Remove barras invertidas no final
        .replace(/^['"]|['"]$/g, '') // Remove aspas no início ou fim
        .trim(); // Remove espaços em branco

      // Validar contra caracteres perigosos
      if (!cleanedBranchName || cleanedBranchName.match(/[\s;|$&]/)) {
        const errorMsg = `Nome da branch contém caracteres inválidos ou está vazio: ${cleanedBranchName}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Depurar o branchName limpo
      logger.debug(`branchName limpo: '${cleanedBranchName}'`);

      // Executar o comando git
      const result = await $`git branch -D ${cleanedBranchName}`.quiet().text();

      // Log de sucesso
      logger.info(`Branch ${cleanedBranchName} removida com sucesso.`);
      return `Branch ${cleanedBranchName} removida com sucesso.`;
    } catch (err) {
      // Capturar stderr, se disponível
      const errorMessage = err.stderr?.toString() || err.message || 'Erro desconhecido ao remover a branch.';
      logger.error(`Erro ao remover branch ${JSON.stringify(params)}: ${errorMessage}`);
      return `Erro: ${errorMessage}`;
    }
  }
}