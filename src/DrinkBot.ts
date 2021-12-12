import { Logger } from 'log4js'
import { Telegraf } from 'telegraf'
import { DrinkBotConfig } from '../config'
import { NotifyTaskManager } from './NotifyTaskManager'
import { SettingProgress } from './SettingProgress'
import packageJson from '../package.json'
import express from 'express'

// 喝水 Bot 实例
export class DrinkBot {
    bot: Telegraf
    config: DrinkBotConfig
    logger: Logger
    taskManager: NotifyTaskManager
    settingProgressChatIdMap: Map<number, SettingProgress>

    constructor (config: DrinkBotConfig, logger: Logger) {
      this.config = config
      this.logger = logger
      this.bot = new Telegraf(this.config.token, {
        telegram: {
          agent: this.config.httpsProxyAgent
        }
      })
      this.settingProgressChatIdMap = new Map()
      this.taskManager = new NotifyTaskManager(this.bot, this.logger)
      this.taskManager.initOrUpdateTasks(this.config.storeFile)
    }

    // 初始化 bot 相关设置
    initBot: () => void = () => {
      const { bot, settingProgressChatIdMap: progressChatIdMap, logger, taskManager } = this
      const { storeFile, notifyChatId } = this.config

      // 初始化 bot 指令
      bot.command('info', (ctx) => {
        console.log('received command /info')
        ctx.replyWithMarkdown(`我是柠喵的提醒喝水小助手，不止提醒喝水哦。\n目前状态不稳定，可能会出现丢失配置、没有回复的情况。\n[GitHub](https://github.com/LemonNekoGH/neko-time-to-drink-bot)\n版本号 \`${packageJson.version}\``)
      })

      bot.command('help', (ctx) => {
        console.log('received command /help')
        ctx.reply('下面是柠喵要开发的命令：\n/start 开始为你或这个群组设置提醒项（已经可用）\n/import 导入提醒项\n/edit 修改提醒项\n/info 显示相关信息（已经可用）\n/help 显示此信息（已经可用）')
      })

      bot.command('start', (ctx) => {
        console.log('received command /start')
        progressChatIdMap.set(ctx.chat.id, new SettingProgress(ctx.chat.id, storeFile, logger))
        ctx.reply('开始设置，请为你的提醒项起一个名称，或回复“取消”停止设置')
      })

      bot.command('edit', (ctx) => {
        console.log('received command /edit')
        ctx.reply('还不能修改提醒项')
      })

      bot.command('import', (ctx) => {
        console.log('received command /import')
        ctx.reply('还不能导入配置')
      })

      bot.on('text', (ctx) => {
        const { text } = ctx.message
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)

        switch (text) {
          case '取消':
            if (progress) {
              progressChatIdMap.delete(id)
              ctx.reply('已经取消设置过程')
            } else {
              ctx.reply('没有在设置过程中，回复“取消”是无效的')
            }
            break
          case '上一步':
            if (progress) {
              progress.prevStep(ctx)
            } else {
              ctx.reply('没有在设置过程中，回复“上一步”是无效的')
            }
            break
          case '保存':
            if (progress) {
              const success = progress.save()
              if (typeof success === 'boolean' && success) {
                // 保存成功，告诉当前用户
                ctx.reply('成功的保存了你的提醒项')
                progressChatIdMap.delete(ctx.chat.id)
                // 然后更新任务管理器
                taskManager.initOrUpdateTasks(storeFile)
              } else if (typeof success === 'string') {
                // 保存时出错
                // 如果配置了提醒 ID，就发送错误提示
                if (notifyChatId) {
                  bot.telegram.sendMessage(notifyChatId, `为 ChatID [${ctx.chat.id}] 保存提醒项时出错：${success}`)
                }
                // 告诉用户失败了
                ctx.reply('保存提醒项失败，可能是发生了什么错误\n回复“上一步”重新设置提醒周期\n回复“取消”停止设置')
              }
            } else {
              ctx.reply('没有在设置过程中，回复“保存”是无效的')
            }
            break
          default:
            if (progress) {
              // 不是特定的指令，判断是否正在设置过程
              progress.nextStep(text, ctx)
            } else {
              // 不在，复读
              ctx.reply('我是一个没有感情的提醒机器人，没事不要和我说话，说话我也只会回复这么一句。')
            }
            break
        }
      })
    }

    // 启动 bot
    run: () => void = async () => {
      const { webhookUrl: webhookBaseUrl, notifyChatId } = this.config
      const { bot, logger } = this
      if (webhookBaseUrl) {
        // 设置 webhook
        const secretPath = `/telegraf/${bot.secretPathComponent()}`
        await bot.telegram.setWebhook(`${webhookBaseUrl}${secretPath}`)
        // 启动 express
        const app = express()
        app.get('/', (req, resp) => resp.send('柠喵的喝水小助手'))
        app.use(bot.webhookCallback(secretPath))
        app.listen(5500, () => {
          console.log('Express with telegraf webhook is listening at port 5500')
        })
      } else {
        bot.launch().then(() => {
          // 启动成功后，给要提醒的 chatid 发送消息提示
          if (notifyChatId) {
            bot.telegram.sendMessage(notifyChatId, '柠喵的喝水提醒小助手已成功启动')
          }
          logger.info('bot is now running')
        }).catch((e) => {
          console.error(e.message)
        })
      }
    }
}
