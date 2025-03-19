document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const startButton = document.getElementById('startWordQuiz');
  const textArea = document.getElementById('wordList');
  const quizSection = document.getElementById('quizSection');
  const question = document.getElementById('question');
  const submitButton = document.getElementById('submitAnswer');
  const userAnswer = document.getElementById('userAnswer');
  const feedback = document.getElementById('feedback');
  const restartButton = document.getElementById('restartQuiz');
  const rewardGif = document.getElementById('rewardGif');
  const popupReward = document.getElementById('popupReward');
  const closePopup = document.getElementById('closePopup');

  let wordPairs = [];
  let currentIndex = 0;
  let score = 0;
  let attempts = 0;

  const rewardImages = [
    'images/praise/1.webp',
    'images/praise/2.webp',
    'images/praise/3.webp'
  ];
  // Setting focus to text area
  document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('textArea').focus();
  });

  // Start quiz
  startButton.addEventListener('click', (e) => {
    e.preventDefault();
    const inputText = textArea.value;
    wordPairs = inputText.split('\n').map(line => {
      const parts = line.split('-').map(p => p.trim());
      return { source: parts[0], target: parts[1] };
    }).filter(pair => pair.source && pair.target);

    if (wordPairs.length > 0) {
      currentIndex = 0;
      score = 0;
      attempts = 0;
      document.getElementById('wordForm').style.display = 'none';
      quizSection.style.display = 'block';
      restartButton.style.display = 'none';
      popupReward.style.display = 'none';
      showWord();
    }
  });

  // Submit answer
  submitButton.addEventListener('click', (e) => {
    e.preventDefault();
    const answer = userAnswer.value.trim();
    const correct = wordPairs[currentIndex].target;

    if (answer.toLowerCase() === correct.toLowerCase()) {
      feedback.textContent = "Great job! That's correct!";
      score++;
      attempts = 0;
      moveToNextWord();
    } else {
      attempts++;
      if (attempts < 3) {
        feedback.textContent = `Almost there! Try again! (${attempts}/3)`;
        userAnswer.value = '';
        userAnswer.focus();
      } else {
        feedback.textContent = `Don't worry! The correct answer was: ${correct}`;
        attempts = 0;
        moveToNextWord();
      }
    }
  });

  // Allow Enter key
  userAnswer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitButton.click();
    }
  });

  // Show word
  function showWord() {
    question.textContent = `Translate: ${wordPairs[currentIndex].source}`;
    userAnswer.focus();
  }

  // Move to next or finish
  function moveToNextWord() {
    currentIndex++;
    if (currentIndex < wordPairs.length) {
      setTimeout(() => {
        feedback.textContent = '';
        userAnswer.value = '';
        showWord();
      }, 1000);
    } else {
      const percentage = Math.round((score / wordPairs.length) * 100);
      feedback.textContent = `Quiz completed! Your score: ${score}/${wordPairs.length} (${percentage}%).`;

      if (percentage >= 70) {
        feedback.textContent += " Fantastic work!";
        confetti({
          particleCount: 150,
          startVelocity: 30,
          spread: 90,
          origin: { y: 1 }
        });

        // Random GIF pop-up
        const randomIndex = Math.floor(Math.random() * rewardImages.length);
        rewardGif.src = rewardImages[randomIndex];
        popupReward.style.display = 'block';
      }
      restartButton.style.display = 'inline-block';
    }
  }

  // Restart quiz
  restartButton.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('wordForm').style.display = 'block';
    quizSection.style.display = 'none';
    restartButton.style.display = 'none';
    feedback.textContent = '';
    userAnswer.value = '';
    textArea.value = '';
    popupReward.style.display = 'none';
    score = 0;
    attempts = 0;
    textArea.focus();
  });

  // Close popup
  closePopup.addEventListener('click', () => {
    popupReward.style.display = 'none';
  });
});