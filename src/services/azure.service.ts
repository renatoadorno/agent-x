import logger from '../utils/logger';
import { SchemaType } from '@google/generative-ai';
import axios from "axios";

// Tipos mínimos para config e parâmetros
interface AzureConfig {
  AZURE_DEVOPS_ORGANIZATION: string;
  AZURE_DEVOPS_DEFAULT_PROJECT: string;
  AZURE_DEVOPS_PAT: string;
  AZURE_DEVOPS_SPRINT_PATH: string;
  AZURE_DEVOPS_USER_EMAIL: string;
}

interface WorkItemParams {
  id: number;
}

// Na seguinte classe altere o getWorkItem(id) para utilizar o axios
export class DevOpsService {
  private organization: string;
  private project: string;
  private pat: string;
  private auth: string;
  private sprintPath: string;
  private assignedTo: string;
  private api: any;
  private validWorkItemTypes: string[];

  constructor(config: AzureConfig) {
    this.organization = config.AZURE_DEVOPS_ORGANIZATION;
    this.project = config.AZURE_DEVOPS_DEFAULT_PROJECT;
    this.pat = config.AZURE_DEVOPS_PAT; // Substitua pelo seu PAT
    this.auth = Buffer.from(`:${this.pat}`).toString('base64');
    this.sprintPath = config.AZURE_DEVOPS_SPRINT_PATH; // Substitua pelo caminho da sprint
    this.assignedTo = config.AZURE_DEVOPS_USER_EMAIL; // Substitua pelo e-mail do responsável
    this.api = axios.create({
      baseURL: `https://dev.azure.com/${this.organization}/${this.project}/_apis`,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.validWorkItemTypes = ['Task', 'meetings', 'Publication', 'Bug Fix', 'Teste', 'Review'];
  }

  getFunctionDeclarations(): any[] {
    return [
      {
        name: 'get_work_item',
        description: 'Obtém detalhes de um work item específico no Azure DevOps.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            // project: { type: SchemaType.STRING, description: 'Nome do projeto no Azure DevOps' },
            id: { type: SchemaType.NUMBER, description: 'ID do work item' },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_back_logs',
        description: 'Obtém a lista detalhada dos meus BackLogs da Sprint atual no Azure DevOps.',
      },
      {
        name: 'create_task',
        description: 'Cria novas tarefas no Azure DevOps.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tasks: {
              type: SchemaType.ARRAY,
              description: 'Conjunto de objetos de tarefa a serem criados',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  title: {
                    type: SchemaType.STRING,
                    description: 'Título da tarefa ou história do usuário',
                  },
                  type: {
                    type: SchemaType.STRING,
                    description: 'Typo da tarefa (opcional)',
                    enum: ['Task', 'meetings', 'Publication', 'Bug Fix', 'Teste', 'Review'], // Restrict to valid types
                  },
                  description: {
                    type: SchemaType.STRING,
                    description: 'Descrição da tarefa',
                  },
                  tags: {
                    type: SchemaType.ARRAY,
                    description: 'Lista de tags associadas à tarefa',
                    items: {
                      type: SchemaType.STRING,
                    },
                  },
                  parentId: {
                    type: SchemaType.INTEGER,
                    description: 'ID do épico ou recurso pai.',
                  },
                  assignedTo: {
                    type: SchemaType.STRING,
                    description: 'E-mail da pessoa designada para a tarefa (opcional)',
                  },
                },
                required: ['title', 'description', 'parentId'],
              },
            },
          },
          required: ['tasks'],
        },
      },
    ];
  }

  getFunctionMap(): Record<string, (...args: any[]) => any> {
    return {
      get_work_item: this.getWorkItem.bind(this),
      create_task: this.createWorkItems.bind(this),
      get_back_logs: this.getBackLogs.bind(this),
    };
  }

  async validateWorkItem(id: number): Promise<any> {
    try {
      const response = await this.api.get(`/wit/workitems/${id}?api-version=7.1`);
      return {
        exists: true,
        type: response.data.fields['System.WorkItemType']
      };
    } catch (error: any) {
      throw new Error(`Work item ${id} inválido: ${error.response?.data?.message || error.message}`);
    }
  }

  async getParentIds(): Promise<any[]> {
    try {
      const payload = {
        query: `
            SELECT [System.Id], [System.Title], [System.State]
            FROM WorkItems
            WHERE [System.IterationPath] = '${this.sprintPath}'
            AND [System.AssignedTo] = '${this.assignedTo}'
          `
      };

      const wiqlResponse = await this.api.post(`/wit/wiql?api-version=7.1`, payload);
      const taskIds = wiqlResponse.data.workItems.map((item: any) => item.id);
      if (taskIds.length === 0) {
        // console.log('Nenhuma task encontrada.');
        return [];
      }

      const params = {
        ids: taskIds.join(','),
        '$expand': 'relations',
        'api-version': '7.1'
      };

      const response = await this.api.get('/wit/workitems', { params });

      const parentIds = response.data.value.map((obj: any) => obj.fields["System.Parent"]);
      return parentIds;
    } catch (error) {
      return [];
      // console.error('Erro ao listar tasks ou pais:', error.response?.data || error.message);
    }
  }

  async getBackLogs(): Promise<any[]> {
    try {
      const parentIds = await this.getParentIds();
      const params = { ids: parentIds.join(','), '$expand': 'all', 'api-version': '7.1' };
      const response = await this.api.get('/wit/workitems', { params });
      const workItems = response.data.value;
      // const workItemsWithComments = await Promise.all(workItems.map(async (workItem) => {
      //   try {
      //     const revisionsResponse = await this.api.get(`/wit/workItems/${workItem.id}/revisions`, {
      //       params: {
      //         '$expand': 'all', // Inclui todos os detalhes das revisões
      //         '$top': 100, // Limite de revisões por work item
      //         'api-version': '7.1'
      //       }
      //     });
      //     const azureComments = revisionsResponse.data.value
      //       .filter(revision => revision.fields?.['System.History']) // Filtra revisões com comentários
      //       .map(revision => ({
      //         text: revision.fields['System.History'],
      //         author: revision.fields['System.ChangedBy']?.displayName || 'Desconhecido',
      //         date: revision.fields['System.ChangedDate']
      //       }));

      //     return {
      //       ...workItem, // Todos os campos normais
      //       azureComments
      //     };
      //   } catch (error) {
      //     console.error(`Erro ao obter comentários para work item ${workItem.id}: ${error.message}`);
      //     return {
      //       id: workItem.id,
      //       fields: workItem.fields,
      //       comments: []
      //     };
      //   }
      // }));

      logger.info(workItems);

      return workItems;
    } catch (err) {
      return []
    }
  }

  async getWorkItem(parameters: WorkItemParams): Promise<any> {
    try {
      if (!Number.isInteger(parameters.id) || parameters.id <= 0) {
        throw new Error(`ID inválido: ${parameters.id}. Deve ser um número inteiro positivo.`);
      }

      console.info(`Obtendo detalhes do work item ${parameters.id}`);
      const response = await this.api.get(`/wit/workitems/${parameters.id}?$expand=relations&api-version=7.1`);

      const workItem = response.data;
      return {
        id: workItem.id,
        title: workItem.fields['System.Title'],
        type: workItem.fields['System.WorkItemType'],
        state: workItem.fields['System.State'],
        assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
        description: workItem.fields['System.Description'] || null,
        tags: workItem.fields['System.Tags']?.split('; ').filter(Boolean) || [],
        parentId: workItem.fields['System.Parent'] || null,
        relations: workItem.relations || [],
        url: workItem.url
      };
    } catch (error: any) {
      return `Erro ao obter work item ${parameters.id}: ${error.response?.data?.message || error.message}`
    }
  }

  async createWorkItems(tasks: any[]): Promise<any> {
    // Implementação real ou placeholder
    return [];
  }
}