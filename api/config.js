// ===================================================
// Firebase 설정 제공 Vercel 서버리스 함수 (/api/config)
//
// 클라이언트 소스코드(app.js)에 키를 직접 적지 않고
// 서버에서 동적으로 환경 설정 객체를 전달합니다.
// ===================================================

export default function handler(req, res) {
  // 캐싱 설정
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  res.status(200).json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCCTftXhmizqF7bBbeu6pUEmYDWMUgKAQ8",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "hakathon-test-7a4c5.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "hakathon-test-7a4c5",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "hakathon-test-7a4c5.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "823817399590",
    appId: process.env.FIREBASE_APP_ID || "1:823817399590:web:08211990776225664525e7",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-Z2NL2S2VKQ"
  });
}
