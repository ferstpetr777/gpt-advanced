const { YoutubeTranscript } = require('youtube-transcript');
const { openai } = require('./openai');
const LanguageDetect = require('languagedetect');
const { encode } = require('gpt-3-encoder');

const detector = new LanguageDetect();

module.exports = async function summarize(url) {
  try {
    const result = await YoutubeTranscript.fetchTranscript(url);
    const transcript = result.map(item => item.text).join(' ');
    
    if (encode(transcript).length > 40000) {
      return 'Отправьте видео покороче';
    }

    const language = detector.detect(transcript.split(' ').slice(0, 100).join(' '));
    const summary = await openai.youtubeSummarize(transcript, language[0][0]);

    if (!summary) {
      return 'Не удалось обработать видео. Возможно видео слишком длинное';
    }

    return summary.content;
  } catch (err) {
    console.log(err.message)
  }
}