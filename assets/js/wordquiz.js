document.addEventListener('DOMContentLoaded', () => {
  // Get references to elements
  const startButton = document.getElementById('startWordQuiz');
  const textarea = document.getElementById('wordList');
  const quizSection = document.getElementById('quizSection');
  const question = document.getElementById('question');
  const submitButton = document.getElementById('submitAnswer');
  const userAnswer = document.getElementById('userAnswer');
  const feedback = document.getElementById('feedback');

  let wordPairs = []; // Array to store word pairs
  let currentIndex = 0; // Track which word we're on

  // Event: Start quiz when button clicked
  startButton.addEventListener('click', (e) => {
    e.preventDefault();

    // Get text input, split by lines
    const inputText = textarea.value;
    wordPairs = inputText.split('\n').map(line => {
      const parts = line.split('-').map(p => p.trim()); // Split by dash, remove spaces
      return { source: parts[0], target: parts[1] }; // Store as object
    }).filter(pair => pair.source && pair.target); // Ignore empty lines

    // If there are valid word pairs, start quiz
    if (wordPairs.length > 0) {
      currentIndex = 0;
      document.getElementById('wordForm').style.display = 'none';
      quizSection.style.display = 'block';
      showWord(); // Display first word
    }
  });

  // Event: Submit answer
  submitButton.addEventListener('click', (e) => {
    e.preventDefault();

    const answer = userAnswer.value.trim();
    const correct = wordPairs[currentIndex].target;

    // Check if answer is correct
    if (answer.toLowerCase() === correct.toLowerCase()) {
      feedback.textContent = "Correct!";
    } else {
      feedback.textContent = `Incorrect. Correct answer: ${correct}`;
    }

    currentIndex++;

    // If there are more words, continue quiz
    if (currentIndex < wordPairs.length) {
      setTimeout(() => {
        feedback.textContent = '';
        userAnswer.value = '';
        showWord(); // Show next word
      }, 1000);
    } else {
      // End of quiz
      feedback.textContent += " Quiz completed!";
    }
  });

  // Function: Show current word question
  function showWord() {
    question.textContent = `Translate: ${wordPairs[currentIndex].source}`;
  }
});