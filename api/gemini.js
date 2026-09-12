// ===================================================
// Gemini에게 물어보는 서버 코드가 들어올 자리 (아직 비어 있습니다)
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수에 넣습니다. (process.env 로 꺼내 씁니다)
// ===================================================

// ===================================================
// Gemini API를 호출하여 학생 메모에 대한 AI 코멘트를 생성하는 Vercel 서버리스 함수
//
// 왜 서버리스 함수(/api/gemini)를 거치나요?
//   1. Gemini API 키를 브라우저(app.js)에 노출하지 않고 안전하게 숨기기 위함입니다.
//   2. Vercel 환경변수(process.env.GEMINI_API_KEY)에서 꺼내 씁니다.
//
// 개인정보 보호 원칙 (AGENTS.md 준수):
//   학생 이름, UID, 이메일 등 식별 정보는 Gemini에 보내지 않고 오직 게시물 텍스트(text)만 전송합니다.
// ===================================================

export default async function handler(req, res) {
  // POST 메서드만 허용합니다.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { text } = req.body || {};

  // 빈 내용 검증
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "코멘트를 생성할 메모 내용(text)이 필요합니다." });
  }

  // Vercel 환경변수에서 Gemini API 키 확인
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다. Vercel 대시보드의 [Settings > Environment Variables]에 API 키를 등록해 주세요."
    });
  }

  // Google AI Studio의 무료 티어 제공 모델: gemini-2.5-flash
  const modelName = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // 프롬프트 및 시스템 지침 구성
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `[학생이 학급 담벼락에 작성한 메모]\n"${text.trim()}"`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: "당신은 초·중·고등학교 학급 담벼락 게시판을 함께 지켜보는 따뜻하고 다정한 '선생님 도우미 AI'입니다.\n학생이 남긴 메모를 읽고, 깊은 공감과 칭찬, 따뜻한 격려 혹은 생각할 거리를 건네는 친절한 피드백을 1~2문장으로 작성해 주세요.\n이모지를 자연스럽게 1~2개 곁들여 학생에게 친근하고 긍정적인 에너지를 전해 주세요."
        }
      ]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Gemini API 호출 실패 (상태 코드: ${response.status})`;
      console.error("Gemini API 호출 오류:", errorMsg);
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!comment) {
      return res.status(500).json({ error: "Gemini에서 코멘트를 생성하지 못했습니다." });
    }

    return res.status(200).json({ comment });
  } catch (error) {
    console.error("서버 내부 오류:", error);
    return res.status(500).json({ error: "코멘트 생성 중 서버 오류가 발생했습니다: " + error.message });
  }
}
