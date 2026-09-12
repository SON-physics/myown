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

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===================================================
// 브라우저 고유 작성자 ID 발급 및 유지
// 로그인 없이도 내 브라우저에서 쓴 메모만 식별하기 위함입니다.
// ===================================================

function getAuthorId() {
  let id = localStorage.getItem("class_wall_author_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    localStorage.setItem("class_wall_author_id", id);
  }
  return id;
}

const myAuthorId = getAuthorId();

// 상단 안내 영역
const userArea = document.getElementById("userArea");
if (userArea) {
  userArea.innerHTML = "💡 <strong>로그인 없이 바로 이용하실 수 있습니다.</strong> (내가 쓴 메모에만 삭제 버튼이 보입니다)";
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
// 내 브라우저 고유 ID(myAuthorId)를 함께 저장하며, 5글자 이상일 때만 등록됩니다.
async function addMemo(text) {
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    alert("메모는 다섯 글자 이상 입력해 주세요.");
    return;
  }
  try {
    await addDoc(collection(db, "memos"), {
      text: trimmed,
      createdAt: Date.now(),
      authorId: myAuthorId
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

  // 내 브라우저에서 작성한 메모인 경우에만 삭제(×) 버튼을 보여줍니다.
  if (memo.authorId && memo.authorId === myAuthorId) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      await deleteMemo(memo.id);
      await render();
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

// 첫 화면 그리기 및 입력창 포커스
render();
input.focus();
