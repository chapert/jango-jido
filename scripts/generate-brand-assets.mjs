import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = new URL('..', import.meta.url).pathname

const navy = '#0B1220'
const deep = '#132B33'
const teal = '#12A594'
const mint = '#9BE3D7'
const cream = '#F8FAFC'
const amber = '#E7B66B'

async function ensureFile(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function renderPng(path, svg, width, height = width) {
  await mkdir(dirname(path), { recursive: true })
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(path)
}

function wonMark(scale = 1, options = {}) {
  const { stroke = cream, bar = mint, accent = amber, opacity = 1 } = options
  return `<g opacity="${opacity}">
    <path d="M145 148 L202 360 L256 184 L310 360 L367 148" fill="none" stroke="${stroke}" stroke-width="${38 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M138 238 H374" fill="none" stroke="${bar}" stroke-width="${23 * scale}" stroke-linecap="round"/>
    <path d="M150 292 H362" fill="none" stroke="${bar}" stroke-width="${23 * scale}" stroke-linecap="round"/>
    <path d="M184 386 H328" fill="none" stroke="${accent}" stroke-width="${18 * scale}" stroke-linecap="round"/>
  </g>`
}

function logoSvg(size = 512, options = {}) {
  const { transparent = false } = options
  const background = transparent
    ? ''
    : `<defs>
        <linearGradient id="bg" x1="70" y1="40" x2="450" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${navy}"/>
          <stop offset="0.62" stop-color="#0D1928"/>
          <stop offset="1" stop-color="${deep}"/>
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(360 128) rotate(120) scale(250)">
          <stop offset="0" stop-color="${teal}" stop-opacity="0.46"/>
          <stop offset="0.58" stop-color="${teal}" stop-opacity="0.12"/>
          <stop offset="1" stop-color="${teal}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#bg)"/>
      <rect width="512" height="512" rx="112" fill="url(#glow)"/>
      <path d="M92 410 C172 360 268 330 420 116" fill="none" stroke="${teal}" stroke-width="24" stroke-linecap="round" opacity="0.22"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${background}
  ${wonMark(1)}
</svg>`
}

function splashSvg(width, height) {
  const mark = Math.round(Math.min(width, height) * 0.26)
  const x = Math.round((width - mark) / 2)
  const y = Math.round((height - mark) / 2)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${navy}"/>
  <circle cx="${Math.round(width * 0.64)}" cy="${Math.round(height * 0.36)}" r="${Math.round(mark * 1.18)}" fill="${teal}" opacity="0.08"/>
  <g transform="translate(${x} ${y}) scale(${mark / 512})">
    ${logoSvg(512).replace(/<svg[^>]*>|<\/svg>/g, '')}
  </g>
</svg>`
}

const favicon = logoSvg(96)
await ensureFile(join(root, 'public/favicon.svg'), favicon)
await ensureFile(join(root, 'public/brand-mark.svg'), logoSvg(512))
await ensureFile(
  join(root, 'public/manifest.webmanifest'),
  JSON.stringify(
    {
      name: '잔고지도',
      short_name: '잔고지도',
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

await renderPng(join(root, 'public/icon-192.png'), logoSvg(512), 192)
await renderPng(join(root, 'public/icon-512.png'), logoSvg(512), 512)

const mipmapSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

for (const [density, size] of Object.entries(mipmapSizes)) {
  await renderPng(join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`), logoSvg(512), size)
  await renderPng(join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`), logoSvg(512), size)
  await renderPng(
    join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`),
    logoSvg(512, { transparent: true }),
    Math.round(size * 2.25),
  )
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
  await renderPng(join(root, `android/app/src/main/res/${target}`), splashSvg(width, height), width, height)
}

const androidForeground = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00000000"
        android:pathData="M31,25 L43,76 L54,33 L65,76 L77,25"
        android:strokeColor="${cream}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:strokeWidth="8" />
    <path
        android:fillColor="#00000000"
        android:pathData="M29,45 H79"
        android:strokeColor="${mint}"
        android:strokeLineCap="round"
        android:strokeWidth="5" />
    <path
        android:fillColor="#00000000"
        android:pathData="M32,57 H76"
        android:strokeColor="${mint}"
        android:strokeLineCap="round"
        android:strokeWidth="5" />
    <path
        android:fillColor="#00000000"
        android:pathData="M39,84 H69"
        android:strokeColor="${amber}"
        android:strokeLineCap="round"
        android:strokeWidth="5" />
</vector>
`

const androidSplashIcon = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="144dp"
    android:height="144dp"
    android:viewportWidth="144"
    android:viewportHeight="144">
    <path
        android:fillColor="#00000000"
        android:pathData="M42,32 L57,101 L72,44 L87,101 L102,32"
        android:strokeColor="${cream}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:strokeWidth="11" />
    <path
        android:fillColor="#00000000"
        android:pathData="M39,60 H105"
        android:strokeColor="${mint}"
        android:strokeLineCap="round"
        android:strokeWidth="7" />
    <path
        android:fillColor="#00000000"
        android:pathData="M43,77 H101"
        android:strokeColor="${mint}"
        android:strokeLineCap="round"
        android:strokeWidth="7" />
    <path
        android:fillColor="#00000000"
        android:pathData="M52,112 H92"
        android:strokeColor="${amber}"
        android:strokeLineCap="round"
        android:strokeWidth="7" />
</vector>
`

await ensureFile(join(root, 'android/app/src/main/res/drawable/ic_launcher_foreground.xml'), androidForeground)
await ensureFile(join(root, 'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml'), androidForeground)
await ensureFile(join(root, 'android/app/src/main/res/drawable/splash_icon.xml'), androidSplashIcon)

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
