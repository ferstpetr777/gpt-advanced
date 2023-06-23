const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const installer = require('@ffmpeg-installer/ffmpeg');
const axios = require('axios');
const removeFile = require('./utils');

module.exports = async function convertOggToMp3(url, outputName) {
  try {
    ffmpeg.setFfmpegPath(installer.path);

    const oggPath = path.resolve(__dirname, 'voices', `${Date.now()}.ogg`);
    const mp3Path = path.resolve(__dirname, 'voices', `${outputName}.mp3`);
  
    const response = await axios({
      url,
      responseType: 'stream',
    });
  
    const writeStream = fs.createWriteStream(oggPath);
    response.data.pipe(writeStream);
  
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        ffmpeg(oggPath)
          .inputOptions('-t 30')
          .output(mp3Path)
          .on('end', async () => {
            removeFile(oggPath);
            resolve(mp3Path);
          })
          .on('error', err => reject(err.message))
          .run();
      });
      writeStream.on('error', err => reject(err.message));
    });
  } catch (err) {
    console.log(`Error while converting ${err.message}`);
    throw err
  }
};