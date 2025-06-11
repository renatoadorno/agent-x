import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";

export class LambdaService {
  private client: LambdaClient;
  private command: ListFunctionsCommand;

  constructor() {
    this.client = new LambdaClient({ region: 'us-east-1' });
    this.command = new ListFunctionsCommand();
  }

  getFunctionDeclarations(): any[] {
    return [
      {
        name: 'lambdaFunctonsList',
        description: 'Lista das funções lambdas da minha aws, retornando detalhes de varias funções',
      },
    ];
  }

  getFunctionMap(): Record<string, () => Promise<any>> {
    return {
      lambdaFunctonsList: this.lambdaFunctonsList.bind(this),
    };
  }

  async lambdaFunctonsList(): Promise<any[]> {
    const { Functions } = await this.client.send(this.command);
    const orderFuncs = Functions?.sort((a: any, b: any) => {
      const nomeA = a?.FunctionName || "";
      const nomeB = b?.FunctionName || "";
      return nomeA.localeCompare(nomeB);
    });
    const funcList = orderFuncs?.map((obj: any) => ({
      name: obj.FunctionName,
      description: obj?.Description,
      environment: obj.Environment?.Variables,
    })) || [];
    const choices = funcList.map((obj: any) => ({
      name: obj.name,
      description: obj.description
    }));
    return choices;
  }
}