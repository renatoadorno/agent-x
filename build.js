import { $ } from 'bun';

const targets = [
  { platform: 'bun-darwin-arm64', outfile: 'dist/bin' },
  { platform: 'bun-darwin-arm64', outfile: '/Users/renatoadorno/cli/jarvis/bin' },
  // { platform: 'darwin-x64', outfile: 'dist/agent-macos-x64' },
  // { platform: 'linux-x64', outfile: 'dist/agent-linux-x64' },
  // { platform: 'windows-x64', outfile: 'dist/agent-windows-x64.exe' },
];

async function build() {
  console.log('Iniciando processo de build...');

  // Criar diretório de saída
  // await $`mkdir -p dist`;
  await $`rm /Users/renatoadorno/cli/jarvis/bin`;

  for (const { platform, outfile } of targets) {
    console.log(`Construindo binário para ${platform}...`);
    try {
      await $`bun build --compile --target=${platform} ./src/index.js --outfile ${outfile}`;
      console.log(`Binário gerado: ${outfile}`);
    } catch (error) {
      console.error(`Erro ao construir para ${platform}: ${error.message}`);
    }
  }

  console.log('Build concluído!');
}

build().catch(err => {
  console.error(`Erro no processo de build: ${err.message}`);
  process.exit(1);
});