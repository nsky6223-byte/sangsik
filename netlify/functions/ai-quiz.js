// Netlify Function to generate a quiz using an AI service

exports.handler = async (event, context) => {
    // 1. Netlify 환경 변수에서 Google AI API 키를 가져옵니다. (변수 이름은 Netlify 설정과 일치해야 합니다)
    const apiKey = process.env.GOOGLE_API_KEY;

    // API 키가 설정되지 않았으면 에러를 반환합니다. (변수 이름에 주의하세요!)
    if (!apiKey) {
        console.error("GOOGLE_API_KEY is not set in Netlify environment variables.");
        return {
            statusCode: 500, // Internal Server Error
            body: JSON.stringify({ error: "서버 설정 오류: API 키가 구성되지 않았습니다." }),
        };
    }

    // 2. AI에게 보낼 프롬프트를 작성합니다.
    const theme = event.queryStringParameters.theme || 'JavaScript'; // URL 파라미터에서 주제를 가져옵니다.
    const prompt = `"${theme}" 주제에 대한 객관식 퀴즈 1개를 생성해줘. 4개의 선택지가 있고 정답은 1개여야 해. 아래 JSON 형식에 맞춰서 응답해줘.
        {
          "question": "질문 내용",
          "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
          "answer": "정답 내용"
        }
        다른 설명 없이 JSON 객체만 응답해줘.`;

    try {
        // 3. Google AI (Gemini) API를 호출합니다.
        // 엔드포인트와 요청 방식이 OpenAI와 다릅니다.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // 요청 본문 구조가 OpenAI와 다릅니다.
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            }),
        });

        // API 응답이 실패하면 에러를 발생시킵니다.
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Google AI API Error:', errorData);
            throw new Error(`Google AI API returned status ${response.status}`);
        }

        const data = await response.json();

        // Google AI 응답이 비어있거나 형식이 다를 경우를 대비한 방어 코드
        if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            console.error('Invalid response structure from Google AI:', data);
            throw new Error('Unexpected response format from Google AI API.');
        }

        // 응답에서 텍스트를 추출하는 방식이 OpenAI와 다릅니다.
        // 응답에 불필요한 마크다운(` ```json ... ``` `)이 포함될 수 있어 제거합니다.
        const aiResponseText = data.candidates[0].content.parts[0].text
                                  .replace(/```json/g, '')
                                  .replace(/```/g, '');

        // 4. AI의 텍스트 응답이 유효한 JSON인지 확인하고 클라이언트에 반환합니다.
        // 이 과정에서 JSON.parse를 시도하여 형식을 검증합니다.
        JSON.parse(aiResponseText); // 유효하지 않으면 여기서 에러가 발생하여 catch 블록으로 이동합니다.

        return { statusCode: 200, body: aiResponseText, headers: { 'Content-Type': 'application/json' } };

    } catch (error) {
        console.error('AI quiz function error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'AI 서비스로부터 퀴즈를 가져오는 중 오류가 발생했습니다.' }) };
    }
};