const express = require('express');
const path = require('path');
const fs = require('fs').promises; // 파일 시스템 모듈(Promise 기반)

const app = express();
const port = 3000;

// 현재 폴더의 정적 파일(index.html, data 폴더 등)을 제공합니다.
app.use(express.static(__dirname));

// 배열을 무작위로 섞는 헬퍼 함수
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// '/api/daily-quiz' 경로로 요청이 오면 실행될 API 엔드포인트
app.get('/api/daily-quiz', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        const files = await fs.readdir(dataDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        let allQuizzes = [];

        // 모든 json 파일을 순회하며 퀴즈 데이터를 읽어옵니다.
        for (const file of jsonFiles) {
            const filePath = path.join(dataDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const themeData = JSON.parse(fileContent);

            if (Array.isArray(themeData)) {
                const quizzesInTheme = themeData.flatMap(chapter =>
                    Array.isArray(chapter.quizzes) ? chapter.quizzes : []
                );
                allQuizzes.push(...quizzesInTheme);
            }
        }

        // 모든 퀴즈를 섞어서 10개를 선택합니다.
        const dailyQuizzes = shuffleArray(allQuizzes).slice(0, 10);
        res.json(dailyQuizzes); // 클라이언트에게 JSON 형태로 응답
    } catch (error) {
        console.error('데일리 퀴즈 생성 중 오류:', error);
        res.status(500).json({ error: '서버에서 퀴즈를 만드는 데 실패했습니다.' });
    }
});

app.listen(port, () => {
    console.log(`퀴즈 앱 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});