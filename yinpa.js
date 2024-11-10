
import { createRequire } from 'module';
import { chromium } from '@playwright/test';
//版本号

// 使用 createRequire 来导入 JSON 文件

const require = createRequire(import.meta.url);
const config = require('./config.json');

// 设置本地代理
// const proxyUrl = config.proxyUrl;
// const proxyAgent = config.proxy ? new HttpsProxyAgent(proxyUrl) : null;
const EventEmitter = require('events');
const URL = require('url').URL;

let browser = null;

let STcontext=null;
let DIScontext=null;
let STpage = null;
let DISpage = null;
// Worker 的基础 URL


async function initializeBrowser() {


    try {

        let viewportSize = { width: 800, height: 600 }; // 可以根据需要调整这些值
        browser = await chromium.launch({ headless: config.wutou });

        // 创建上下文
        STcontext = await browser.newContext(
            {viewport: viewportSize
        }
            );
        DIScontext = await browser.newContext({viewport: viewportSize
        });

        // 创建页面
        STpage = await STcontext.newPage();
        DISpage = await DIScontext.newPage();
        console.log("启动浏览器完成");
        // 添加全局错误处理
        process.on('uncaughtException', (error) => {
            console.error('未捕获的异常:', error);
            process.exit(1);
        });
        
        process.on('unhandledRejection', (error) => {
            console.error('未处理的 Promise 拒绝:', error);
            process.exit(1);
        });


                // 设置 cookie

                // const cookieString = await loadCookiesFromConfig();
                // if (cookieString) {
                //   // 设置 cookie
                //   await DISpage.setExtraHTTPHeaders({
                //     'Cookie': cookieString
                //   });
                // }

                try {
                    await DISpage.goto(config.DISUrl, { waitUntil: 'networkidle0' });
                    console.log('Successfully opened dis');
                    
                   } catch (error) {
            
                    console.log("error",error)
                    
                   }


        const cookies = await DIScontext.cookies();


        console.log("cookies",cookies);
       try {

        
        await STpage.goto(config.STUrl, { waitUntil: 'networkidle0' });
        console.log('Successfully opened ST');
        
       } catch (error) {

        console.log("error",error)
        
       }

        console.log('欢迎使用反代，成功启动！By从前跟你一样');

    } catch (error) {
        console.error('An error occurred during browser initialization:如果是浏览器验证则忽略，欢迎使用反代，成功启动！By从前跟你一样', error);
    }
}
async function restartBrowser() {
    console.log('Restarting browser...');
    isRestarting = true;
    if (browser) {
        await browser.close();
    }
    await initializeBrowser();
    isRestarting = false;
    console.log('Browser restarted successfully');
}
// 初始化浏览器
await initializeBrowser();

// 在服务器关闭时关闭浏览器
process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit();
});




  await STpage.waitForSelector('#send_textarea', { timeout: 0 });
  console.log("开始监听ST");

  await STset(STpage);

  await DISpage.waitForSelector('.tutorialContainer_c96c45', { timeout: 0 });
  console.log("开始监听DIS");

  await DISset(DISpage);


// 在 Node.js 中设置回调

//设置页面事件
await STpage.evaluate(() => {
    window.addEventListener('valueChanged', (event) => {
        window.valueChangedCallback(event.detail);
    });
});


await STpage.exposeFunction('setGlobalVariable', (value) => {
    global.sharedVariable = value;
});

await STpage.evaluate(() => {
    window.addEventListener('del',async (event) => {
     
        const deleteButton = Array.from(document.querySelectorAll('.qr--button-label'))
        .find(el => el.textContent.trim() === '删除聊天1');
              
         deleteButton.click();   
         
         await new Promise(resolve => setTimeout(resolve, 1000));

         if(document.querySelector(".mes.last_mes").getAttribute("is_user")=="true"){
            deleteButton.click();
         }
    });
});




await DISpage.evaluate(() => {
    window.addEventListener('DISmessage', (event) => {
        window.DISmessageCallback(event.detail);
    });
});
await STpage.evaluate(() => {
    window.addEventListener('STmessage', (event) => {
        window.STmessageCallback(event.detail);
    });
});

