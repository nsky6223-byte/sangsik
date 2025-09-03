const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

/**
 * 로컬 JSON 파일에서 퀴즈를 읽어와 무작위로 10개를 반환하는 대체 함수
 * @returns {Array} 퀴즈 객체 배열
 */
function getFallbackQuizzes() {
    const dataDir = path.resolve(process.cwd(), 'data');
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

    // 배열을 무작위로 섞기 (Fisher-Yates shuffle)
    for (let i = allQuizzes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuizzes[i], allQuizzes[j]] = [allQuizzes[j], allQuizzes[i]];
    }
    return allQuizzes.slice(0, 10); // 10개의 퀴즈 선택
}

exports.handler = async function(event, context) {
    // 1. Gemini API를 통해 퀴즈 생성 시도
    try {
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
        const text = response.text();
        
        const dailyQuizzes = JSON.parse(text);

        // 생성된 데이터가 유효한지 간단히 확인
        if (!Array.isArray(dailyQuizzes) || dailyQuizzes.length === 0) {
            throw new Error("Gemini API가 유효한 퀴즈 배열을 생성하지 않았습니다.");
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dailyQuizzes),
        };

    } catch (error) {
        console.error("Gemini API 호출 실패, 대체 퀴즈를 사용합니다:", error);
        
        // 2. Gemini API 실패 시, 로컬 파일에서 퀴즈를 가져오는 대체 로직 실행
        try {
            const fallbackQuizzes = getFallbackQuizzes();
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackQuizzes),
            };
        } catch (fallbackError) {
            console.error("대체 퀴즈 로딩에도 실패했습니다:", fallbackError);
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: 'API와 로컬 파일 모두에서 퀴즈를 불러오는데 실패했습니다.' }) 
            };
        }
    }
};
