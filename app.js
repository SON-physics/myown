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

// Firebase 설정 불러오기 (클라이언트 소스코드에 API 키를 노출하지 않고 서버리스 함수에서 수신)
const configRes = await fetch("/api/config");
const firebaseConfig = await configRes.json();

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

// 최고 관리자 판별용 단방향 암호화(SHA-256) 해시 목록
// 소스코드에 선생님의 실제 이메일 주소가 전혀 노출되지 않습니다.
const ADMIN_EMAIL_HASHES = [
  "ead9a9bab6759726f0a211486cdd125f2a09515712bffcdfbab7c42f25b63fb3"
];

// 문자열을 SHA-256 해시로 변환하는 헬퍼 함수
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

let currentUserRole = "student"; // "admin" | "teacher" | "student"
let currentUserStatus = "none";  // "none" | "pending" | "approved" | "rejected"

async function fetchUserRole(user) {
  if (!user) {
    currentUserRole = "student";
    currentUserStatus = "none";
    return;
  }

  // 1. 최고 관리자 확인 (단방향 해시로 비교하여 이메일 비공개 유지)
  if (user.email) {
    const emailHash = await sha256(user.email);
    if (ADMIN_EMAIL_HASHES.includes(emailHash)) {
      currentUserRole = "admin";
      currentUserStatus = "approved";
      // Firestore users 컬렉션에도 관리자 권한 동기화 (보안 규칙 통과 보장)
      try {
        await setDoc(doc(db, "users", user.uid), { role: "admin", status: "approved" }, { merge: true });
      } catch (e) {
        console.error("관리자 상태 동기화 오류:", e);
      }
      return;
    }
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

  // 최고 관리자(admin) 또는 승인된 교사(teacher)만 관리(삭제, AI 코멘트) 권한을 가집니다.
  const hasManagementPermission = (currentUserRole === "admin" || currentUserRole === "teacher");

  // 상단 바 (삭제 버튼)
  if (currentUser && hasManagementPermission) {
    const header = document.createElement("div");
    header.className = "memo-header";

    const del = document.createElement("button");
    del.className = "memo-delete-btn";
    del.textContent = "×";
    del.title = "메모 삭제 (교사/관리자 전용)";
    del.addEventListener("click", async function () {
      if (confirm("이 메모를 삭제하시겠습니까?")) {
        await deleteMemo(memo.id);
        await render();
      }
    });
    header.appendChild(del);
    div.appendChild(header);
  }

  // 본문 텍스트
  const textElem = document.createElement("div");
  textElem.className = "memo-text";
  textElem.textContent = memo.text;
  div.appendChild(textElem);

  // AI 코멘트가 있는 경우 화면에 말풍선 박스로 표시
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-comment-box";

    const aiHeader = document.createElement("div");
    aiHeader.className = "ai-comment-header";
    aiHeader.innerHTML = "🤖 <span>선생님 도우미 AI</span>";
    aiBox.appendChild(aiHeader);

    const aiText = document.createElement("div");
    aiText.className = "ai-comment-text";
    aiText.textContent = memo.aiComment;
    aiBox.appendChild(aiText);

    div.appendChild(aiBox);
  }

  // 교사/관리자 전용: AI 코멘트 달기/재생성 버튼
  if (currentUser && hasManagementPermission) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "btn-ai";
    aiBtn.textContent = memo.aiComment ? "🔄 AI 코멘트 재생성" : "🤖 AI 코멘트 달기";
    aiBtn.title = "Gemini AI에게 격려 코멘트 작성을 요청합니다 (교사/관리자 전용)";

    aiBtn.addEventListener("click", async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "🤖 코멘트 작성 중...";

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: memo.text })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "코멘트 생성에 실패했습니다.");
        }

        // Firestore에 AI 코멘트 저장
        await updateDoc(doc(db, "memos", memo.id), {
          aiComment: data.comment,
          aiCommentedAt: Date.now()
        });

        await render();
      } catch (err) {
        console.error("AI 코멘트 생성 오류:", err);
        alert("AI 코멘트 오류: " + err.message);
        aiBtn.disabled = false;
        aiBtn.textContent = memo.aiComment ? "🔄 AI 코멘트 재생성" : "🤖 AI 코멘트 달기";
      }
    });

    div.appendChild(aiBtn);
  }

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
