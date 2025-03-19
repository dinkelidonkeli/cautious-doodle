document.addEventListener('DOMContentLoaded', () => {
  // --- Element references ---
  const startButton = document.getElementById('startWordQuiz');
  const textarea = document.getElementById('wordList');
  const quizSection = document.getElementById('quizSection');
  const question = document.getElementById('question');
  const submitButton = document.getElementById('submitAnswer');
  const userAnswer = document.getElementById('userAnswer');
  const feedback = document.getElementById('feedback');
  const restartButton = document.getElementById('restartQuiz');
  const rewardGif = document.getElementById('rewardGif');
  const popupReward = document.getElementById('popupReward');
  const closePopup = document.getElementById('closePopup');
  const fileInput = document.getElementById('fileInput'); // File upload input

  // --- Data ---
  let wordPairs = []; // Array of {source, target}
  let currentIndex = 0;
  let score = 0;
  let attempts = 0;

  // List of reward images
  const rewardImages = [
    'images/praise/1.webp',
    'images/praise/2.webp',
    'images/praise/3.webp',
    'images/praise/4.webp',
    'images/praise/5.webp',
    'images/praise/6.webp',
    'images/praise/7.webp',
    'images/praise/8.webp'
  ];

  // --- File Upload ---
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const fileContent = event.target.result;
        textarea.value = fileContent; // Fill textarea with file content
      };
      reader.readAsText(file);
    }
  });

  // --- Start quiz ---
  startButton.addEventListener('click', (e) => {
    e.preventDefault();

    // Parse word list from textarea
    const inputText = textarea.value;
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
      submitButton.style.display = 'inline-block'; // Show submit button
      showWord();
    }
  });

  // --- Submit answer ---
  submitButton.addEventListener('click', (e) => {
    e.preventDefault();

    const answer = userAnswer.value.trim();
    const correct = question.dataset.correct; // Get correct answer based on random direction

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

  // --- Allow Enter key for submitting answer ---
  userAnswer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitButton.click();
    }
  });

  // --- Allow Enter key for starting quiz ---
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startButton.click();
    }
  });

  // --- Show current word (random direction) ---
  function showWord() {
    const askSource = Math.random() < 0.5; // 50% chance to swap

    if (askSource) {
      question.textContent = `Translate: ${wordPairs[currentIndex].source}`;
      question.dataset.correct = wordPairs[currentIndex].target;
    } else {
      question.textContent = `Translate: ${wordPairs[currentIndex].target}`;
      question.dataset.correct = wordPairs[currentIndex].source;
    }

    userAnswer.value = '';
    userAnswer.focus();
  }

  // --- Move to next word or finish ---
  function moveToNextWord() {
    currentIndex++;
    if (currentIndex < wordPairs.length) {
      setTimeout(() => {
        feedback.textContent = '';
        showWord();
      }, 1000);
    } else {
      const percentage = Math.round((score / wordPairs.length) * 100);
      feedback.textContent = `Quiz completed! Your score: ${score}/${wordPairs.length} (${percentage}%).`;

      // Confetti + reward if ≥ 70%
      if (percentage >= 70) {
        feedback.textContent += " Fantastic work!";
        confetti({
          particleCount: 150,
          startVelocity: 30,
          spread: 90,
          origin: { y: 1 }
        });

        const randomIndex = Math.floor(Math.random() * rewardImages.length);
        rewardGif.src = rewardImages[randomIndex];
        popupReward.style.display = 'block';
      }

      submitButton.style.display = 'none'; // Hide submit button
      restartButton.style.display = 'inline-block';
    }
  }

  // --- Restart quiz ---
  restartButton.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('wordForm').style.display = 'block';
    quizSection.style.display = 'none';
    restartButton.style.display = 'none';
    feedback.textContent = '';
    userAnswer.value = '';
    textarea.value = '';
    popupReward.style.display = 'none';
    submitButton.style.display = 'inline-block'; // Show submit again
    score = 0;
    attempts = 0;
    textarea.focus();
  });

  // --- Close reward pop-up ---
  closePopup.addEventListener('click', () => {
    popupReward.style.display = 'none';
  });
});