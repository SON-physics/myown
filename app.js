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
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
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
// 사용자 역할(Role) 관리: 최고관리자(admin) / 교사(teacher) / 학생(student)
// ===================================================

// 최고 관리자(Super Admin) 이메일 목록
// 이 구글 계정으로 로그인하면 자동으로 최고 관리자 권한이 부여됩니다.
const ADMIN_EMAILS = [
  "yool.ssam@gmail.com"
];

let currentUserRole = "student"; // "admin" | "teacher" | "student"
let currentUserStatus = "none";  // "none" | "pending" | "approved" | "rejected"

async function fetchUserRole(user) {
  if (!user) {
    currentUserRole = "student";
    currentUserStatus = "none";
    return;
  }

  // 1. 최고 관리자 확인
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    currentUserRole = "admin";
    currentUserStatus = "approved";
    return;
  }

  // 2. Firestore users 컬렉션에서 역할 및 승인 상태 확인
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      currentUserRole = data.role || "student";
      currentUserStatus = data.status || "none";
    } else {
      currentUserRole = "student";
      currentUserStatus = "none";
    }
  } catch (error) {
    console.error("사용자 권한 조회 실패:", error);
    currentUserRole = "student";
    currentUserStatus = "none";
  }
}

// ===================================================
// 로그인 상태 표시 영역 관리
// ===================================================

const userArea = document.getElementById("userArea");

async function updateUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    const greeting = document.createElement("span");

    if (currentUserRole === "admin") {
      greeting.innerHTML = `👑 <strong>[최고 관리자] ${currentUser.displayName || "관리자"}</strong>님 환영합니다! `;
      userArea.appendChild(greeting);

      // 교사 신청 승인 관리 버튼
      const manageBtn = document.createElement("button");
      manageBtn.className = "btn-action btn-primary";
      manageBtn.textContent = "교사 신청 관리";
      manageBtn.addEventListener("click", openAdminModal);
      userArea.appendChild(manageBtn);

    } else if (currentUserRole === "teacher") {
      greeting.innerHTML = `👩‍🏫 <strong>[교사] ${currentUser.displayName || "선생님"}</strong>님 환영합니다! (모든 메모 관리 권한) `;
      userArea.appendChild(greeting);

    } else {
      // 학생 계정
      if (currentUserStatus === "pending") {
        greeting.innerHTML = `🧑‍🎓 <strong>[학생] ${currentUser.displayName || "학생"}</strong>님 <span style="color:#e37400; font-weight:bold;">(교사 승인 대기 중 ⏳)</span> `;
        userArea.appendChild(greeting);
      } else if (currentUserStatus === "rejected") {
        greeting.innerHTML = `🧑‍🎓 <strong>[학생] ${currentUser.displayName || "학생"}</strong>님 <span style="color:#d93025;">(신청 반려됨)</span> `;
        userArea.appendChild(greeting);

        const reapplyBtn = document.createElement("button");
        reapplyBtn.className = "btn-action";
        reapplyBtn.textContent = "교사 다시 신청";
        reapplyBtn.addEventListener("click", openApplyModal);
        userArea.appendChild(reapplyBtn);
      } else {
        greeting.innerHTML = `🧑‍🎓 <strong>[학생] ${currentUser.displayName || "학생"}</strong>님 `;
        userArea.appendChild(greeting);

        const applyBtn = document.createElement("button");
        applyBtn.className = "btn-action";
        applyBtn.textContent = "교사 가입 신청";
        applyBtn.addEventListener("click", openApplyModal);
        userArea.appendChild(applyBtn);
      }
    }

    // 로그아웃 버튼
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn-action";
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
    loginBtn.className = "btn-action btn-primary";
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
// 교사 신청 및 최고 관리자 승인 모달 제어
// ===================================================

const applyModal = document.getElementById("applyModal");
const cancelApplyBtn = document.getElementById("cancelApplyBtn");
const submitApplyBtn = document.getElementById("submitApplyBtn");
const applyReason = document.getElementById("applyReason");

function openApplyModal() {
  if (applyModal) applyModal.style.display = "flex";
}

if (cancelApplyBtn) {
  cancelApplyBtn.addEventListener("click", function () {
    if (applyModal) applyModal.style.display = "none";
  });
}