//监听回调
await STpage.exposeFunction('valueChangedCallback', (Value) => {
    STpage.emit('valueChanged', Value);
});


await STpage.exposeFunction('STmessageCallback', (Value) => {
    STpage.emit('STmessage', Value);
});


await DISpage.exposeFunction('DISmessageCallback', (Value) => {
    DISpage.emit('DISmessage', Value);
});

let SendTxt="";
let GetTxt="";
let stop=false;
//处理回调
let timeoutId="";
let sendMessage="";

async function setTimeoutFunction(timeout, callback) {
    timeoutId = setTimeout(() => {
        console.log("计时器触发，执行超时函数");
        callback();
    }, timeout);
}

async function cancelTimeout() {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId="";
        console.log("计时器已取消");
    }
}

DISpage.on('DISmessage', async (Value) => {
    
        console.log("newValue",Value);

        if(timeoutId!=""){
            console.log("还有时间");
            return;
        }

        Value=JSON.parse(Value)
        SendTxt=Value["lastMesg"];
        console.log("SendTxt",SendTxt);
        if(SendTxt.includes("stop:")){
            
            stop=true;
            return;
        }

        if(Value["username"]==config.yourname){
            console.log("用户名相等");
            return;
        }
        if(SendTxt.includes("del:")){
            console.log("删除聊天2");
            const deleteButton = await STpage.locator('.qr--button-label', { hasText: '删除聊天2' });
            await deleteButton.click();
            let tixing="已删除一条对话记录";
            await   inputMessageInDiscord(DISpage,tixing);
        }
        if(SendTxt.includes("new:")){
            console.log("新聊天");
            const deleteButton = await STpage.locator('.qr--button-label', { hasText: '新聊天' });
            await deleteButton.click();
            let tixing="已新建聊天";
            await   inputMessageInDiscord(DISpage,tixing);
        }

        if(!SendTxt.includes("rp:")){

            return;
        }
        SendTxt=SendTxt.replace("rp:","");

        SendTxt="{"+Value["username"]+"}:"+SendTxt

        let tixing="已收到消息请稍等大概一分钟";

        if(SendTxt.includes("掷骰子")){
            // 生成1到6的随机数
            let roll = Math.floor(Math.random() * 6) + 1;

            // 初始化结果变量
            let result;
            let detail;

            // 判断结果
            if (roll === 1) {
                result = "失败";
                detail = "大失败";
            } else if (roll >= 2 && roll <= 3) {
                result = "失败";
                detail = "普通失败";
            } else if (roll === 4) {
                result = "成功";
                detail = "普通成功";
            } else if (roll === 5) {
                result = "成功";
                detail = "良好成功";
            } else if (roll === 6) {
                result = "成功";
                detail = "大成功";
            }
            SendTxt=SendTxt.replace("掷骰子",`，这个轮次玩家的骰子是:${roll},结果是${detail}。`)
            tixing=tixing+`这个轮次玩家的骰子是:${roll},结果是${detail}`;
        }

        

        const send_textarea = STpage.locator('#send_textarea[name="text"]');
        // 使用 fill() 方法输入内容
        await send_textarea.fill(SendTxt);

        console.log('内容已成功输入到 textarea');
    
        // 验证输入的内容
        const inputtedText = await send_textarea.inputValue();
        console.log('textarea 中的内容:', inputtedText);

        const element = STpage.locator('#send_but');

        // 检查元素是否存在
        const isVisible = await element.isVisible();
        console.log('元素是否可见:', isVisible);
        if(isVisible){
     
         await element.click();
     
        }else{
            return;

        }

       
        await   inputMessageInDiscord(DISpage,tixing);
        async function inputMessageInDiscord(page, message) {
           try {
             // 等待输入框出现
             const selector = 'div[role="textbox"][aria-label*="发送一则消息"]';
             await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
         
             // 聚焦到输入框
             await page.click(selector);
         
             // 清除现有内容（如果有的话）
             await page.keyboard.press('Control+A');
             await page.keyboard.press('Backspace');
         
             // 将消息分割成行
             const lines = message.split('\n');
         
             // 输入每一行，使用Shift+Enter来创建换行
             for (let i = 0; i < lines.length; i++) {
               await page.keyboard.type(lines[i], {delay: 10});
               
               // 如果不是最后一行，则输入Shift+Enter
               if (i < lines.length - 1) {
                 await page.keyboard.down('Shift');
                 await page.keyboard.press('Enter');
                 await page.keyboard.up('Shift');
               }
             }
         
             console.log('消息输入成功');
             await page.keyboard.press('Enter');
         
           } catch (error) {
             console.error('输入消息时出错:', error);
           }
         }
        setTimeoutFunction(60000, async () => {
            await STpage.evaluate(() => {
                // 创建并触发自定义事件
                const event = new CustomEvent('del');
                window.dispatchEvent(event);

            });
            console.log("操作超时！执行错误处理逻辑");
            timeoutId="";
            let txt="这边网络超时了";
            inputMessageInDiscord(DISpage,txt);
            async function inputMessageInDiscord(page, message) {
               try {
                 // 等待输入框出现
                 const selector = 'div[role="textbox"][aria-label*="发送一则消息"]';
                 await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
             
                 // 聚焦到输入框
                 await page.click(selector);
             
                 // 清除现有内容（如果有的话）
                 await page.keyboard.press('Control+A');
                 await page.keyboard.press('Backspace');
             
                 // 将消息分割成行
                 const lines = message.split('\n');
             
                 // 输入每一行，使用Shift+Enter来创建换行
                 for (let i = 0; i < lines.length; i++) {
                   await page.keyboard.type(lines[i], {delay: 10});
                   
                   // 如果不是最后一行，则输入Shift+Enter
                   if (i < lines.length - 1) {
                     await page.keyboard.down('Shift');
                     await page.keyboard.press('Enter');
                     await page.keyboard.up('Shift');
                   }
                 }
             
                 console.log('消息输入成功');
                 await page.keyboard.press('Enter');
             
               } catch (error) {
                 console.error('输入消息时出错:', error);
               }
             }


            // 这里可以添加错误处理逻辑
        });


});

