import { $, Glob } from 'bun';
import { homedir } from 'os';
import { join } from 'path';
import { SchemaType } from '@google/generative-ai';
import logger from '../utils/logger';

// Interfaces para parâmetros
interface ListFilesParams {
  directory: string;
}

interface CreateDirectoryParams {
  path: string;
}

interface DeleteFileParams {
  path: string;
}

interface WriteFileParams {
  path: string;
  content: string;
}

interface FindDirectoryParams {
  dirName: string;
}

interface FindFileParams {
  filename: string;
  dirName: string;
}

interface ReadFileContentParams {
  filePath: string;
}

interface FindLocalProjectParams {
  dirName: string;
  maxDepth?: number,
  cache?: Set<unknown>
}

// Interface para declarações de função
interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: SchemaType;
    properties?: Record<string, { type: SchemaType; description: string }>;
    required?: string[];
  };
}

type Queue = {
  path: string, 
  depth: number | undefined
}

export class SystemService {
  getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'listFiles',
        description: 'Lista todos os arquivos em um diretório especificado',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Caminho do diretório' },
          },
          required: ['directory'],
        },
      },
      {
        name: 'findDirectory',
        description: 'Pesquisa um diretório pelo nome em todo o sistema de arquivos do usuário e retorna o caminho completo desse diretório. Use esta função antes de buscar arquivos em diretórios cujo caminho completo não é conhecido.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dirName: { type: SchemaType.STRING, description: 'Nome do diretorio' },
          },
          required: ['dirName'],
        },
      },
      {
        name: 'findFile',
        description: 'Encontra um arquivo a partir do nome do arquivo e do nome do diretório (não aceita caminho completo). Retorna o caminho e o conteúdo do arquivo.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            filename: { type: SchemaType.STRING, description: 'Nome do arquivo a ser encontrado (ex: data.csv)' },
            dirName: { type: SchemaType.STRING, description: 'Nome do diretório onde o arquivo está localizado (ex: Documentos). Não aceita caminho completo.' },
          },
          required: ['filename', 'dirName'],
        },
      },
      {
        name: 'createDirectory',
        description: 'Cria um diretório no caminho especificado',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: 'Caminho para o novo diretório' },
          },
          required: ['path'],
        },
      },
      {
        name: 'getHomedir',
        description: 'Descobre o caminho do homedir do sistema',
      },
      {
        name: 'getWorkDir',
        description: 'Função para descobrir o caminho (path) do diretorio de trabalho atual, o nome do diretorio na maioria das vezes vai ser o nome do meu projeto',
      },
      {
        name: 'findLocalProjectByNmae',
        description: 'Descobre o caminho de um projeto ou repositório Git local',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dirName: { type: SchemaType.STRING, description: 'Nome do projeto ou repositório' },
          },
          required: ['dirName'],
        },
      },
    ];
  }

  getFunctionMap(): Record<string, (params: any) => Promise<any>> {
    return {
      listFiles: this.listFiles.bind(this),
      createDirectory: this.createDirectory.bind(this),
      // deleteFile: this.deleteFile.bind(this),
      // writeFile: this.writeFile.bind(this),
      findDirectory: this.findDirectory.bind(this),
      findFile: this.findFile.bind(this),
      readFileContent: this.readFileContent.bind(this),
      getWorkDir: this.getWorkDir.bind(this),
      getDirProjectName: this.getWorkDir.bind(this),
      getHomedir: this.getHomedir.bind(this),
      findLocalProjectByNmae: this.findLocalProjectByNmae.bind(this),
    };
  }

  async listFiles({ directory }: ListFilesParams): Promise<string[]> {
    const glob = new Glob('**/*');
    const files: string[] = [];
    for await (const file of glob.scan(directory)) {
      files.push(file);
    }
    return files;
  }

  async createDirectory({ path }: CreateDirectoryParams): Promise<string> {
    try {
      await $`mkdir -p ${path}`;
      return `Diretório criado: ${path}`;
    } catch (error: any) {
      logger.error(`Erro ao criar diretório ${path}: ${error.message}`);
      throw new Error(`Erro ao criar diretório: ${error.message}`);
    }
  }

  async findDirectory({ dirName }: FindDirectoryParams, maxDepth: number = 4, cache: Set<string> = new Set()): Promise<string | null> {
    const rootDir = homedir();
    const queue: { path: string; depth: number }[] = [{ path: rootDir, depth: 0 }];

    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      if (cache.has(path)) continue;
      cache.add(path);

      if (depth > maxDepth) continue;

      if (path.split('/').pop() === dirName) {
        return path;
      }

      try {
        const subDirs = await $`ls -d ${path}/*/`.text();
        subDirs.split('\n').filter(Boolean).forEach(subDir => {
          queue.push({ path: subDir.trim(), depth: depth + 1 });
        });
      } catch (error: any) {
        if (error.exitCode === 1 && error.stderr?.includes('no matches found')) {
          logger.info(`Nenhum subdiretório encontrado em: ${path}`);
        } else {
          logger.error(`Erro ao listar subdiretórios em ${path}: ${error.message}`);
        }
      }
    }

    return null;
  }

  async findFile(params: { filename?: string; dirName?: string }) {
    logger.info(params);
    try {
      const { filename, dirName } = params || {};
      if (!filename || !dirName) {
        return 'Os parâmetros filename e dirName são obrigatórios.';
      }
      // Validação: não aceitar caminho completo no dirName
      if (typeof dirName !== 'string' || dirName.includes('/') || dirName.includes('\\')) {
        return 'O parâmetro dirName deve ser apenas o nome do diretório, não o caminho completo.';
      }
      // Buscar o diretório pelo nome usando findDirectory
      const workdir = await this.findDirectory({ dirName });
      if (!workdir) {
        return `Diretório '${dirName}' não encontrado no sistema.`;
      }
      const glob = new Glob(`**/${filename}`);
      for await (const file of glob.scan(workdir)) {
        const filePath = join(workdir, file);
        const content = await this.readFileContent({ filePath });
        return { filePath, content };
      }
      return `Arquivo '${filename}' não encontrado em '${workdir}'.`;
    } catch (error: any) {
      logger.error(`Erro ao buscar arquivo ${params?.filename}: ${error.message}`);
      return `Erro ao buscar arquivo ${params?.filename}: ${error.message}`;
    }
  }

  async getHomedir(): Promise<string> {
    try {
      return await $`echo $HOME`.text();
    } catch (error: any) {
      logger.error(`Erro ao obter homedir: ${error.message}`);
      throw new Error(`Erro ao obter homedir: ${error.message}`);
    }
  }

  async readFileContent({ filePath }: ReadFileContentParams): Promise<string>  {
    if (!filePath || typeof filePath !== 'string') {
      return `Arquivo ${filePath} não encontrado no homedir`;
    }
    const file = Bun.file(filePath);
    const content = await file.text();
    return `Conteúdo de ${filePath}:
${content}`;
  }

  async getWorkDir(): Promise<string> {
    return await $`pwd`.text();
  }

  async findLocalProjectByNmae({ dirName, maxDepth = 4, cache = new Set() }: FindLocalProjectParams) {
    const rootDir = `${homedir()}/work`;
    const queue: Queue[] = [{ path: rootDir, depth: 0 }];
    while (queue.length > 0) {
      const queueShift: Queue = queue.shift() || { path: rootDir, depth: 0 };
      if (cache.has(queueShift?.path)) continue;
      cache.add(queueShift?.path);
      if (queueShift?.depth && queueShift?.depth > maxDepth) continue;
      if (queueShift?.path.split('/').pop() === dirName) {
        return queueShift?.path;
      }
      try {
        const subDirs = await $`ls -d ${queueShift?.path}/*/`.text();
        subDirs.split('\n').filter(Boolean).forEach(subDir => {
          queue.push({ path: subDir.trim(), depth: queueShift?.depth ? queueShift?.depth + 1 : 1 });
        });
      } catch (error: any) {
        if (error.exitCode === 1 && error.stderr.includes('no matches found')) {
          // logger.info(`Nenhum subdiretório encontrado em: ${path}`);
        }
      }
    }
    return null;
  }
}