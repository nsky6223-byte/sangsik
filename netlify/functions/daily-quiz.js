const fs = require('fs');
const path = require('path');

// 배열을 무작위로 섞는 헬퍼 함수
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

exports.handler = async function(event, context) {
    try {
        // 프로젝트 루트의 'data' 디렉토리 경로를 찾습니다.
        const dataDir = path.resolve(process.cwd(), 'data');
        const files = fs.readdirSync(dataDir);

        let allQuizzes = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(dataDir, file);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const quizData = JSON.parse(fileContent);
                
                // 각 JSON 파일은 챕터 배열이므로, 그 안의 quizzes 배열을 모두 합칩니다.
                if (Array.isArray(quizData)) {
                    const flattenedQuizzes = quizData.flatMap(chapter => chapter.quizzes || []);
                    allQuizzes.push(...flattenedQuizzes);
                }
            }
        }

        const shuffledQuizzes = shuffleArray(allQuizzes);
        const dailyQuizzes = shuffledQuizzes.slice(0, 10); // 10개의 랜덤 퀴즈 선택

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dailyQuizzes),
        };
    } catch (error) {
        console.error("Error in daily-quiz function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load daily quizzes.' }) };
    }
};
