'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
try { process.loadEnvFile(require('node:path').join(__dirname, '.env')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const token = process.env.BOT_TOKEN;
if (!token) throw new Error('Не указан токен бота');
const SITE = 'https://aristoeruditos.gastroand.me/';
const ADMIN_CHAT_ID = 448855925;
const states = new Map();
const services = {
  web: ['Сайты и веб-сервисы', 'Создаём сайты, интернет-магазины, личные кабинеты и онлайн-сервисы. Начинаем с вашей задачи, согласуем объём и этапы, затем разрабатываем и помогаем с запуском.'],
  mobile: ['Мобильные приложения', 'Разрабатываем приложения для iOS и Android: от первой версии до развития продукта. Помогаем определить основные функции и путь пользователя.'],
  ai: ['AI-агенты и автоматизация', 'Помогаем автоматизировать ответы по базе знаний, обработку заявок и работу с CRM. Определяем первый сценарий, подключаем системы и предусматриваем подтверждение важных действий.'],
  consult: ['Консультация по разработке', 'Обсудим идею, существующий продукт или технический вопрос. Поможем определить следующий шаг.']
};
const cb = (text, data) => ({ text, callback_data: data });
const link = (text, url) => ({ text, url });
const markup = rows => ({ inline_keyboard: rows });
const home = () => markup([
  [cb('Сайты и веб-сервисы', 'service:web')],
  [cb('Мобильные приложения', 'service:mobile')],
  [cb('AI-агенты и автоматизация', 'service:ai')],
  [cb('Консультация по разработке', 'service:consult')],
  [cb('Наш опыт', 'work'), cb('Как мы работаем', 'process')],
  [link('Сайт студии', SITE)]
]);
async function api(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(45000)
  });
  const result = await response.json();
  if (!result.ok) {
    const error = new Error('Ошибка Telegram API');
    error.code = result.error_code;
    error.retryAfter = result.parameters?.retry_after;
    throw error;
  }
  return result.result;
}
const send = (id, text, reply_markup = home()) => api('sendMessage', {chat_id: id, text, reply_markup});
const photoCache = new Map();
async function sendCard(id, imageName, caption, keyboard = home()) {
  try {
    let payload;
    if (photoCache.has(imageName)) {
      payload = {chat_id: id, photo: photoCache.get(imageName), caption, reply_markup: keyboard};
    } else {
      payload = new FormData();
      payload.set('chat_id', String(id));
      payload.set('caption', caption);
      payload.set('reply_markup', JSON.stringify(keyboard));
      payload.set('photo', new Blob([await fs.readFile(path.join(__dirname, 'assets', imageName))], {type: imageName.endsWith('.png') ? 'image/png' : 'image/jpeg'}), imageName);
    }
    const result = await api('sendPhoto', payload);
    const photo = result.photo?.at(-1);
    if (photo) photoCache.set(imageName, photo.file_id);
    return result;
  } catch {
    photoCache.delete(imageName);
    console.error('Не удалось показать изображение; отправляем текст');
    return send(id, caption, keyboard);
  }
}
const projects = [
  {image: 'lexica.jpg', title: 'Lexica', text: 'Приложение для изучения иностранных языков: словарь, короткие задания и подготовка к экзамену A2.', url: 'https://apps.apple.com/app/id6785219429', type: 'mobile'},
  {image: 'tastio.jpg', title: 'Tastio', text: 'Кулинарное приложение с видеорецептами, списком покупок и голосовым помощником для готовки.', url: 'https://apps.apple.com/app/id1660297807', type: 'mobile'},
  {image: 'web.jpg', title: 'Marks & Spencer', text: 'Веб-проект из профессионального опыта команды. Интернет-магазин с каталогом, поиском и оформлением заказа.', url: 'https://www.marksandspencer.com/', type: 'web'}
];
async function showProject(id, index) {
  const project = projects[index];
  if (!project) return;
  return sendCard(id, project.image, `НАШ ОПЫТ · ${index + 1} / ${projects.length}\n\n${project.title}\n${project.text}\n\nСобственные продукты и проекты из профессионального опыта команды.`, markup([
    [cb('←', `project:${(index + projects.length - 1) % projects.length}`), cb('→', `project:${(index + 1) % projects.length}`)],
    [link('Открыть проект', project.url)], [cb('Обсудить похожую задачу', `begin:${project.type}`)],
    [link('Все проекты студии', `${SITE}projects.html?lang=ru`)], [cb('Главное меню', 'home')]
  ]));
}
let animationFileId;
async function sendWelcome(id, caption) {
  try {
    let payload;
    if (animationFileId) {
      payload = {chat_id: id, animation: animationFileId, caption, reply_markup: home()};
    } else {
      payload = new FormData();
      payload.set('chat_id', String(id));
      payload.set('caption', caption);
      payload.set('reply_markup', JSON.stringify(home()));
      payload.set('animation', new Blob([await fs.readFile(path.join(__dirname, 'assets', 'hero.mp4'))], {type: 'video/mp4'}), 'hero.mp4');
    }
    const result = await api('sendAnimation', payload);
    if (result.animation?.file_id) animationFileId = result.animation.file_id;
    return result;
  } catch {
    animationFileId = undefined;
    console.error('Анимация недоступна; показываем логотип');
    return sendCard(id, 'logo.png', caption);
  }
}
async function showHome(id) {
  states.delete(id);
  await sendWelcome(id, 'ARISTOERUDITOS — делаем идеи работающими.\n\nСоздаём сайты, веб-сервисы, мобильные приложения и AI-агентов. Помогаем пройти путь от задачи до запуска и развития продукта.\n\nЧто вы хотите обсудить?');
}
function questions(type) {
  return type === 'consult'
    ? ['Какой вопрос вы хотите обсудить? Опишите ситуацию в нескольких предложениях.']
    : [type === 'ai' ? 'Какой процесс вы хотите автоматизировать? Расскажите, как он работает сейчас.' : 'Что вы хотите создать и какую задачу должен решать продукт?',
       'Когда вы хотели бы запустить проект?', 'Какой бюджет вы рассматриваете? Можно указать валюту и диапазон.'];
}
async function ask(id, state) {
  const rows = [];
  if (state.step > 0) rows.push([cb('Пока не знаю', 'unknown')]);
  if (state.step > 0) rows.push([cb('Назад', 'back')]);
  rows.push([cb('Главное меню', 'home')]);
  await send(id, questions(state.type)[state.step], markup(rows));
}
function leadText(state) {
  const labels = state.type === 'consult' ? ['Вопрос'] : ['Задача', 'Сроки', 'Бюджет'];
  return `Направление: ${services[state.type][0]}\n\n` +
    state.answers.map((answer, i) => `${labels[i]}: ${answer}`).join('\n');
}
async function finish(id, state) {
  state.review = true;
  await send(id, `${leadText(state)}\n\nПроверьте ответы. Нажав «Отправить заявку», вы передадите их и свой Telegram-контакт представителю студии для связи по вашему обращению.`, markup([
    [cb('Отправить заявку', 'submit')], [cb('Изменить ответы', 'edit')],
    [cb('Главное меню', 'home')]
  ]));
}
async function submit(id, state) {
  if (state.done) return send(id, 'Эта заявка уже отправлена.');
  if (!state.review || state.sending) return;
  state.sending = true;
  const user = state.user;
  const contact = user.username ? `@${user.username}` : `Telegram ID: ${user.id}`;
  try {
    await send(ADMIN_CHAT_ID,
      `Новая заявка — ARISTOERUDITOS\n\nКлиент: ${[user.first_name, user.last_name].filter(Boolean).join(' ')}\nКонтакт: ${contact}\nID: ${user.id}\n\n${leadText(state)}`,
      markup([[link('Открыть профиль клиента', user.username ? `https://t.me/${user.username}` : `tg://user?id=${user.id}`)]]));
  } catch {
    state.sending = false;
    return send(id, 'Не удалось отправить заявку. Ответы сохранены в текущей анкете. Попробуйте ещё раз.', markup([
      [cb('Повторить отправку', 'submit')], [cb('Главное меню', 'home')]
    ]));
  }
  state.sending = false;
  state.done = true;
  await send(id, 'Спасибо! Ваша заявка отправлена представителю ARISTOERUDITOS. Мы свяжемся с вами в Telegram.');
}
async function advance(id, state, answer) {
  state.answers[state.step] = answer;
  state.step++;
  if (state.step === questions(state.type).length) await finish(id, state);
  else await ask(id, state);
}
async function handle(update) {
  const query = update.callback_query;
  const msg = query?.message || update.message;
  if (!msg || msg.chat.type !== 'private') return;
  const id = msg.chat.id;
  if (query) {
    await api('answerCallbackQuery', {callback_query_id: query.id});
    const action = query.data;
    if (action === 'home') return showHome(id);
    if (action.startsWith('service:')) {
      const type = action.split(':')[1];
      if (!services[type]) return;
      states.delete(id);
      const show = (type === 'web' || type === 'mobile')
        ? (chat, text, keyboard) => sendCard(chat, type === 'web' ? 'web.jpg' : 'tastio.jpg', text + (type === 'web' ? '\n\nНа изображении — веб-проект из опыта команды.' : '\n\nНа изображении — приложение Tastio.'), keyboard)
        : send;
      return show(id, `${services[type][0]}\n\n${services[type][1]}`, markup([
        [cb(type === 'consult' ? 'Задать вопрос' : 'Обсудить задачу', `begin:${type}`)],
        [cb('Главное меню', 'home')]
      ]));
    }
    if (action.startsWith('begin:')) {
      const type = action.split(':')[1];
      if (!services[type]) return;
      const state = { type, step: 0, answers: [], user: query.from, updated: Date.now() };
      states.set(id, state);
      return ask(id, state);
    }
    if (action === 'work') return showProject(id, 0);
    if (/^project:[0-2]$/.test(action)) return showProject(id, Number(action.split(':')[1]));
    if (action === 'process') return send(id,
      'От задачи до запуска\n\n1. Разбираемся в бизнесе и цели продукта.\n2. При необходимости создаём прототип.\n3. Согласуем объём, этапы и бюджет.\n4. Разрабатываем и показываем работающий результат.\n5. Проверяем, запускаем и помогаем развивать продукт.');
    const state = states.get(id);
    if (!state) return send(id, 'Эта анкета уже закрыта. Выберите направление в меню.');
    state.updated = Date.now();
    if (action === 'submit') return submit(id, state);
    if (action === 'edit' && state.review && !state.done) {
      state.step = 0; state.answers = []; state.review = false;
      return ask(id, state);
    }
    if (state.done || state.review) return;
    if (action === 'back' && state.step > 0) {state.step--; return ask(id, state);}
    if (action === 'unknown' && state.step > 0) return advance(id, state, 'Пока не знаю');
    return;
  }
  const text = msg.text?.trim();
  if (text && /^\/(start|menu|cancel)(?:@\w+)?(?:\s|$)/.test(text)) return showHome(id);
  const state = states.get(id);
  if (!state || state.done) return send(id, 'Выберите направление в меню, чтобы оставить заявку.');
  if (state.review) return send(id, 'Проверьте анкету выше и нажмите «Отправить заявку» или «Изменить ответы».', markup([[cb('Отправить заявку', 'submit')], [cb('Изменить ответы', 'edit')]]));
  if (!text || text.startsWith('/')) return send(id, 'Ответьте текстом. Чтобы отменить анкету, отправьте /cancel.');
  if (text.length > 400) return send(id, 'Сократите ответ до 400 символов, чтобы заявка получилась краткой и понятной.');
  state.updated = Date.now();
  return advance(id, state, text);
}
let running = true;
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end('ARISTOERUDITOS bot process is running\n');
});
server.listen(process.env.PORT || 3000);
const cleanup = setInterval(() => {
  for (const [id, state] of states) if (Date.now() - state.updated > 86400000) states.delete(id);
}, 3600000);
async function main() {
  const webhook = await api('getWebhookInfo', {});
  if (webhook.url) throw new Error('Настроен webhook: отключите его перед запуском polling');
  await api('setMyCommands', {commands: [
    {command: 'start', description: 'Услуги студии'},
    {command: 'menu', description: 'Главное меню'},
    {command: 'cancel', description: 'Отменить анкету'}
  ]});
  let offset = 0;
  while (running) {
    try {
      const updates = await api('getUpdates', {offset, timeout: 30, allowed_updates: ['message', 'callback_query']});
      for (const update of updates) {
        try { await handle(update); }
        catch { console.error('Не удалось обработать обновление', update.update_id); }
        offset = update.update_id + 1;
      }
    } catch (error) {
      if (error.code === 401 || error.code === 409) throw new Error('Проверьте токен и убедитесь, что запущен только один экземпляр бота');
      console.error('Соединение с Telegram прервано; повторяем подключение');
      await new Promise(resolve => setTimeout(resolve, Math.max(3000, (error.retryAfter || 0) * 1000)));
    }
  }
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  running = false; clearInterval(cleanup); server.close(); process.exit(0);
});
main().catch(error => {console.error(error.message); process.exit(1);});
