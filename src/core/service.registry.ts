// Tipos mínimos para ServiceRegistry
interface Service {
  getFunctionMap(): Record<string, (...args: any[]) => any>;
  getFunctionDeclarations(): any[];
}

export class ServiceRegistry {
  private services: Service[];
  private functionMap: Map<string, (...args: any[]) => any>;

  constructor() {
    this.services = [];
    this.functionMap = new Map();
  }

  registerService(service: Service): void {
    this.services.push(service);
    const serviceFunctions = service.getFunctionMap();
    for (const [name, func] of Object.entries(serviceFunctions)) {
      this.functionMap.set(name, func);
    }
  }

  getTools(): any[] {
    const functionDeclarations: any[] = [];
    for (const service of this.services) {
      functionDeclarations.push(...service.getFunctionDeclarations());
    }
    return [{ functionDeclarations }];
  }

  getOpenAiTools(): any[] {
    const functionDeclarations: any[] = [];
    for (const service of this.services) {
      functionDeclarations.push(...service.getFunctionDeclarations());
    }

    return functionDeclarations.map((tool: any) => {
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool?.parameters || {},
        },
      }
    });
  }

  getFunctionMap(): Record<string, (...args: any[]) => any> {
    return Object.fromEntries(this.functionMap);
  }
}