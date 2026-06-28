# 머니플

오늘 써도 되는 돈, 월말 예상 잔고, 90일 현금흐름을 한 화면에서 보는 금전계획 앱입니다.

## 핵심 기능

- 오늘 사용 가능 금액 자동 계산
- 월말 예상 잔고와 안전잔고 비교
- 90일 잔고 흐름 그래프
- 빠른 지출/수입 기록
- 반복 지출/수입 관리
- 목표저축 월별 필요 금액 계산
- 큰 소비 시뮬레이션
- JSON 백업/복원
- 은행·카드 알림 기반 자동 기록 후보
- Vercel 직접 APK 링크 기반 인앱 업데이트 확인

## 개발

```bash
npm install
npm run dev
```

## 웹 빌드

```bash
npm run assets:brand
npm run lint
npm run build
```

`npm run assets:brand`는 favicon, web app icon, Android launcher icon, splash 이미지를 같은 브랜드 원본에서 다시 생성합니다.

## Android APK 빌드

로컬 release 빌드는 `android/app/keystore.properties`와 `android/app/release-keystore.jks`가 필요합니다. 두 파일은 커밋하지 않습니다.

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
npm run android:sync
cd android
./gradlew assembleRelease
```

완성 APK:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 업데이트 배포

앱은 Vercel의 `version.json`을 확인합니다. 새 버전이 올라가 있으면 앱 안에 다운로드 안내가 뜨고, 다운로드 버튼은 Vercel의 직접 APK 링크를 엽니다.

항상 최신 APK를 받는 고정 링크:

```text
https://moneypl-apk-vercel.vercel.app/moneypl.apk
```

태그 배포:

```bash
git tag v0.5.5
git push origin v0.5.5
```

GitHub Actions가 release APK를 빌드하려면 저장소 Secrets에 아래 값이 필요합니다.

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```
