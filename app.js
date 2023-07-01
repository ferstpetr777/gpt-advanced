const { Telegraf } = require('telegraf');
const PostgresSession = require('telegraf-postgres-session');
const { message } = require('telegraf/filters');
const { code } = require('telegraf/format');
const convert = require('./convert');
const { openai } = require('./openai');
const axios = require('axios');
const fs = require('fs');
const removeFile = require('./utils');
const yandexkit = require('./yandexkit');
const translate = require('./translate');
const summarize = require('./summarize');
const { authenticate, updateContext } = require('./db');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}$/;
const startTime = new Date(Date.now() - process.uptime() * 1000);
console.log(`Бот запущен: ${startTime}`);

process.on('uncaughtException', (err) => {
  if (err.response && err.response.error_code === 403 && err.response.description === 'Forbidden: bot was blocked by the user') {
    console.log('Бот был заблокирован пользователем.');
    return;
  }
  console.log(err.message);
});

bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    console.log('Telegram ID пользователя не найден.');
    return;
  }
  if (!await authenticate(telegramId)) {
    ctx.reply('Вы не авторизованы.');
    return
  }
  return next()
});

bot.use((new PostgresSession({
	connectionString: process.env.DATABASE_URL,
		ssl: false
})).middleware());

bot.start(ctx => {
  ctx.session.chatMode = ctx.session.chatMode ? ctx.session.chatMode : 'conversation';
  ctx.session.messageMode = ctx.session.messageMode ? ctx.session.messageMode : 'text';
  ctx.reply('Выберите режим:', {
    reply_markup: {
      inline_keyboard: [       
        [ { text: '💬Общение', callback_data: 'conversation' } ],
        [ { text: '🖼️Генерация изображений', callback_data: 'image' } ],
        [ { text: '📺YouTube Summary', callback_data: 'summary' } ],
      ]
    }
  });
});

bot.command('menu', ctx => {
  ctx.reply('Выберите режим:', {
    reply_markup: {
      inline_keyboard: [
        [ { text: '💬Общение', callback_data: 'conversation' } ],
        [ { text: '🖼️Генерация изображений', callback_data: 'image' } ],
        [ { text: '📺YouTube Summary', callback_data: 'summary' } ],
      ]
    }
  });
});

bot.command('conversation', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.reply('В каком режиме вы хотите получать сообщения от бота:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📜Текст', callback_data: 'text_mode' },
          { text: '🔊Голос', callback_data: 'voice_mode' }
        ]
      ]
    }
  });
});

bot.command('image', ctx => {
  ctx.session.chatMode = 'image_generation';
  ctx.reply('Режим изменен. Введите текст для генерации изображений');
});

bot.command('summary', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.session.messageMode = 'text';
  ctx.reply('📺YouTube Summary позволяет узнать краткое содержание видео, чтобы сэкономить время. Работает по умолчанию вместе с чатом в текстовом режиме.\n\nПросто пришлите ссылку на YouTube видео 👇');
})

bot.action('conversation', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.reply('В каком режиме вы хотите получать сообщения от бота:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📜Текст', callback_data: 'text_mode' },
          { text: '🔊Голос', callback_data: 'voice_mode' }
        ]
      ]
    }
  });
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }
});

bot.action('image', ctx => {
  ctx.session.chatMode = 'image_generation';
  ctx.reply('Режим изменен. Введите текст для генерации изображений');
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }
});

bot.action('summary', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.session.messageMode = 'text';
  ctx.reply('📺YouTube Summary позволяет узнать краткое содержание видео, чтобы сэкономить время. Работает по умолчанию вместе с чатом в текстовом режиме.\n\nПросто пришлите ссылку на YouTube видео 👇');
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }
})

bot.action('text_mode', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.session.messageMode = 'text';
  ctx.reply('Режим сообщений изменен на текстовый');
});

bot.action('voice_mode', ctx => {
  ctx.session.chatMode = 'conversation';
  ctx.session.messageMode = 'voice';
  ctx.reply('Режим сообщений изменен на голосовой');
});

