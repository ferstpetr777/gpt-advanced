const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
require('dotenv').config();

class OpenAI {
  roles = {
    ASSISTANT: 'assistant',
    USER: 'user',
    SYSTEM: 'system',
  }

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  async transcription(filepath) {
    try {
      const response = await this.openai.createTranscription(
        fs.createReadStream(filepath),
        'whisper-1',
      )
      return response.data.text;
    } catch (err) {
      console.error('Произошла ошибка при запросе к API OpenAI:', err.message);
    }
  }

  async chat(messages) {
    try {
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
      });

      return response.data.choices[0].message
    } catch (err) {
      if (err.response && err.response.status === 503){
        console.log('Произошла ошибка. Пожалуйста, повторите попытку еще раз');
        return {
          content: 'Произошла ошибка. Пожалуйста, повторите попытку еще раз',
        }
      }
      if (err.response && err.response.status === 429) {
        console.log('Превышен лимит запросов в минуту. Повторите попытку позже');
      } else {
        console.error('Произошла ошибка при запросе к API OpenAI:', err.message);
        return {
          content: 'Произошла ошибка при запросе к API OpenAI',
        }
      }
    }
  }

  async generateImage(text) {
    try {
      const response = await this.openai.createImage({
        prompt: text,
        size: '512x512',
        n: 1,
      });

      return response.data.data[0].url;
    } catch (err) {
      console.error('Произошла ошибка при запросе к API OpenAI:', err.message);
    }
  }

  async youtubeSummarize(transcription, language) {
    const prompt = 'Can you provide a comprehensive summary of the given text? The summary should cover all the key points and main ideas presented in the original text, while also condensing the information into a concise and easy-to-understand format. Please ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information. The text: '
    try {
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo-16k',
        messages: [
          { role: 'system', content: `Please provide a summary in ${language} language` },
          { role: 'user', content: prompt + transcription}
        ]
      });
      return response.data.choices[0].message;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.log('Превышен лимит запросов в минуту. Повторите попытку позже');
      } else {
        console.error('Произошла ошибка при запросе к API OpenAI:', err.message);
      }
    }
  }
}

module.exports.openai = new OpenAI();