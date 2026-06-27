import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = new URL('..', import.meta.url).pathname

const navy = '#0B1220'
const teal = '#12A594'
const amber = '#E7B66B'
const sourceIcon = join(root, 'public/icon-source.png')

async function ensureFile(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function renderIcon(path, size) {
  await mkdir(dirname(path), { recursive: true })
  await sharp(sourceIcon)
    .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
    .png()
    .toFile(path)
}

async function renderForeground(path, size) {
  await mkdir(dirname(path), { recursive: true })
  const iconSize = Math.round(size * 0.86)
  const icon = await sharp(sourceIcon)
    .resize(iconSize, iconSize, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, left: Math.round((size - iconSize) / 2), top: Math.round((size - iconSize) / 2) }])
    .png()
    .toFile(path)
}

async function renderSplash(path, width, height) {
  await mkdir(dirname(path), { recursive: true })
  const mark = Math.round(Math.min(width, height) * 0.3)
  const icon = await sharp(sourceIcon)
    .resize(mark, mark, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="tealGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.58} ${height * 0.42}) rotate(95) scale(${Math.min(width, height) * 0.58})">
        <stop offset="0" stop-color="${teal}" stop-opacity="0.22"/>
        <stop offset="0.58" stop-color="${teal}" stop-opacity="0.08"/>
        <stop offset="1" stop-color="${teal}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.42} ${height * 0.58}) rotate(95) scale(${Math.min(width, height) * 0.42})">
        <stop offset="0" stop-color="${amber}" stop-opacity="0.13"/>
        <stop offset="1" stop-color="${amber}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="${navy}"/>
    <rect width="${width}" height="${height}" fill="url(#tealGlow)"/>
    <rect width="${width}" height="${height}" fill="url(#goldGlow)"/>
  </svg>`)

  await sharp(background)
    .composite([{ input: icon, left: Math.round((width - mark) / 2), top: Math.round((height - mark) / 2) }])
    .png()
    .toFile(path)
}

function orbitVector(size = 144) {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${size}dp"
    android:height="${size}dp"
    android:viewportWidth="144"
    android:viewportHeight="144">
    <path
        android:fillColor="#00000000"
        android:pathData="M36,94 C51,69 78,50 112,43"
        android:strokeColor="${teal}"
        android:strokeLineCap="round"
        android:strokeWidth="16" />
    <path
        android:fillColor="#00000000"
        android:pathData="M42,102 C66,111 95,104 115,84"
        android:strokeColor="${teal}"
        android:strokeAlpha="0.62"
        android:strokeLineCap="round"
        android:strokeWidth="14" />
    <path
        android:fillColor="${amber}"
        android:pathData="M72,43a28,28 0,1 0,0.1 0" />
    <path
        android:fillColor="${amber}"
        android:pathData="M104,24a12,12 0,1 0,0.1 0" />
    <path
        android:fillColor="${amber}"
        android:pathData="M34,101a11,11 0,1 0,0.1 0" />
    <path
        android:fillColor="#00000000"
        android:pathData="M48,120 C67,128 88,126 107,116"
        android:strokeColor="${amber}"
        android:strokeLineCap="round"
        android:strokeWidth="8" />
</vector>
`
}

await renderIcon(join(root, 'public/favicon.png'), 64)
await renderIcon(join(root, 'public/brand-mark.png'), 256)
await renderIcon(join(root, 'public/icon-192.png'), 192)
await renderIcon(join(root, 'public/icon-512.png'), 512)
await ensureFile(
  join(root, 'public/manifest.webmanifest'),
  JSON.stringify(
    {
      name: '돈길',
      short_name: '돈길',
      description: '오늘 써도 되는 돈과 90일 잔고 흐름을 보여주는 금전계획 앱',
      start_url: '/',
      display: 'standalone',
      background_color: navy,
      theme_color: navy,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ),
)

const mipmapSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

for (const [density, size] of Object.entries(mipmapSizes)) {
  await renderIcon(join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`), size)
  await renderIcon(join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`), size)
  await renderForeground(join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`), Math.round(size * 2.25))
}

const splashSizes = {
  'drawable/splash.png': [480, 320],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
}

for (const [target, [width, height]] of Object.entries(splashSizes)) {
  await renderSplash(join(root, `android/app/src/main/res/${target}`), width, height)
}

await ensureFile(join(root, 'android/app/src/main/res/drawable/ic_launcher_foreground.xml'), orbitVector(108))
await ensureFile(join(root, 'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml'), orbitVector(108))
await ensureFile(join(root, 'android/app/src/main/res/drawable/splash_icon.xml'), orbitVector(144))

await ensureFile(
  join(root, 'android/app/src/main/res/values/colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0F766E</color>
    <color name="colorPrimaryDark">${navy}</color>
    <color name="colorAccent">${amber}</color>
    <color name="splashBackground">${navy}</color>
    <color name="appPageBackground">#F6F8FA</color>
</resources>
`,
)

await ensureFile(
  join(root, 'android/app/src/main/res/values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${navy}</color>
</resources>
`,
)