// 创建一个消息队列
const messageQueue = [];
let isProcessing = false;

// 设置发送消息的间隔时间（毫秒）
const MESSAGE_INTERVAL = 2000; // 每5秒发送一条消息，可以根据需要调整

STpage.on('STmessage', async (Value) => {
    console.log("newValue", Value);
    cancelTimeout();
    sendMessage="true";
    const GetTxt = Value.text;
    
    // 将新消息添加到队列
    messageQueue.push(GetTxt);
    
    // 如果没有正在处理的消息，开始处理队列
    if (!isProcessing) {
        processQueue();
    }
});

async function processQueue() {
    if (messageQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const message = messageQueue.shift(); // 获取队列中的第一条消息

    try {
        await inputMessageInDiscord(DISpage, message);
        console.log('消息发送成功');
    } catch (error) {
        console.error('发送消息时出错:', error);
        // 可以选择将失败的消息重新加入队列或进行其他错误处理
    }

    // 设置定时器，延迟处理下一条消息
    setTimeout(processQueue, MESSAGE_INTERVAL);
}

async function inputMessageInDiscord(page, message) {
    try {
        const selector = 'div[role="textbox"][aria-label*="发送一则消息"]';
        await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });

        await page.click(selector);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');

        const lines = message.split('\n');

        for (let i = 0; i < lines.length; i++) {
            await page.keyboard.type(lines[i], {delay: 1});
            if (i < lines.length - 1) {
                await page.keyboard.down('Shift');
                await page.keyboard.press('Enter');
                await page.keyboard.up('Shift');
            }
        }

        await page.keyboard.press('Enter');
        
    } catch (error) {
        console.error('输入消息时出错:', error);
        throw error; // 将错误抛出，以便在processQueue中处理
    }
}



