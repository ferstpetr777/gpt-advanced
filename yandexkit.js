const axios = require('axios');
require('dotenv').config();

module.exports = async function yandex(text) {
  const params = new URLSearchParams({
    text: text,
    lang: 'ru-RU',
    voice: 'filipp',
    folderId: process.env.YANDEX_FOLDER_ID,
  });

  const response = await axios.post(
    'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
    params,
    {
      headers: {
        Authorization: `Api-Key ${process.env.YANDEX_API}`
      },
      responseType: "arraybuffer"
    }).catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data.toString('utf-8'));
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);

      return null;
  });

  if (!response) return null;

  return response.data;
}