bot.on(message('text'), async ctx => {
  const messageTime = new Date(ctx.message.date * 1000);
  if (messageTime < startTime) {
    ctx.reply('Ошибка. Отправьте запрос еще раз');
    return;
  }

  ctx.session.chatMode = ctx.session.chatMode ? ctx.session.chatMode : 'conversation';
  ctx.session.messageMode = ctx.session.messageMode ? ctx.session.messageMode : 'text';
  const telegramId = ctx.message.from.id;

  try {
    if (ctx.session.chatMode === 'conversation') {
      if (youtubeUrlRegex.test(ctx.message.text)) {
        const processingMessage = await ctx.reply(code('Обрабатываем ваше видео...'));
        const summary = await summarize(ctx.message.text);
        ctx.deleteMessage(processingMessage.message_id);
        ctx.reply(summary);
        return;
      }

      const processingMessage = await ctx.reply(code('Бот обрабатывает ваш запрос...'));
      const userMessage = { role: openai.roles.USER, content: ctx.message.text };
      const updMsgs = await updateContext(telegramId, userMessage);

      const response = await openai.chat(updMsgs);

      const assistantMessage = { role: openai.roles.ASSISTANT, content: response.content };
      await updateContext(telegramId, assistantMessage);

      if (ctx.session.messageMode === 'voice') {
        const voicefile = await yandexkit(response.content);
        if (!voicefile) {
          ctx.reply('Не удалось синтезировать речь');
          return;
        }

        await ctx.replyWithVoice({ source: voicefile });
      } else {
        await ctx.reply(response.content);
      }
      ctx.deleteMessage(processingMessage.message_id);
    } else if (ctx.session.chatMode === 'image_generation') {
      console.log(ctx.message.text);
      if (!ctx.message.text) {
        ctx.reply('Введите текст');
        return;
      }
      const processingMessage = await ctx.reply(code('Генерируем изображение по вашему запросу, пожалуйста подождите...'));
      const text = ctx.message.text.trim();

      const translatedText = await translate(text);

      const image = await openai.generateImage(translatedText);

      if (!image) {
        ctx.reply('Не удалось сгенерировать фото');
        return;
      }

      const response = await axios.get(image, {
        responseType: 'arraybuffer',
      });

      const filename = 'image.png';
      fs.writeFileSync(filename, response.data);

      await ctx.replyWithPhoto({ source: filename });

      ctx.deleteMessage(processingMessage.message_id);
      removeFile(filename);
    }
    } catch (err) {
      console.log(err.message);
    }
  }
);

bot.on(message('voice'), async ctx => {
  const messageTime = new Date(ctx.message.date * 1000);
  if (messageTime < startTime) {
    ctx.reply('Ошибка. Отправьте запрос еще раз');
    return;
  }

  ctx.session.chatMode = ctx.session.chatMode ? ctx.session.chatMode : 'conversation';
  ctx.session.messageMode = ctx.session.messageMode ? ctx.session.messageMode : 'text';
  const telegramId = ctx.message.from.id;

  if (ctx.session.chatMode === 'image_generation') {
    ctx.reply('Введите текст');
    return;
  }
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);

    const mp3Path = await convert(link.href, String(telegramId));

    const text = await openai.transcription(mp3Path);
    const processingMessage = await ctx.reply(code(`Ваш запрос: ${text}`));

    removeFile(mp3Path);

    const userMessage = { role: openai.roles.USER, content: text };
    const updMsgs = await updateContext(telegramId, userMessage);

    const response = await openai.chat(updMsgs);

    const assistantMessage = { role: openai.roles.ASSISTANT, content: response.content };
    await updateContext(telegramId, assistantMessage);

    if (ctx.session.messageMode === 'voice') {
      const voicefile = await yandexkit(response.content);
      if (!voicefile) {
        ctx.reply('Не удалось синтезировать речь');
        return;
      }

      await ctx.replyWithVoice({ source: voicefile });
    } else {
      await ctx.reply(response.content);
    }
    ctx.deleteMessage(processingMessage.message_id);
  } catch (err) {
    console.log(err.message);
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));