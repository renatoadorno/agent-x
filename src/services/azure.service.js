import logger from '../utils/logger';
import { SchemaType } from '@google/generative-ai';
import axios from "axios";

// Na seguinte classe altere o getWorkItem(id) para utilizar o axios
export class DevOpsService {
  constructor() {
    this.organization = Bun.env.AZURE_DEVOPS_ORGANIZATION;
    this.project = Bun.env.AZURE_DEVOPS_DEFAULT_PROJECT;
    this.pat = Bun.env.AZURE_DEVOPS_PAT; // Substitua pelo seu PAT
    this.auth = Buffer.from(`:${this.pat}`).toString('base64');
    this.sprintPath = Bun.env.AZURE_DEVOPS_SPRINT_PATH; // Substitua pelo caminho da sprint
    this.assignedTo = Bun.env.AZURE_DEVOPS_USER_EMAIL; // Substitua pelo e-mail do responsável
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

  getFunctionDeclarations() {
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

  getFunctionMap() {
    return {
      get_work_item: this.getWorkItem.bind(this),
      create_task: this.createWorkItems.bind(this),
      get_back_logs: this.getBackLogs.bind(this),
    };
  }

  async validateWorkItem(id) {
    try {
      const response = await this.api.get(`/wit/workitems/${id}?api-version=7.1`);
      return {
        exists: true,
        type: response.data.fields['System.WorkItemType']
      };
    } catch (error) {
      throw new Error(`Work item ${id} inválido: ${error.response?.data?.message || error.message}`);
    }
  }

  async getParentIds() {
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

      const taskIds = wiqlResponse.data.workItems.map(item => item.id);
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

      const parentIds = response.data.value.map((obj) => obj.fields["System.Parent"]);
      return parentIds;
    } catch (error) {
      return [];
      // console.error('Erro ao listar tasks ou pais:', error.response?.data || error.message);
    }
  }

  async getBackLogs() {
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

  async getWorkItem(id) {
    try {
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`ID inválido: ${id}. Deve ser um número inteiro positivo.`);
      }

      console.info(`Obtendo detalhes do work item ${id}`);
      const response = await this.api.get(`/wit/workitems/${id}?$expand=relations&api-version=7.1`);

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
    } catch (error) {
      return `Erro ao obter work item ${id}: ${error.response?.data?.message || error.message}`;
    }
  }

  // verifique se essa funcao esta criando a tarefa como uma filha
  async createWorkItems(tasks) {
    try {
      // Validar estrutura de tasks
      if (!Array.isArray(tasks) || !tasks.length) {
        return { data: [], error: null };
      }

      tasks.forEach((task, index) => {
        if (!task.title) throw new Error(`Task ${index} inválida: 'title' é obrigatório`);
        if (task.type && !this.validWorkItemTypes.includes(task.type)) {
          throw new Error(`Task ${index} inválida: 'type' deve ser um dos seguintes: ${this.validWorkItemTypes.join(', ')}`);
        }
        if (task.parentId && !Number.isInteger(task.parentId)) {
          throw new Error(`Task ${index} inválida: 'parentId' deve ser um número inteiro`);
        }
      });

      const results = await Promise.all(tasks.map(async task => {
        const workItemType = task?.type || 'Task';

        try {
          // Validar parentId, se fornecido
          if (task.parentId) {
            await this.validateWorkItem(task.parentId);
          }

          const payload = [
            {
              op: 'add',
              path: '/fields/System.Title',
              value: task.title
            },
            {
              op: 'add',
              path: '/fields/System.IterationPath',
              value: task?.iterationPath || this.sprintPath
            },
            {
              op: 'add',
              path: '/fields/System.AssignedTo',
              value: this.assignedTo
            }
          ];

          // Adicionar descrição, se fornecida
          if (task?.description) {
            payload.push({
              op: 'add',
              path: '/fields/System.Description',
              value: task.description
            });
          }

          // Adicionar tags, se fornecidas
          // if (task?.tags) {
          //   payload.push({
          //     op: 'add',
          //     path: '/fields/System.Tags',
          //     value: Array.isArray(task.tags) ? task.tags.join('; ') : task.tags
          //   });
          // }

          if (task.parentId) {
            payload.push({
              op: 'add',
              path: '/relations/-',
              value: {
                rel: 'System.LinkTypes.Hierarchy-Reverse',
                url: `https://dev.azure.com/${this.organization}/${this.project}/_apis/wit/workItems/${task.parentId}`,
              }
            });
          }

          // Criar a tarefa
          const response = await this.api.post(`/wit/workitems/$${workItemType}?api-version=7.1`, payload, {
            headers: {
              'Authorization': `Basic ${this.auth}`,
              'Content-Type': 'application/json-patch+json',
              'Accept': 'application/json'
            }
          });

          // Adicionar comentários, se fornecidos
          let comments = [];
          if (task.azureComments?.length) {
            comments = await Promise.all(task.azureComments.map(async comment => {
              if (!comment.text || !comment.author) {
                return { text: comment.text || '', status: 'failed', error: 'Autor ou texto inválido' };
              }

              const commentPayload = [
                {
                  op: 'add',
                  path: '/fields/System.History',
                  value: comment.text
                }
              ];

              try {
                await this.api.patch(`/wit/workitems/${response.data.id}?api-version=7.1`, commentPayload);
                return { text: comment.text, author: comment.author, date: comment.date, status: 'success' };
              } catch (error) {
                return {
                  text: comment.text,
                  author: comment.author,
                  date: comment.date,
                  status: 'failed',
                  error: error.response?.data?.message || error.message
                };
              }
            }));
          }

          return {
            id: response.data.id,
            url: response.data.url,
            title: task.title,
            parentId: task.parentId || null,
            comments,
            status: 'success'
          };
        } catch (error) {
          return {
            title: task.title,
            parentId: task.parentId || null,
            status: 'failed',
            error: error.response?.data?.message || error.message
          };
        }
      }));

      return {
        data: results.filter(r => r.status === 'success'),
        error: results.filter(r => r.status === 'failed').length ? results.filter(r => r.status === 'failed') : null
      };
    } catch (error) {
      return { data: [], error: error.response?.data?.message || error.message };
    }
  }
}