//脚本开关
STpage.on('valueChanged',async (newValue) => {
    
    console.log("newValue",newValue.scriptEnabled);
    
        await  STpage.evaluate(([isscriptEnabled,pass]) => {

                                       class IdManager {
                                        constructor() {
                                            this.usedIds = new Set();
                                        }

                                        // 检查 ID 是否已被使用
                                        isIdUsed(id) {
                                            return this.usedIds.has(id);
                                        }

                                        // 添加新的 ID
                                        addId(id) {
                                            if (this.isIdUsed(id)) {
                                            return false; // ID 已存在，添加失败
                                            }
                                            this.usedIds.add(id);
                                            return true; // ID 添加成功
                                        }

                                        // 移除 ID
                                        removeId(id) {
                                            return this.usedIds.delete(id);
                                        }

                                        // 获取所有已使用的 ID
                                        getAllUsedIds() {
                                            return Array.from(this.usedIds);
                                        }

                                        // 清空所有 ID
                                        clearAllIds() {
                                            this.usedIds.clear();
                                        }
                                        } 
                                        const idManager = new IdManager();


                                if(isscriptEnabled&&!window.chatObserver){

                                    async function checkAndSendText() {
                                        console.log('开始循环');
                                        let previousParagraphCount = 0;
                                        let lastSentText = '';
                                        let go_on = true;
                                        previousLength=0;
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                        let  newMesTextElement = document.querySelector('.mes.last_mes');
                                        newMesTextElement=  newMesTextElement.querySelector('.mes_text')

                                        function findLastCompletePosition(text) {
                                            const punctuations = ['.', '!', '?', '。', '！', '？', '\n',';'];  // 可以根据需要添加更多符号
                                            let lastPosition = -1;
                                        
                                            for (let punct of punctuations) {
                                                const pos = text.lastIndexOf(punct);
                                                if (pos > lastPosition) {
                                                    lastPosition = pos;
                                                }
                                            }
                                        
                                            return lastPosition === -1 ? text.length : lastPosition + 1;
                                        }
                                        
                                        while (go_on) {
                                            
                                            const element = document.getElementById('send_but');
                                            if (element) {
                                                const isVisible = await isElementVisible(element);
                                                console.log('元素是否可见:', isVisible);
                                                if (isVisible) {
                                                    go_on = false;
                                                }
                                            }
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                            // 获取当前的文本内容
                                           
                                            let newMesText = newMesTextElement.textContent.trim();
                                            if (pass.split('|').some(phrase => newMesText.includes(phrase))) {
                                                console.log(newMesText);
                                                continue;
                                            }
                                            // 计算当前文本长度

                                            newMesText = newMesText.slice(0, findLastCompletePosition(newMesText));
                                            const currentLength = newMesText.length;
                                                // 如果新增了字符，就发送新增的部分
                                                if (currentLength > previousLength) {
                                                    // 获取新增的文本
                                                    const newTextToSend = newMesText.slice(previousLength);
                                                    console.log("准备发送", newTextToSend);

                                                    // 检查新文本是否不为空
                                                    if (newTextToSend.trim() !== '') {
                                                        // 发送新文本
                                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                                        window.dispatchEvent(new CustomEvent('STmessage', {
                                                            detail: { text: newTextToSend },
                                                            bubbles: true,
                                                            cancelable: true
                                                        }));
                                                        lastSentText = newTextToSend;
                                                        previousLength = currentLength;

                                                        console.log("已发送", newTextToSend);
                                                    }
                                                }
                                            
                                          await new Promise(resolve => setTimeout(resolve, 2000));
                                            // 检查发送按钮是否可见
                                 
                                    
                                            // 等待一小段时间再检查
                                          //  await new Promise(resolve => setTimeout(resolve, 1000));
                                        }
                                        const finalText = newMesTextElement.textContent.trim()
                                        if (finalText.length > previousLength) {
                                            const finalTextToSend = finalText.slice(previousLength);
                                            if (finalTextToSend.trim() !== '') {
                                                window.dispatchEvent(new CustomEvent('STmessage', {
                                                    detail: { text: finalTextToSend },
                                                    bubbles: true,
                                                    cancelable: true
                                                }));
                                                console.log("最后发送", finalTextToSend);
                                            }
                                        }




                                    }

                                    const chatElement = document.getElementById('chat');
                                    const lastMes = chatElement.querySelector('.mes.last_mes');
                                    if(lastMes){
                                    idManager.addId(lastMes.getAttribute('timestamp'));
                                     }
                                    
                                    // 辅助函数：检查元素是否可见
                                    function isElementVisible(element) {
                                        return new Promise(resolve => {
                                            const observer = new IntersectionObserver(([entry]) => {
                                                resolve(entry.isIntersecting);
                                                observer.disconnect();
                                            });
                                            observer.observe(element);
                                        });
                                    }

                                        // 确保元素存在
                                        if (!chatElement) {
                                                console.error('Element with id "chat" not found');
                                                return;
                                        }
                                        // 创建一个函数来检查最后一个 mes last_mes 元素
                                      async  function checkLastMessage() {
                                        const lastMes = chatElement.querySelector('.mes.last_mes');
                                        if (lastMes) {
                                            await new Promise(resolve => setTimeout(resolve, 1000));

                                            let isSystem = lastMes.getAttribute('is_user') === 'false';
                                            isSystem=isSystem&&idManager.addId(lastMes.getAttribute('timestamp'));
                                            const element = document.getElementById('send_but');
                                            // 检查元素是否存在
                                            const isVisible = await isElementVisible(element);
                                            isSystem=isSystem&&!isVisible    
                                            console.log(`Last message is${isSystem ? '' : ' not'} 来自ai`);
                                            console.log('isSystem',isSystem);
                                            return isSystem
                                            }
                                             return null;
                                        }

                                        // 创建一个 MutationObserver 来监视 DOM 变化
                                        window.chatObserver = new MutationObserver(async(mutations) => {
                                            console.log('DOM changed');
                                            console.log('New child element added');
                                            const result = await checkLastMessage();
                                        
                                            console.log('result', result);

                                            if (result) {

                                                window.setGlobalVariable(idManager);

                                                console.log('System message detected, calling checkAndSendText');
                                                checkAndSendText().then(() => {
                                                    console.log('checkAndSendText completed');
                                                }).catch(error => {
                                                    console.error('Error in checkAndSendText:', error);
                                                });
                                            } else {
                                                console.log('Not a system message, skipping checkAndSendText');
                                            }
                                        });

                                                                                // 创建一个全局函数来停止 observer
                                                                                window.stopObserver = () => {
                                                                                    if (window.chatObserver) {
                                                                                    window.chatObserver.disconnect();
                                                                                    console.log('Observer stopped');
                                                                                    }
                                                                            };
                                                                            window.startObserver = () => {
                                                                                const observer = window.chatObserver;
                                                                                observer.disconnect(); // 如果已经在运行，先停止
                                                                                observer.observe(chatElement, {
                                                                                  childList: true, // 观察直接子节点的变化
                                                                                  subtree: false,  // 不观察后代节点的变化
                                                                                });
                                                                                console.log('Observer started');
                                                                              };
                                    
                                                                            // 配置 observer 以监视 chat 元素的直接子元素变化
                                                                            window.chatObserver.observe(chatElement, {
                                                                            childList: true, // 观察直接子节点的变化
                                                                            subtree: false,  // 不观察后代节点的变化
                                                                            });
                                    
                                                                            // 初始检查
                                                                            console.log('Initial check:');
                                        

                             } else if(isscriptEnabled&&window.chatObserver){

                                        window.startObserver();


                                    } else{


                                        window.stopObserver();

                                    }

                                },[newValue.scriptEnabled,config.pass]);


                                await  DISpage.evaluate((isscriptEnabled) => {
                                    // 获取 id 为 "chat" 的元素
                                       // 获取 id 为 "chat" 的元素
                                       
                                            class IdManager {
                                            constructor() {
                                                this.usedIds = new Set();
                                            }

                                            // 检查 ID 是否已被使用
                                            isIdUsed(id) {
                                                return this.usedIds.has(id);
                                            }

                                            // 添加新的 ID
                                            addId(id) {
                                                if (this.isIdUsed(id)) {
                                                return false; // ID 已存在，添加失败
                                                }
                                                this.usedIds.add(id);
                                                return true; // ID 添加成功
                                            }

                                            // 移除 ID
                                            removeId(id) {
                                                return this.usedIds.delete(id);
                                            }

                                            // 获取所有已使用的 ID
                                            getAllUsedIds() {
                                                return Array.from(this.usedIds);
                                            }

                                            // 清空所有 ID
                                            clearAllIds() {
                                                this.usedIds.clear();
                                            }
                                            } 
                                         const idManager = new IdManager();        
                                       if(isscriptEnabled&&!window.chatObserver){
                                        const chatElement = document.getElementsByClassName('scrollerInner_e2e187')[0];
                                        // 确保元素存在
                                        if (!chatElement) {
                                        console.error('Element with id "chat" not found');
                                        return;
                                        }

                                        //let lastChildCount = chatElement.childElementCount;
                                        let startmes = chatElement.querySelectorAll('.messageListItem_d5deea');

                                        let lastid=startmes[startmes.length - 1].getAttribute('id');
                                        // 创建一个函数来检查最后一个 mes last_mes 元素
                                        function checkLastMessage() {

                                        let messageListItem = chatElement.querySelectorAll('.messageListItem_d5deea');
                                        console.log("messageListItem",messageListItem)
                                        let lastMes=messageListItem[messageListItem.length - 1]

                                        if (lastMes) {
                                            let isUSER = lastMes.getAttribute('id') != lastid ;
                                            isUSER= idManager.addId(lastMes.getAttribute('id'))&&isUSER       
    
                                            return { lastMes, isUSER };
                                        }
                                        return null;
                                        }

                                        // 创建一个 MutationObserver 来监视 DOM 变化
                                        window.chatObserver = new MutationObserver(async (mutations) => {

                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                        console.log('DOM changed');
                                        // const currentChildCount = chatElement.childElementCount;
                                        // if (currentChildCount < lastChildCount) {
                                        //     lastChildCount = currentChildCount;
                                        // }
                                        
                                        // if (currentChildCount > lastChildCount) {
                                           // lastChildCount = currentChildCount;
                                            console.log('New child element added');
                                            
                                            const result = checkLastMessage();
                                            if (result) {
                                            const { lastMes, isUSER } = result;
                                            if (isUSER) {
                                                console.log('是用户的消息');
                                                // 在这里你可以执行任何需要的操作
                                                console.log("lastMes",lastMes);
                                                const users = lastMes.querySelectorAll('.username_f9f2ca');
                                                console.log("users",users);

                                                if(!users||users.length==0){

                                                    return;

                                                }

                                                idManager.addId(lastMes.getAttribute('id'));

                                                let username=users[users.length - 1].textContent.trim();   
                                                console.log("username",username); 
                                                const lastMesgs = lastMes.querySelectorAll('.messageContent_f9f2ca');
                                                let lastMesg=lastMesgs[lastMesgs.length - 1].textContent.trim();   

                                                console.log("lastMesg",lastMesg);

                                                let jsonObject = {};

                                                    // 添加键值对
                                                    jsonObject.username = username;
                                                    jsonObject.lastMesg = lastMesg;

                                                
                                                window.dispatchEvent(new CustomEvent('DISmessage', { detail:JSON.stringify(jsonObject)}));
                    
                                            }
                                            }
                                        
                                        });

                                            // 创建一个全局函数来停止 observer
                                        window.stopObserver = () => {
                                                if (window.chatObserver) {
                                                window.chatObserver.disconnect();
                                                console.log('Observer stopped');
                                                }
                                        };
                                        window.startObserver = () => {
                                            const observer = window.chatObserver;
                                            observer.disconnect(); // 如果已经在运行，先停止
                                            observer.observe(chatElement, {
                                              childList: true, // 观察直接子节点的变化
                                              subtree: true,  // 不观察后代节点的变化
                                            });
                                            console.log('Observer started');
                                          };

                                        // 配置 observer 以监视 chat 元素的直接子元素变化
                                        window.chatObserver.observe(chatElement, {
                                        childList: true, // 观察直接子节点的变化
                                        subtree: false,  // 不观察后代节点的变化
                                        });

                                        // 初始检查
                                        console.log('Initial check:');
                                        checkLastMessage();
                                    } else if(isscriptEnabled&&window.chatObserver){

                                        window.startObserver();


                                    }
                                    
                                    else{


                                        window.stopObserver();

                                    }

                                },newValue.scriptEnabled);
         
});



