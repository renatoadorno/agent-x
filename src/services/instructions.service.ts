export class InstructionsService {
  getFunctionDeclarations(): any[] {
    return [
      {
        name: 'initWorkflowInstructions',
        description: 'Retorna as instruções de como iniciar o Workflow',
      },
      {
        name: 'newTaskInstructions',
        description: 'Retorna as instruções de como deve ser criada a tarefa',
      },
    ];
  }

  getFunctionMap(): Record<string, () => Promise<string>> {
    return {
      initWorkflowInstructions: this.initWorkflowInstructions.bind(this),
      newTaskInstructions: this.newTaskInstructions.bind(this),
    };
  }

  async initWorkflowInstructions(): Promise<string> {
    return `
O Workflow é um processo feito antes de criar um tarefa no devops, a base da criacoa do workflow vai ser sempre uma descricao, apartir disso crie todas as outras coisas seguindo as regras
Regras para iniciar um Workflow:
- Sempre crie uma nova branch de trabalho
- O nome branch vai ser sempre baseado na descriacao da tarefa entao crie nomes curtos, mas que indique corretamente sobre oque é aquela branch
- Meu usuario no devops vai ser sempre "renato@guicheweb.com.br"
- Crie a tarefa sempre como filha, caso eu não informe o id do pai da tarefa, peça para informar o id antes de prosseguir.
- Caso eu nao informe o nome da tarefa crie um nome resumido baseado na descricao, apesar de resumido crie nomes bem descritivos informando muito bem sobre oque se trata a tarefa
- Sempre melhore a descricao baseada na descricao que informei
- Na descriacao adicione o nome do projeto que geralmente é o diretorio atual de trabalho, e a branch criada como referencia na descricao
    `
  }

  async newTaskInstructions(): Promise<string> {
    return `
Regras para iniciar um Workflow:
- Meu usuario no devops vai ser sempre "renato@guicheweb.com.br"
- Crie a tarefa sempre como filha, caso eu não informe o id do pai da tarefa, peça para informar o id antes de prosseguir.
- Caso eu nao informe o nome da tarefa crie um nome resumido baseado na descricao, apesar de resumido crie nomes bem descritivos informando muito bem sobre oque se trata a tarefa
- Sempre melhore a descricao baseada na descricao que informei
    `
  }
}