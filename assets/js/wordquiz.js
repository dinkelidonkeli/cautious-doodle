document.addEventListener('DOMContentLoaded', () => {
  // Get references to elements
  const startButton = document.getElementById('startWordQuiz');
  const textarea = document.getElementById('wordList');
  const quizSection = document.getElementById('quizSection');
  const question = document.getElementById('question');
  const submitButton = document.getElementById('submitAnswer');
  const userAnswer = document.getElementById('userAnswer');
  const feedback = document.getElementById('feedback');
  const restartButton = document.getElementById('restartQuiz');

  let wordPairs = [];
  let currentIndex = 0;
  let score = 0;

  // Start quiz
  startButton.addEventListener('click', (e) => {
    e.preventDefault();
    const inputText = textarea.value;
    wordPairs = inputText.split('\n').map(line => {
      const parts = line.split('-').map(p => p.trim());
      return { source: parts[0], target: parts[1] };
    }).filter(pair => pair.source && pair.target);

    if (wordPairs.length > 0) {
      currentIndex = 0;
      score = 0;
      document.getElementById('wordForm').style.display = 'none';
      quizSection.style.display = 'block';
      restartButton.style.display = 'none';
      showWord();
    }
  });

  // Submit answer
  submitButton.addEventListener('click', (e) => {
    e.preventDefault();
    const answer = userAnswer.value.trim();
    const correct = wordPairs[currentIndex].target;

    if (answer.toLowerCase() === correct.toLowerCase()) {
      feedback.textContent = "Correct!";
      score++;
    } else {
      feedback.textContent = `Incorrect. Correct answer: ${correct}`;
    }

    currentIndex++;

    if (currentIndex < wordPairs.length) {
      setTimeout(() => {
        feedback.textContent = '';
        userAnswer.value = '';
        showWord();
      }, 1000);
    } else {
      // Quiz finished
      const percentage = Math.round((score / wordPairs.length) * 100);
      feedback.textContent += ` Quiz completed! Your score: ${score}/${wordPairs.length} (${percentage}%).`;

      // Confetti if ≥70%
      if (percentage >= 70) {
        feedback.textContent += " Great job!";
        confetti({
          particleCount: 150,
          startVelocity: 30,
          spread: 90,
          origin: { y: 1 }
        });
      }
      restartButton.style.display = 'inline-block';
    }
  });

  // Allow Enter key to submit
  userAnswer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitButton.click();
    }
  });

  // Show word and focus input
  function showWord() {
    question.textContent = `Translate: ${wordPairs[currentIndex].source}`;
    userAnswer.focus();
  }

  // Restart quiz
  restartButton.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('wordForm').style.display = 'block';
    quizSection.style.display = 'none';
    restartButton.style.display = 'none';
    feedback.textContent = '';
    userAnswer.value = '';
    textarea.value = '';
    score = 0;
    textarea.focus();
  });
});