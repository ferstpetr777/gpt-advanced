const axios = require('axios');
require('dotenv').config();

module.exports = async function(text) {
  const apiKey = process.env.YANDEX_API;
  const url = 'https://translate.api.cloud.yandex.net/translate/v2/translate';

  try {
    const response = await axios.post(url, {
      folder_id: process.env.YANDEX_FOLDER_ID,
      texts: [text],
      targetLanguageCode: 'en',
    }, {
      headers: {
        Authorization: `Api-Key ${apiKey}`,
      },
    });

    const translatedText = response.data.translations[0].text;
    return translatedText;
  } catch (err) {
    console.error('Error translating text:', err.message);
  }
};