async function monitorPageRefresh(page) {
    page.on('load', async () => {
        console.log('页面已被刷新');
       await STset(STpage);
        
    });
}

// 使用示例
await monitorPageRefresh(STpage);


//设置dis回调
async function DISset(page) {


    
    
    
 }


//设置酒馆 回调
  async function STset(page) {
    await page.evaluate(async () => {

  // 添加点击事件监听器到您的按钮或元素上
                    const style1 = document.createElement('style');
                    style1.textContent = `
                    .button_image {
                /* 基础样式 */
                padding: 3px 4px;
                font-size: 13px;
                font-weight: 600;
                color: #ffffff;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);
                /* 文本和图标布局 */
                display: inline-flex;
                align-items: center;
                gap: 8px;
                
                /* 防止文本换行 */
                white-space: nowrap;
                
                /* 去除默认按钮样式 */
                outline: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                    }
                    `;
                document.head.appendChild(style1);
               await addNewElement();
                   async function addNewElement() {
                        const targetElement = document.querySelector('#option_toggle_AN');
                        if (targetElement) {
                            const newElement = document.createElement('a');
                            newElement.id = 'option_toggle_AN2';
                  
                            const icon = document.createElement('i');
                            icon.className = 'fa-lg fa-solid fa-note-sticky';
                            newElement.appendChild(icon);
                  
                            const span = document.createElement('span');
                            span.setAttribute('data-i18n', "打开设置");
                            span.textContent = '打开代理设置';
                            newElement.appendChild(span);
                            // return  true; // 表示操作成功完成
                            targetElement.parentNode.insertBefore(newElement, targetElement.nextSibling);
                            console.log("New element added successfully");
                            document.getElementById('option_toggle_AN2').addEventListener('click', showSettingsPanel);
                       }
                    }
                    let settings={
                     scriptEnabled:false
                    };
                    function createSettingsPanel() {
                        const panel = document.createElement('div');
                        panel.id = 'settings-panel';
                        panel.style.position = 'absolute';
                        panel.style.top = '50%';
                        panel.style.left = '50%';
                        panel.style.transform = 'translate(-50%, -50%)';
                        panel.style.backgroundColor = 'black';  // 设置背景为黑色
                        panel.style.color = 'white';// 设置字体为白色
                        panel.style.padding = '20px';
                        panel.style.border = '1px solid white';// 设置边框为白色
                        panel.style.zIndex = '10000';
                        panel.style.display = 'none';
                        panel.style.overflowY = 'auto';
                        panel.style.maxHeight = '80vh';
                        let html = `
                  <style>
                    #settings-panel input, #settings-panel select {
                      background-color: #444;
                      color: white;
                      background-color: black;
                      border: none;
                      padding: 5px;
                      margin: 5px 0;
                      white-space: nowrap;
                    }
                    .inline-elements div {
                    display: inline-block; /* 或者使用 display: flex; */
                    }
                    #settings-panel button {
                      background-color: #444;
                      color: white;
                      border: none;
                      padding: 5px 10px;
                      cursor: pointer;
                    }
                    #settings-panel button:hover {
                      background-color: #555;
                    }
                    #previewImage {
                    width: 20vh; /* 将图片宽度设置为视口高度的 80% */
                    height: auto; /* 根据宽度自适应高度，保持图片比例 */
                    display: block; /* 将图片显示为块级元素，便于居中 */
                  }
                  </style>
                  `;
                  
                        html += `
                    <h2>设置面板</h2>
                        <label class="switch">
                      <input type="checkbox" id="scriptEnabled" ${settings.scriptEnabled ? 'checked' : ''}>
                      <span class="slider"></span>
                    </label>
                    <label for="scriptToggle" style="display: inline-block; margin-left: 10px;">启用脚本</label>
                    <br><br>
                    <button id="save-settings">保存设置</button>
                    <button id="close-settings">关闭</button>
                    <a id="visit-website-link" href="https://asgdd1kjanhq.sg.larksuite.com/wiki/MqOIw9n3qisWc9kXNhdlkoKCguu?from=from_copylink" target="_blank">帮助</a>
                    <a id="visit-website-link" href="https://discord.com/channels/1134557553011998840/1215675312721887272/1215675312721887272" target="_blank">dc讨论</a>
                    <a id="visit-website-link">BY从前我跟你一样</a>
                    <br>
                    <a id="visit-website-link" href="https://afdian.com/a/cqgnyy" target="_blank">支持作者</a>
                  
                  `;
                  
                  panel.innerHTML+=html;
                        const style = document.createElement('style');
                        style.textContent = `
                    #settings-panel input, #settings-panel select {
                      background-color: #444;
                      color: white;
                      background-color: black;
                      border: none;
                      padding: 5px;
                      margin: 5px 0;
                    }
                    #settings-panel button {
                      background-color: #444;
                      color: white;
                      border: none;
                      padding: 5px 10px;
                      cursor: pointer;
                    }
                    #settings-panel button:hover {
                      background-color: #555;
                    }
                    .switch {
                      position: relative;
                      display: inline-block;
                      width: 60px;
                      height: 34px;
                    }
                    .switch input {
                      opacity: 0;
                      width: 0;
                      height: 0;
                    }
                    .slider {
                      position: absolute;
                      cursor: pointer;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background-color: #ccc;
                      transition: .4s;
                      border-radius: 34px;
                    }
                    .slider:before {
                      position: absolute;
                      content: "";
                      height: 26px;
                      width: 26px;
                      left: 4px;
                      bottom: 4px;
                      background-color: white;
                      transition: .4s;
                      border-radius: 50%;
                    }
                    input:checked + .slider {
                      background-color: #2196F3;
                    }
                    input:checked + .slider:before {
                      transform: translateX(26px);
                    }
                  
                  `;
                        document.body.appendChild(panel);
                        document.head.appendChild(style);
                        document.getElementById('save-settings').addEventListener('click', saveSettings);
                        document.getElementById('close-settings').addEventListener('click', closeSettings);
                        // 添加滑块切换事件监听器
                        document.getElementById('scriptEnabled').addEventListener('change', function() {
                            settings.scriptEnabled = this.checked;
                            console.log('Script ' + (this.checked ? 'enabled' : 'disabled'));
                            window.dispatchEvent(new CustomEvent('valueChanged', { detail: settings }));
                        });
                        return panel;
                    } 

                    
                function saveSettings() {

                    for (const key of Object.keys(settings)) {
                        if(key!="scriptEnabled"){
                            const element = document.getElementById(key);
                            settings[key] = element.value;

                     }

                    }
                    window.dispatchEvent(new CustomEvent('valueChanged', { detail: settings }));

                }  
                function showSettingsPanel() {

                    const panel = document.getElementById('settings-panel');
                    if (!panel) {
                        createSettingsPanel();
                    }
                    document.getElementById('settings-panel').style.display = 'block';
                }

                function hideSettingsPanel() {
                    document.getElementById('settings-panel').style.display = 'none';
                }
                function closeSettings() {
                    hideSettingsPanel();
                }

  }
)}








