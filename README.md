## YApi 接口管理平台

原 YApi 的文档连接：[YApi文档](https://github.com/YMFE/yapi)

> 以下是魔改部分，作用是实现将 YApi 嵌入其他的页面来实现免登录

### 将 YApi 嵌入其他页面实现免登录

想法是利用原登录的用户信息，直接利用用户信息注册进入数据库内，并返回信息，实现免登录。

我们首先是写一个用于认证的方法 `thirdAuth.js`

```js
const request = require("request");
/**
 * 处理第三方登录 返回数据
 * @param {string} token 第三方 token
 * @returns promise
 */
const fetchLogin = async (token) => {
    const URL = "your auth token server";

    const promise = new Promise((resolve, reject) => {
        request(
            {
                url: URL,
                headers: {
                    cookie: `token_key=${token}`,
                },
            },
            async (error, _, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            }
        );
    });

    return promise;
};

module.exports = {
    fetchLogin,
};
```


然后是修改 `server/controllers/base.js` 中的认证逻辑。

```js
async getLoginStatus(ctx) {
    let body;
    if ((await this.checkLogin(ctx)) === true) {
        // 当请求携带有 _yapi_token 和 _yapi_uid，返回该用户的信息
    } else {
        // 当请求未携带 _yapi_token 和 _yapi_uid ,通过获取到的 cookie 取请求认证 api
        // 此处需要反向代理域名和需要嵌入的域名一致才能获取到 cookie
        let token = ctx.cookies.get("token_key");

        if (token) {
            // 认证 api 需要返回该用户的信息 包含但不限于 username 字段，有 email 那自然最好了
            const data = await fetchLogin(token);

            if (data) {
                const res = JSON.parse(data);
                const checkUserName = res.data.username;
                const checkEmail = res.data.username || "";
                const userInst = yapi.getInst(userModel);

                // 检测该用户是否在数据库内
                const checkRepeat = await userInst.checkRepeat(checkEmail);

                if (checkRepeat > 0) {
                    // 该用户在数据库内，直接获取该用户信息返回
                    let dbUser = await userInst.findByEmail(checkEmail);
                    let _id = dbUser.get("_id");
                    let username = dbUser.get("username");
                    let email = dbUser.get("email");
                    let passsalt = dbUser.get("passsalt");

                    this.$uid = _id;
                    this.$auth = true;
                    this.$user = dbUser;

                    let result = yapi.commons.fieldSelect(this.$user, ["_id", "username", "email", "up_time", "add_time", "role", "type", "study"]);
                    this.setLoginCookie(_id, passsalt);
                    await this.handlePrivateGroup(_id, username, email);
                    body = yapi.commons.resReturn(result);
                } else {
                    // 该用户不在数据库内，将该用户注册为新用户，并返回该用户
                    let user, data, passsalt;

                    const PASSWORD = "password"; // your password

                    passsalt = yapi.commons.randStr();
                    data = {
                        username: checkEmail,
                        password: yapi.commons.generatePassword(PASSWORD, passsalt),
                        email: checkEmail,
                        passsalt,
                        role: "member",
                        add_time: yapi.commons.time(),
                        up_time: yapi.commons.time(),
                        type: "third",
                        study: true,
                    };

                    try {
                        user = await userInst.save(data);

                        this.$user = user;

                        let result = yapi.commons.fieldSelect(this.$user, ["_id", "username", "email", "up_time", "add_time", "role", "type", "study"]);

                        this.setLoginCookie(user._id, user.passsalt, { sameSite: "none" });
                        await this.handlePrivateGroup(user._id, user.username, user.email);

                        body = yapi.commons.resReturn(result);
                    } catch (e) {
                        console.error("base_checkRepeat:", e);
                        throw new Error(`base_checkRepeat: ${e}`);
                    }
                }
            } else {
                body = yapi.commons.resReturn(null, 40011, "请登录...");
            }
        } else {
            body = yapi.commons.resReturn(null, 40011, "请登录...");
        }

        ctx.body = body;
    }
}

```

如果是本地那么以上的代码就已经可以了，但要上服务器就会出现一个问题，nodejs 无法访问到需要进行获取用户信息的服务器。

> Node.js getaddrinfo ENOTFOND

此时需要在服务器 `hosts` 添加目标服务器的 ip 地址。

如果 `thirdAuth.js` 请求了的接口为https，可以在 `app.js`内全局禁用ssl证书

```js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