if (submitApplyBtn) {
  submitApplyBtn.addEventListener("click", async function () {
    if (!currentUser) return;
    const reason = applyReason ? applyReason.value.trim() : "";
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        email: currentUser.email,
        displayName: currentUser.displayName || "신청자",
        role: "student",
        status: "pending",
        reason: reason,
        requestedAt: Date.now()
      }, { merge: true });

      alert("교사 가입 신청이 접수되었습니다! 최고 관리자의 승인 후 교사 권한이 주어집니다.");
      if (applyModal) applyModal.style.display = "none";
      await fetchUserRole(currentUser);
      await updateUserArea();
    } catch (error) {
      console.error("교사 신청 실패:", error);
      alert("신청 실패: " + error.message);
    }
  });
}

const adminModal = document.getElementById("adminModal");
const closeAdminModalBtn = document.getElementById("closeAdminModalBtn");
const applicantList = document.getElementById("applicantList");

async function openAdminModal() {
  if (adminModal) adminModal.style.display = "flex";
  await loadApplicants();
}

if (closeAdminModalBtn) {
  closeAdminModalBtn.addEventListener("click", function () {
    if (adminModal) adminModal.style.display = "none";
  });
}

async function loadApplicants() {
  if (!applicantList) return;
  applicantList.innerHTML = "<p style='color:#666; font-size:14px;'>불러오는 중...</p>";

  try {
    const q = query(collection(db, "users"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);

    applicantList.innerHTML = "";
    if (snapshot.empty) {
      applicantList.innerHTML = "<p style='color:#666; font-size:14px;'>현재 승인 대기 중인 교사 신청이 없습니다.</p>";
      return;
    }

    snapshot.forEach(function (docSnap) {
      const applicant = docSnap.data();
      const applicantId = docSnap.id;

      const item = document.createElement("div");
      item.className = "applicant-item";

      const info = document.createElement("div");
      info.className = "applicant-info";
      info.innerHTML = `<strong>${applicant.displayName}</strong> (${applicant.email})<br>
                        <small style="color:#666;">사유: ${applicant.reason || "없음"}</small>`;
      item.appendChild(info);

      const btnGroup = document.createElement("div");

      const approveBtn = document.createElement("button");
      approveBtn.className = "btn-action btn-primary";
      approveBtn.textContent = "승인";
      approveBtn.addEventListener("click", async function () {
        if (confirm(`${applicant.displayName}님에게 교사 권한을 승인하시겠습니까?`)) {
          try {
            await updateDoc(doc(db, "users", applicantId), {
              role: "teacher",
              status: "approved",
              approvedAt: Date.now()
            });
            alert("교사 권한이 승인되었습니다!");
            await loadApplicants();
          } catch (e) {
            alert("승인 오류: " + e.message);
          }
        }
      });
      btnGroup.appendChild(approveBtn);

      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn-action btn-danger";
      rejectBtn.textContent = "거절";
      rejectBtn.addEventListener("click", async function () {
        if (confirm(`${applicant.displayName}님의 교사 신청을 거절하시겠습니까?`)) {
          try {
            await updateDoc(doc(db, "users", applicantId), {
              status: "rejected"
            });
            alert("신청이 거절되었습니다.");
            await loadApplicants();
          } catch (e) {
            alert("거절 오류: " + e.message);
          }
        }
      });
      btnGroup.appendChild(rejectBtn);

      item.appendChild(btnGroup);
      applicantList.appendChild(item);
    });

  } catch (error) {
    console.error("신청자 목록 불러오기 실패:", error);
    applicantList.innerHTML = "<p style='color:red;'>목록 조회 실패: " + error.message + "</p>";
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

  // 최고 관리자(admin) 또는 승인된 교사(teacher)만 삭제 버튼이 노출됩니다.
  const hasManagementPermission = (currentUserRole === "admin" || currentUserRole === "teacher");

  if (currentUser && hasManagementPermission) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "메모 삭제 (관리자/교사 전용)";
    del.addEventListener("click", async function () {
      if (confirm("이 메모를 삭제하시겠습니까?")) {
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
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  await fetchUserRole(user);
  await updateUserArea();
  await render();
});

input.focus();
