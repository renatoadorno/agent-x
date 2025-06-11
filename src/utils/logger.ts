// import chalk from 'chalk';

interface Logger {
  error: (message: string) => void;
  warn: (message: string) => void;
  help: (message: string) => void;
  data: (message: string) => void;
  info: (message: any) => void;
  debug: (message: string) => void;
  alert: (message: string) => void;
  warning: (message: string) => void;
}

const logger: Logger = {
  error: (message) => {
    console.error(message)
  },
  warn: (message) => {
    console.warn(message)
  },
  help: (message) => {
    console.info(message)
  },
  data: (message) => {
    console.info(message)
  },
  info: (message) => {
    console.info(message)
  },
  debug: (message) => {
    console.info(message)
  },
  alert: (message) => {
    console.warn(message)
  },
  warning: (message) => {
    console.warn(message)
  },
}

export default logger;