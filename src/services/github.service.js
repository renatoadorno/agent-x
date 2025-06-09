import axios from 'axios';
import logger from '../utils/logger';
import { SchemaType } from '@google/generative-ai';
import { settings } from '../config/env';

export class GitHubService {
  constructor() {
    this.pat = settings.GITHUB_PAT; // GitHub Personal Access Token from environment
    this.api = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${this.pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    });
  }

  getFunctionDeclarations() {
    return [
      {
        name: 'list_user_repositories',
        description: 'Lists all repositories owned by the authenticated GitHub user.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            visibility: {
              type: SchemaType.STRING,
              description: 'Filter repositories by visibility (all, public, private)',
              enum: ['all', 'public', 'private'],
              nullable: true,
            },
          },
        },
      },
      {
        name: 'list_org_repositories',
        description: 'Lists all repositories for a specified GitHub organization.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            org: {
              type: SchemaType.STRING,
              description: 'Name of the GitHub organization',
            },
          },
          required: ['org'],
        },
      },
    ];
  }

  getFunctionMap() {
    return {
      list_user_repositories: this.listUserRepositories.bind(this),
      list_org_repositories: this.listOrgRepositories.bind(this),
    };
  }

  async listUserRepositories(visibility) {
    try {
      logger.info(`[API] Listing user repositories${visibility ? ` with visibility: ${visibility}` : ''}`);

      const params = visibility ? { visibility } : {};
      const response = await this.api.get('/user/repos', { params });

      const repositories = response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        description: repo.description || '',
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      }));

      if (repositories.length === 0) {
        return `**No repositories found** for the authenticated user${visibility ? ` with visibility ${visibility}` : ''}.`;
      }

      return `**User repositories${visibility ? ` (${visibility})` : ''}**:\n\`\`\`json\n${JSON.stringify(repositories, null, 2)}\n\`\`\``;
    } catch (error) {
      logger.error(`Error listing user repositories: ${error.message}`);
      return `**Error listing user repositories**: ${error.response?.data?.message || error.message}`;
    }
  }

  async listOrgRepositories(org) {
    try {
      logger.info(`[API] Listing repositories for organization: ${org}`);

      const response = await this.api.get(`/orgs/${org}/repos`);

      const repositories = response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        description: repo.description || '',
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      }));

      if (repositories.length === 0) {
        return `**No repositories found** for organization ${org}.`;
      }

      return `**Repositories for organization ${org}**:\n\`\`\`json\n${JSON.stringify(repositories, null, 2)}\n\`\`\``;
    } catch (error) {
      logger.error(`Error listing organization repositories: ${error.message}`);
      return `**Error listing organization repositories**: ${error.response?.data?.message || error.message}`;
    }
  }
}