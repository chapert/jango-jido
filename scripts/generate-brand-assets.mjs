import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = new URL('..', import.meta.url).pathname

const navy = '#111827'
const ink = '#17202A'
const teal = '#50A3A2'
const tealDark = '#0F766E'
const cream = '#F8FAFC'
const orange = '#DF6A4F'

async function ensureFile(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function renderPng(path, svg, width, height = width) {
  await mkdir(dirname(path), { recursive: true })
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(path)
}

function logoSvg(size = 512, options = {}) {
  const { transparent = false, padding = 48 } = options
  const bg = transparent
    ? ''
    : `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.21)}" fill="${navy}"/>`
  const scale = size / 512
  const p = padding * scale
  const cardX = 112 * scale
  const cardY = 132 * scale
  const cardW = 288 * scale
  const cardH = 248 * scale
  const radius = 42 * scale
  const stroke = 28 * scale
  const safety = 24 * scale
  const dot = 15 * scale

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <path d="M${p + 18 * scale} ${360 * scale} C${122 * scale} ${248 * scale} ${224 * scale} ${196 * scale} ${384 * scale} ${132 * scale}" fill="none" stroke="${teal}" stroke-width="${stroke}" stroke-linecap="round"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${radius}" fill="${cream}"/>
  <path d="M${144 * scale} ${296 * scale} C${190 * scale} ${234 * scale} ${238 * scale} ${272 * scale} ${288 * scale} ${204 * scale} C${318 * scale} ${164 * scale} ${354 * scale} ${154 * scale} ${392 * scale} ${146 * scale}" fill="none" stroke="${tealDark}" stroke-width="${22 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M${154 * scale} ${332 * scale} H${354 * scale}" fill="none" stroke="${orange}" stroke-width="${safety}" stroke-linecap="round"/>
  <circle cx="${156 * scale}" cy="${296 * scale}" r="${dot}" fill="${ink}"/>
  <circle cx="${392 * scale}" cy="${146 * scale}" r="${dot}" fill="${orange}"/>
</svg>`
}

function splashSvg(width, height) {
  const mark = Math.round(Math.min(width, height) * 0.34)
  const x = Math.round((width - mark) / 2)
  const y = Math.round((height - mark) / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${navy}"/>
  <path d="M${Math.round(width * 0.12)} ${Math.round(height * 0.68)} C${Math.round(width * 0.31)} ${Math.round(height * 0.42)} ${Math.round(width * 0.58)} ${Math.round(height * 0.33)} ${Math.round(width * 0.88)} ${Math.round(height * 0.23)}" fill="none" stroke="${teal}" stroke-width="${Math.max(8, Math.round(mark * 0.08))}" stroke-linecap="round" opacity="0.34"/>
  <g transform="translate(${x} ${y})">
    ${logoSvg(mark, { transparent: true }).replace(/<svg[^>]*>|<\/svg>/g, '')}
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
  await renderPng(
    join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`),
    logoSvg(512),
    size,
  )
  await renderPng(
    join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`),
    logoSvg(512),
    size,
  )
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
        android:pathData="M15,76 C29,53 49,42 89,30"
        android:strokeColor="${teal}"
        android:strokeLineCap="round"
        android:strokeWidth="9" />
    <path
        android:fillColor="${cream}"
        android:pathData="M30,30 H73 C80,30 84,34 84,41 V78 C84,85 80,89 73,89 H30 C23,89 19,85 19,78 V41 C19,34 23,30 30,30 Z" />
    <path
        android:fillColor="#00000000"
        android:pathData="M31,67 C42,52 52,62 64,45 C71,36 80,34 89,32"
        android:strokeColor="${tealDark}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:strokeWidth="6" />
    <path
        android:fillColor="#00000000"
        android:pathData="M33,77 H73"
        android:strokeColor="${orange}"
        android:strokeLineCap="round"
        android:strokeWidth="7" />
    <path
        android:fillColor="${ink}"
        android:pathData="M31,62 m-4,0 a4,4 0,1 0,8 0 a4,4 0,1 0,-8 0" />
    <path
        android:fillColor="${orange}"
        android:pathData="M89,32 m-5,0 a5,5 0,1 0,10 0 a5,5 0,1 0,-10 0" />
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
        android:pathData="M25,96 C44,66 70,54 116,40"
        android:strokeColor="${teal}"
        android:strokeLineCap="round"
        android:strokeWidth="13" />
    <path
        android:fillColor="${cream}"
        android:pathData="M43,39 H96 C106,39 112,45 112,55 V101 C112,111 106,117 96,117 H43 C33,117 27,111 27,101 V55 C27,45 33,39 43,39 Z" />
    <path
        android:fillColor="#00000000"
        android:pathData="M45,89 C60,68 73,81 89,58 C99,45 110,43 121,40"
        android:strokeColor="${tealDark}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round"
        android:strokeWidth="8" />
    <path
        android:fillColor="#00000000"
        android:pathData="M48,102 H96"
        android:strokeColor="${orange}"
        android:strokeLineCap="round"
        android:strokeWidth="9" />
</vector>
`

await ensureFile(join(root, 'android/app/src/main/res/drawable/ic_launcher_foreground.xml'), androidForeground)
await ensureFile(join(root, 'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml'), androidForeground)
await ensureFile(join(root, 'android/app/src/main/res/drawable/splash_icon.xml'), androidSplashIcon)

await ensureFile(
  join(root, 'android/app/src/main/res/values/colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${tealDark}</color>
    <color name="colorPrimaryDark">${navy}</color>
    <color name="colorAccent">${orange}</color>
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
