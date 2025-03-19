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

  const rewardImages = [
    'images/praise/1.webp',
    'images/praise/2.webp',
    'images/praise/3.webp',
    'images/praise/4.webp',
    'images/praise/5.webp',
    'images/praise/6.webp',
    'images/praise/7.webp',
    'images/praise/8.webp',
    'images/praise/9.webp'
  ];

  // --- File Upload ---
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const fileContent = event.target.result;
        textarea.value = fileContent;
      };
      reader.readAsText(file);
    }
  });

  // --- Load preloaded word list ---
  async function loadPreloadedWords(numberOfWords = 10) {
    try {
      // Muuta fetch-kutsua, jotta se hakee tiedoston assets-hakemistosta
      const response = await fetch('assets/data/responsquizWordse.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const allWords = await response.json();
  
      if (allWords.length < numberOfWords) {
        alert(`Word list does not contain enough words. Required: ${numberOfWords}, Available: ${allWords.length}`);
        return;
      }
  
      // Fisher-Yates shuffle
      const shuffled = [...allWords]; // Tee kopio
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
  
      wordPairs = shuffled.slice(0, numberOfWords);
  
      startQuiz();
    } catch (error) {
      console.error('Failed to load preloaded words:', error);
      alert('Failed to load default word list. Check console for details.');
    }
  }

  // --- Start quiz ---
  startButton.addEventListener('click', (e) => {
    e.preventDefault();

    const inputText = textarea.value.trim();

    if (inputText === '') {
      loadPreloadedWords();
      return;
    }

    wordPairs = inputText.split('\n').map(line => {
      const parts = line.split('-').map(p => p.trim());
      return { source: parts[0], target: parts[1] };
    }).filter(pair => pair.source && pair.target);

    if (wordPairs.length > 0) {
      startQuiz();
    } else {
      alert("Please input valid word pairs or leave blank to use default list!");
    }
  });

  // --- Function to start quiz ---
  function startQuiz() {
    currentIndex = 0;
    score = 0;
    attempts = 0;
    document.getElementById('wordForm').style.display = 'none';
    quizSection.style.display = 'block';
    restartButton.style.display = 'none';
    popupReward.style.display = 'none';
    submitButton.style.display = 'inline-block';
    showWord();
  }

  // --- Submit answer ---
  submitButton.addEventListener('click', (e) => {
    e.preventDefault();

    const answer = userAnswer.value.trim();
    const correct = question.dataset.correct;

    if (answer.toLowerCase() === correct.toLowerCase()) {
      feedback.textContent = "Great job! That's correct!";
      feedback.classList.remove('incorrectAnswer');
      feedback.classList.add('correctAnswer');
      score++;
      attempts = 0;
      moveToNextWord();
    } else {
      attempts++;
      feedback.classList.remove('correctAnswer');
      feedback.classList.add('incorrectAnswer');
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

  // --- Allow Enter key for submitting ---
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

  // --- Show current word ---
  function showWord() {
    feedback.classList.remove('correctAnswer', 'incorrectAnswer');
    const askSource = Math.random() < 0.5;

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

  // --- Move to next or finish ---
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

      submitButton.style.display = 'none';
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
    submitButton.style.display = 'inline-block';
    score = 0;
    attempts = 0;
    textarea.focus();
  });

  // --- Close reward pop-up ---
  closePopup.addEventListener('click', () => {
    popupReward.style.display = 'none';
  });
});