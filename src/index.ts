import { DrinkBotConfig, readConfig } from '../config'
import log4js from 'log4js'
import { DrinkBot } from './DrinkBot'

export interface RemindItem {
    text: string
    cron: string
}

// 提醒项存储在文件中的样子
export interface Reminds {
  // ChatID
  [p: number]: {
    // 名字对应提醒项
    [p: string]: RemindItem
  }
}

async function main () {
  const logger = log4js.getLogger()
  logger.level = log4js.levels.ALL.levelStr

  // 获取配置文件
  const config = await readConfig(logger)
  // 检查配置文件的正确性
  if (config && !await config.verify(logger)) {
    return
  }

  const bot = new DrinkBot(config as DrinkBotConfig, logger)
  bot.run()
}

main().then()
