import { homedir } from 'os';
import { join } from 'path';

const makePath = (fileName: string): string => {
  const cliDir = `${homedir()}/cli/jarvis`;
  return join(cliDir, fileName);
  // return fileName;
}

export default makePath;