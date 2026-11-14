# Craftoon Pro 배포 코드

앱의 왼쪽 위 모드 아이콘 메뉴에서 **Enter activation code**를 선택하면 Apple의 코드 입력 창이 열립니다. 유효한 코드로 Pro를 교환하면 기존 StoreKit 검증과 네이티브 기능 제한에 반영됩니다. 취소하거나 코드가 잘못된 경우에는 Pro를 임의로 활성화하지 않습니다. 같은 메뉴의 Restore purchases로 Apple 계정의 Pro 구매를 복원할 수 있습니다.

## 100명에게 개별 배포하기

실제 작동하는 코드는 앱에서 임의 생성할 수 없습니다. App Store Connect에서 다음 설정으로 발급합니다.

1. 앱을 Ready for Distribution 상태로 배포하고 `com.craftoon.pro.unlock` 인앱 구매를 승인받습니다.
2. App Store Connect → 앱 → In-App Purchases → Craftoon Pro → Offer Codes → Create Offer.
3. 참조 이름(예: `Craftoon Launch`), 대상 고객·국가를 설정하고 **Free Offer**를 선택합니다. 모두에게 주려면 고객 조건을 모두 선택합니다.
4. One-Time Use Codes에서 **500개**를 생성합니다. Apple의 최소 발급 수량이 500개이므로, 이 중 100개를 선별해 개별 배포합니다. 각 코드는 한 번 사용할 수 있습니다.
5. 배포 일정에 맞는 만료일을 지정합니다. 최대 유효기간은 6개월이며, 만료일 오전 0시 미국 태평양 시각에 만료됩니다. 무기한 쌓아두는 개별 코드는 지원하지 않습니다.
6. CSV를 다운로드하고 비공개로 보관합니다. 코드·배포 대상·배포일·만료일을 함께 관리하며 이미 전달한 코드를 다른 사람에게 다시 주지 않습니다. 발급 직후 최대 1시간 동안 교환이 지연될 수 있습니다.

100개로 사용 횟수를 제한한 **공통 Custom Code**도 대안입니다. 개별 코드가 아니므로 링크가 전달되면 다른 사람도 한도를 소진할 수 있습니다. 개별 전달 목적에는 One-Time Use Codes를 권장합니다.

현재 저장소에는 App Store Connect 연결과 승인된 배포 상품이 없으므로, 실제 코드는 발급하지 않았습니다. 기존 100개짜리 IAP promo code 발급은 2026년 3월 26일 종료되어 Offer Codes를 사용해야 합니다. 무료 앱 자체의 다운로드용 promo code는 Pro 인앱 구매를 활성화하는 코드와 다릅니다.

## 검증

- App Store Connect의 Sandbox Code로 실기기에서 정상·취소·잘못된 코드·만료 코드를 확인합니다.
- 코드가 성공적으로 교환된 뒤 저장·페이지 추가·이메일·인쇄 기능이 활성화되는지 확인합니다.
- 앱 재실행과 같은 Apple 계정의 구매 복원, 환불·취소에 따른 접근 변경을 확인합니다.
- 단순히 코드 입력 창을 닫았다는 이유로 성공 메시지나 Pro 접근을 제공하지 않습니다.

## 매뉴얼

모든 화면의 모드 메뉴 → **Quick guide (PDF)**. Free에서도 사용할 수 있고, 인터넷 없이 앱에 포함된 한 장 PDF를 확대해서 볼 수 있습니다. Done으로 원래 화면에 돌아옵니다. 처음 실행할 때 강제로 띄우는 대신 항상 같은 위치에서 찾아볼 수 있게 했습니다.

생성 원본: `scripts/build-guide.py`. 결과: `output/pdf/craftoon-quick-guide.pdf`, 앱 리소스: `ios/Craftoon/craftoon-quick-guide.pdf`. 생성 후 앱 리소스 복사가 자동으로 수행됩니다.

공식 참고:

- https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases/
- https://developer.apple.com/documentation/storekit/supporting-offer-codes-in-your-app
- https://developer.apple.com/news/?id=gf6mgrs6
