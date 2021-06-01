const request = require('request');
const config = require('../../config_example.json')

/**
 * 处理第三方登录 返回数据
 * @param {string} token
 * @returns promise 
 */
const fetchLogin = async (token) => {
  const URL = config.thirdAuth;

  const promise = new Promise((resolve, reject) => {
    request({
      uri: encodeURI(URL),
      family: 4,
      body: undefined,
      method: 'GET',
      headers: {
        'cookie': `token'_key=${token}`
      }
    }, async (error, _, body) => {
      if (error) {
        reject(error)
      } else {
        resolve(body)
      }
    })
  })

  return promise
}

module.exports = {
  fetchLogin
}