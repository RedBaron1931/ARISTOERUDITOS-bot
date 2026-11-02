#!/bin/bash
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js не найден. Установите Node.js 22 или новее.'
  read -r -p 'Нажмите Enter для закрытия…'
  exit 1
fi
printf 'Вставьте НОВЫЙ токен из BotFather и нажмите Enter.\nВвод скрыт — это нормально. Токен не сохраняется в файл.\n'
read -r -s -p 'BOT_TOKEN: ' BOT_TOKEN
printf '\n'
export BOT_TOKEN
if [ -z "$BOT_TOKEN" ]; then
  echo 'Токен не введён.'
  exit 1
fi
printf '\nЗапускаем бота. Откройте его в Telegram и нажмите Старт.\nДля остановки нажмите Control+C в этом окне.\nНе закрывайте терминал, пока используете бота.\n\n'
node bot.js
unset BOT_TOKEN
read -r -p 'Бот остановлен. Нажмите Enter для закрытия…'
