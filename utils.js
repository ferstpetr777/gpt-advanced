const { unlink } = require('fs/promises');

module.exports = async function removeFile(path) {
  try {
    await unlink(path);
  } catch (err) {
    console.log(err.message);
  }
}