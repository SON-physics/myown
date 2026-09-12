// ===================================================
// 우리 반 담벼락 - Firebase Firestore 연동
//
// Firebase Firestore를 사용하여 메모 데이터를 저장합니다.
// 브라우저를 새로고침해도 메모가 안전하게 보존됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCCTftXhmizqF7bBbeu6pUEmYDWMUgKAQ8",
  authDomain: "hakathon-test-7a4c5.firebaseapp.com",
  projectId: "hakathon-test-7a4c5",
  storageBucket: "hakathon-test-7a4c5.firebasestorage.app",
  messagingSenderId: "823817399590",
  appId: "1:823817399590:web:08211990776225664525e7",
  measurementId: "G-Z2NL2S2VKQ"
};

// Firebase, Firestore 및 Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 (로그인 전에는 null)
let currentUser = null;

// ===================================================
// 사용자 역할(Role) 관리: 교사(teacher) / 학생(student)
// ===================================================

// 교사(Teacher) 권한을 부여할 UID 목록입니다.
// 선생님의 Google 계정 UID를 여기에 추가하시면 전체 메모 삭제/관리 권한이 주어집니다.
const TEACHER_UIDS = [
  // 선생님의 UID를 여기에 추가하세요 (예: "abc123xyz...")
];

function isTeacher(user) {
  if (!user) return false;
  return TEACHER_UIDS.includes(user.uid);
}

// ===================================================
// 로그인 상태 표시 영역 관리
// ===================================================

const userArea = document.getElementById("userArea");

function updateUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    const teacher = isTeacher(currentUser);
    const greeting = document.createElement("span");
    if (teacher) {
      greeting.innerHTML = `👩‍🏫 <strong>[교사] ${currentUser.displayName || "선생님"}</strong>님 환영합니다! (모든 메모 관리 권한) `;
    } else {
      greeting.innerHTML = `🧑‍🎓 <strong>[학생] ${currentUser.displayName || "학생"}</strong>님 환영합니다! <small style="color:#888;">(내 UID: ${currentUser.uid})</small> `;
    }
    userArea.appendChild(greeting);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });
    userArea.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("로그인 실패:", error);
        if (error.code === "auth/unauthorized-domain") {
          alert("Firebase 콘솔의 [Authentication > 설정 > 승인된 도메인]에 현재 도메인(" + window.location.hostname + ")을 추가해야 합니다.");
        } else if (error.code === "auth/configuration-not-found") {
          alert("Firebase 콘솔의 [Authentication > Sign-in method]에서 Google 로그인을 사용 설정해 주세요.");
        } else {
          alert("로그인에 실패했습니다: " + error.message);
        }
      }
    });
    userArea.appendChild(loginBtn);
  }
}


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 사용하여 메모를 읽고, 쓰고, 지웁니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 createdAt 기준 오름차순으로 정렬하여 가져옵니다.
async function loadMemos() {
  try {
    const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(function (docSnap) {
      list.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    return list;
  } catch (error) {
    console.error("메모 읽기 실패:", error);
    return [];
  }
}

// 메모를 새로 씁니다.
// 로그인한 사용자의 uid를 함께 저장하며, 5글자 이상일 때만 등록됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 쓰려면 먼저 구글 로그인을 해 주세요.");
    return;
  }
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    alert("메모는 다섯 글자 이상 입력해 주세요.");
    return;
  }
  try {
    await addDoc(collection(db, "memos"), {
      text: trimmed,
      createdAt: Date.now(),
      uid: currentUser.uid
    });
  } catch (error) {
    console.error("메모 쓰기 실패:", error);
    alert("메모 저장 실패: " + error.message);
  }
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
  }
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memoList = await loadMemos();
  memoList.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 교사(Teacher)만 모든 메모에 대해 삭제(×) 버튼이 나타납니다.
  // 학생은 다른 사람 것은 물론 삭제 권한이 없습니다 (생성 전용).
  if (currentUser && isTeacher(currentUser)) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "메모 삭제 (교사 전용)";
    del.addEventListener("click", async function () {
      if (confirm("이 메모를 삭제하시겠습니까? (교사 권한)")) {
        await deleteMemo(memo.id);
        await render();
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (!currentUser) {
      alert("메모를 쓰려면 먼저 구글 로그인을 해 주세요.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    if (text.length < 5) {
      alert("메모는 다섯 글자 이상 입력해 주세요.");
      return;
    }

    await addMemo(text);
    input.value = "";
    await render();
  }
});

// 로그인 상태 변화 감지 및 화면 초기화
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  updateUserArea();
  render();
});

input.focus();
