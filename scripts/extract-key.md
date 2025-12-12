# Извлечение приватного ключа из установленного расширения

Если у вас нет `.pem` файла, можно извлечь ключ из уже установленного расширения.

## Вариант 1: Из упакованного CRX файла

1. **Скачайте CRX** с Chrome Web Store Developer Dashboard
2. **Распакуйте CRX**:
   ```bash
   cd pdf-to-google-sheets
   # CRX это ZIP архив, переименуйте и распакуйте
   unzip your-extension.crx -d temp_extract
   ```
3. **Найдите манифест**: В `temp_extract/manifest.json` будет поле `"key"`

## Вариант 2: Из локальной установки Chrome

Расширения Chrome хранятся в:
```
C:\Users\George\AppData\Local\Google\Chrome\User Data\Default\Extensions\dgkjakmbfiniapfghejhccflmcnlbhak
```

1. Откройте эту папку
2. Найдите подпапку с версией (например, `0.0.1_0`)
3. Откройте `manifest.json`
4. Скопируйте значение поля `"key"` (если оно есть)

## Вариант 3: Использовать Chrome Web Store как источник

Если ключ нигде не найден, проще всего:

1. **Держите расширение в Chrome Web Store** в статусе **"Private"** или **"Unlisted"**
2. **Добавьте тестеров** в список разрешенных пользователей:
   - Chrome Web Store Dashboard → Ваше расширение
   - **Distribution** → **Visibility**: "Private"
   - Добавьте email тестеров в разрешенный список
3. Тестеры устанавливают через прямую ссылку (не будет видно в поиске)

## Вариант 4: Создать новый ключ (НЕ рекомендуется)

Это создаст НОВЫЙ Extension ID, и придётся перенастраивать OAuth:

```bash
cd pdf-to-google-sheets/dist
# Chrome создаст новый .pem при первой упаковке
chrome --pack-extension=.
```

**НЕ делайте это**, если у вас уже настроен OAuth!
