const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

/**
 * 로컬 JSON 파일에서 퀴즈를 읽어와 무작위로 10개를 반환하는 대체 함수
 */
function getFallbackQuizzes() {
    console.log("Using fallback quizzes.");
    // Netlify 함수 환경에서 파일 경로를 더 안정적으로 찾기 위해 __dirname을 사용합니다.
    // __dirname은 현재 실행 중인 스크립트(daily-quiz.js)가 위치한 디렉토리입니다.
    // ../../data 는 netlify/functions/ 에서 두 단계 위로 올라가 data/ 디렉토리를 찾습니다.
    const dataDir = path.resolve(__dirname, '../../data');
    const files = fs.readdirSync(dataDir);
    let allQuizzes = [];

    for (const file of files) {
        if (file.endsWith('.json')) {
            const filePath = path.join(dataDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const quizData = JSON.parse(fileContent);
            if (Array.isArray(quizData)) {
                const flattenedQuizzes = quizData.flatMap(chapter => chapter.quizzes || []);
                allQuizzes.push(...flattenedQuizzes);
            }
        }
    }

    for (let i = allQuizzes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuizzes[i], allQuizzes[j]] = [allQuizzes[j], allQuizzes[i]];
    }
    return allQuizzes.slice(0, 10);
}

exports.handler = async function(event, context) {
    // 1. Gemini API를 통해 퀴즈 생성 시도
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set.");
        }
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        당신은 상식 퀴즈를 만드는 유용한 어시스턴트입니다.
        오늘의 상식 퀴즈 10개를 생성해주세요. 주제는 역사, 과학, 문화, 시사 등 다양하게 포함해주세요.
        결과는 반드시 유효한 JSON 배열 형태로만 제공해야 합니다. 각 객체는 "question", "options"(4개의 문자열 배열), "answer"(options 중 하나), "explanation"(정답에 대한 1~2문장의 설명) 키를 가져야 합니다.
        JSON 배열 외에 다른 텍스트, 주석, 마크다운(\`\`\`json)을 포함하지 마세요. 전체 응답이 JSON.parse()로 파싱 가능해야 합니다.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            throw new Error("Gemini API returned no content. The response may have been blocked due to safety settings or other reasons.");
        }

        let text = response.text();
        
        // Gemini API가 ```json ... ``` 형식으로 응답하는 경우가 있으므로, 순수 JSON만 추출합니다.
        const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
            text = jsonMatch[1].trim();
        }

        const dailyQuizzes = JSON.parse(text);

        if (!Array.isArray(dailyQuizzes) || dailyQuizzes.length === 0) {
            throw new Error("Gemini API did not return a valid quiz array.");
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dailyQuizzes),
        };

    } catch (error) {
        console.error("Gemini API call failed, using fallback:", error);
        
        // 2. Gemini API 실패 시, 로컬 파일에서 퀴즈를 가져오는 대체 로직 실행
        try {
            const fallbackQuizzes = getFallbackQuizzes();
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackQuizzes),
            };
        } catch (fallbackError) {
            console.error("Fallback quiz loading also failed:", fallbackError);
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: 'Failed to load quizzes from both API and local files.' }) 
            };
        }
    }
};
