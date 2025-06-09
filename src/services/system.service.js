import { $, Glob } from 'bun';
import { homedir } from 'os';
import { join } from 'path';
import { SchemaType } from '@google/generative-ai';
import logger from '../utils/logger';

export class SystemService {
  getFunctionDeclarations() {
    return [
      {
        name: 'listFiles',
        description: 'Lists all files in a specified directory',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            directory: { type: SchemaType.STRING, description: 'Path to the directory' },
          },
          required: ['directory'],
        },
      },
      {
        name: 'createDirectory',
        description: 'Creates a directory at the specified path',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: 'Path for the new directory' },
          },
          required: ['path'],
        },
      },
      {
        name: 'deleteFile',
        description: 'Deletes a file at the specified path',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: 'Path to the file to delete' },
          },
          required: ['path'],
        },
      },
      {
        name: 'writeFile',
        description: 'Writes content to a file at the specified path',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            path: { type: SchemaType.STRING, description: 'Path to the file' },
            content: { type: SchemaType.STRING, description: 'Content to write to the file' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'findDirectory',
        description: 'Search directory by name returning the full path of the directory',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dirName: { type: SchemaType.STRING, description: 'Directory name' },
          },
          required: ['dirName'],
        },
      },
      {
        name: 'findFile',
        description: 'Search for file by name in directory specified by pathdir returning full path of file',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            filename: { type: SchemaType.STRING, description: 'File name' },
            pathDir: { type: SchemaType.STRING, description: 'Directory path' },
          },
          required: ['filename', 'pathDir'],
        },
      },
      {
        name: 'readFileContent',
        description: 'Reads the contents of a file with the full file path',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            filePath: { type: SchemaType.STRING, description: 'Path to the file' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'getWorkDir',
        description: 'Função para descobrir o caminho (path) do diretorio de trabalho atual, o nome do diretorio na maioria das vezes vai ser o nome do meu projeto',
      },
      {
        name: 'getDirProjectName',
        description: 'Função para descobrir o caminho (path) do diretorio do meu projeto, revelando o nome do projeto',
      },
      {
        name: 'getHomedir',
        description: 'Função para descobrir o caminho (path) do homedir do meu sistema',
      },
      {
        name: 'findLocalProjectByNmae',
        description: 'Função para descobrir o caminho (path) de um projeto ou repositorio git local',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dirName: { type: SchemaType.STRING, description: 'Nome do projeto ou repositorio' },
          },
          required: ['dirName'],
        },
      },
    ];
  }

  getFunctionMap() {
    return {
      listFiles: this.listFiles.bind(this),
      createDirectory: this.createDirectory.bind(this),
      deleteFile: this.deleteFile.bind(this),
      writeFile: this.writeFile.bind(this),
      findDirectory: this.findDirectory.bind(this),
      findFile: this.findFile.bind(this),
      readFileContent: this.readFileContent.bind(this),
      getWorkDir: this.getWorkDir.bind(this),
      getDirProjectName: this.getWorkDir.bind(this),
      getHomedir: this.getHomedir.bind(this),
      findLocalProjectByNmae: this.findLocalProjectByNmae.bind(this),
    };
  }

  async listFiles(directory) {
    const glob = new Glob('**/*');
    const files = [];
    for await (const file of glob.scan(directory)) {
      files.push(file);
    }
    return files;
  }

  async createDirectory(path) {
    await $`mkdir -p ${path}`;
    return `Directory created: ${path}`;
  }

  async deleteFile(path) {
    await $`rm ${path}`;
    return `File deleted: ${path}`;
  }

  async writeFile(path, content) {
    await Bun.write(path, content);
    return `Content written to: ${path}`;
  }

  async findDirectory(dirName, maxDepth = 4, cache = new Set()) {
    const rootDir = homedir(); // Ponto de partida: diretório home do usuário
    const queue = [{ path: rootDir, depth: 0 }]; // Fila para BFS

    while (queue.length > 0) {
      const { path, depth } = queue.shift(); // Remove o próximo da fila

      // Evita revisitar diretórios já explorados
      if (cache.has(path)) continue;
      cache.add(path);

      // Limita a profundidade para evitar buscas muito profundas
      if (depth > maxDepth) continue;

      // Verifica se o diretório atual é o procurado
      if (path.split('/').pop() === dirName) {
        return path; // Retorna o caminho completo se encontrado
      }

      // Lista subdiretórios e adiciona à fila

      try {
        const subDirs = await $`ls -d ${path}/*/`.text();
        subDirs.split('\n').filter(Boolean).forEach(subDir => {
          queue.push({ path: subDir.trim(), depth: depth + 1 });
        });
      } catch (error) {
        if (error.exitCode === 1 && error.stderr.includes('no matches found')) {
          logger.info(`Nenhum subdiretório encontrado em: ${path}`);
          // Continua a execução sem adicionar subdiretórios à fila
        }
      }
    }

    return null; // Retorna null se o diretório não for encontrado
  }

  async findFile(filename, pathDir) {
    try {
      let workdir = pathDir;

      // Check if pathDir is a valid path
      const isValidPath = pathDir && (await Bun.file(pathDir).exists()) && (await Bun.file(pathDir).type()) === 'dir';
      
      // If pathDir is not a valid path, assume it's a directory name and use findDirectory
      if (pathDir && !isValidPath) {
        workdir = await this.findDirectory(pathDir);
        if (!workdir) {
          return `Diretório ${pathDir} não encontrado no homedir.`;
        }
      } else if (!pathDir) {
        // If pathDir is null or undefined, default to homedir
        workdir = homedir();
      }

      // Use Glob to search for the file in workdir
      const glob = new Glob(`**/${filename}`);
      for await (const file of glob.scan(workdir)) {
        return join(workdir, file); // Return full path of the found file
      }

      return `Arquivo ${filename} não encontrado em ${workdir}.`;
    } catch (error) {
      return `Erro ao buscar arquivo ${filename}: ${error.message}`;
    }
  }

  async readFileContent(filePath) {
    if (!filePath) {
      return `Arquivo ${filePath} não encontrado no homedir`;
    }
    const file = Bun.file(filePath);
    const content = await file.text();
    return `Conteúdo de ${filePath}:\n${content}`;
  }

  async shellCommand(command) {
    return await $`${command}`.text();
  }

  async getWorkDir() {
    return await $`pwd`.text();
  }

  async getHomedir() {
    return await $`echo $HOME`.text();
  }

  async findLocalProjectByNmae(dirName, maxDepth = 4, cache = new Set()) {
    const rootDir = `${homedir()}/work`; // Ponto de partida: diretório home do usuário
    const queue = [{ path: rootDir, depth: 0 }]; // Fila para BFS

    while (queue.length > 0) {
      const { path, depth } = queue.shift(); // Remove o próximo da fila

      // Evita revisitar diretórios já explorados
      if (cache.has(path)) continue;
      cache.add(path);

      // Limita a profundidade para evitar buscas muito profundas
      if (depth > maxDepth) continue;

      // Verifica se o diretório atual é o procurado
      if (path.split('/').pop() === dirName) {
        return path; // Retorna o caminho completo se encontrado
      }

      // Lista subdiretórios e adiciona à fila

      try {
        const subDirs = await $`ls -d ${path}/*/`.text();
        subDirs.split('\n').filter(Boolean).forEach(subDir => {
          queue.push({ path: subDir.trim(), depth: depth + 1 });
        });
      } catch (error) {
        if (error.exitCode === 1 && error.stderr.includes('no matches found')) {
          logger.info(`Nenhum subdiretório encontrado em: ${path}`);
          // Continua a execução sem adicionar subdiretórios à fila
        }
      }
    }

    return null; // Retorna null se o diretório não for encontrado
  }

  async getLocalProjectList() {
    return await $`ls -la $HOME/work`.text()
  }
}