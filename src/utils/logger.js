// import chalk from 'chalk';

const logger = {
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