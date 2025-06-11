// nesse codigo termine a funcao webSearch, para o Gemini fazer pesquisas na web
// lenbrando que o gemini ja possui esse recurso de pesquisa
// me responda em portugues
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import logger from '../utils/logger';

// Tipos mínimos para config e resultado
interface GeminiConfig {
  GOOGLE_API_KEY: string;
  GEMINI_MODEL: string;
  RULES: string;
}

interface FunctionCallResult {
  name: string;
  parameters: any;
  result: any;
}

interface AgentResult {
  text: string;
  function_calls: FunctionCallResult[];
}

export class GeminiClient {
  private registry: any;
  private genAI: any;
  private model: any;
  private chat: any;

  constructor(config: GeminiConfig, registry: any) {
    this.registry = registry;
    this.genAI = new GoogleGenerativeAI(config.GOOGLE_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      tools: registry.getTools(),
      systemInstruction: config.RULES,
    });
    this.chat = this.model.startChat({ tools: registry.getTools() });
  }

  async processCommand(command: string): Promise<AgentResult> {
    logger.info(command)
    try {
      let result: AgentResult = { text: '', function_calls: [] };
      let response: any = await this.chat.sendMessage(command);

      logger.info(response)

      // Continue processing while response contains function calls
      while (response.response.candidates[0].content.parts.some((part: any) => part.functionCall)) {
        const parts = response.response.candidates[0].content.parts;

        for (const part of parts) {
          if (part.functionCall) {
            const functionCall = part.functionCall;
            const functionName = functionCall.name;
            const parameters = functionCall.args;

            logger.info({ functionName, parameters })

            const func = this.registry.getFunctionMap()[functionName];
            if (func) {
              const funcResult = await func(...Object.values(parameters));
              result.function_calls.push({
                name: functionName,
                parameters,
                result: funcResult,
              });

              // Send function result back to Gemini
              response = await this.chat.sendMessage([
                {
                  functionResponse: {
                    name: functionName,
                    response: { result: funcResult },
                  },
                },
              ]);
            } else {
              return { text: `**Erro**: Função \`${functionName}\` não encontrada.`, function_calls: result.function_calls };
            }
          }
        }
      }

      // After all function calls are resolved, get the final text response
      const finalParts = response.response.candidates[0].content.parts;
      result.text = finalParts[0]?.text || '';

      return result;
    } catch (error: any) {
      logger.error(`Erro ao processar comando: ${error.message}`);
      return { text: `**Erro**: Erro ao processar comando: ${error.message}`, function_calls: [] };
    }
  }

  async webSearch(command: string): Promise<AgentResult> {
    try {
      logger.info(`Realizando pesquisa na web com Embasamento com a Pesquisa Google para o comando: ${command}`);

      // Criar uma nova sessão de chat para a pesquisa, com grounding habilitado
      const chatSession = this.model.startChat({
        tools: [
          {
            googleSearch: {}, // Habilitar Embasamento com a Pesquisa Google
          },
        ],
      });

      // Enviar o comando para a sessão de chat com grounding
      const response: any = await chatSession.sendMessage(command);

      // Verificar se há resposta válida
      const finalParts = response.response.candidates[0].content.parts;
      if (!finalParts[0]?.text) {
        return { text: 'Nenhum resultado de pesquisa encontrado.', function_calls: [] };
      }

      const responseText = finalParts[0].text;

      return { text: responseText, function_calls: [] };
    } catch (error: any) {
      // logger.error(`Erro ao realizar pesquisa na web: ${error.message}`);
      return { text: `**Erro**: Erro ao realizar pesquisa na web: ${error.message}`, function_calls: [] };
    }
  }
}