// Shared translation dictionary — used by the browser (teacher.js / student.js)
// AND by the server (for the handful of error strings it sends back), so
// there is exactly one place that knows what Chnobli says in German/English.
// German is the default language everywhere; English is opt-in via the
// toggle on the teacher's quiz setup screen, and that choice is stored on
// the room so every student in that quiz sees the same language too.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18N = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const DICT = {
    de: {
      // shell / brand
      teacherConsole: 'Lehrpult',
      pageTitleTeacher: 'Chnobli — Lehrpult',
      pageTitlePlay: 'Chnobli — Mitspielen',
      pageTitleHome: 'Chnobli',
      endQuizBtn: 'Quiz beenden',
      endQuizConfirm: 'Dieses Quiz für alle beenden? Das kann nicht rückgängig gemacht werden.',
      bottomHintTeacher: 'Projiziere diesen Bildschirm für die Klasse. Schüler:innen treten über ihr Handy unter {host} bei oder scannen den QR-Code.',

      // landing
      landingTagline: 'Die Klasse schreibt die Fragen. Alle anderen spielen live mit.',
      roleTeacherTitle: 'Ich bin die Lehrperson',
      roleTeacherDesc: 'Quiz erstellen, Fragen prüfen, Präsentation starten.',
      roleStudentTitle: 'Ich bin Schüler:in',
      roleStudentDesc: 'Mit Code oder QR-Code von der Tafel beitreten.',

      // setup
      stepSetup: 'Neues Quiz einrichten',
      newQuizCardTitle: 'Neues Quiz',
      defaultQuizTitle: 'Unbenanntes Quiz',
      quizTitleLabel: 'Quiz-Titel',
      typesLabel: 'Fragetypen, die Schüler:innen schreiben dürfen',
      languageLabel: 'Sprache',
      playerFallback: 'Spieler:in',
      createBtn: 'Erstellen & Lobby öffnen',
      createError: 'Quiz konnte nicht erstellt werden.',

      // question types (long + short form)
      type_mc: 'Multiple Choice',
      type_tf: 'Wahr / Falsch',
      type_short: 'Kurzantwort',
      type_guess: 'Zahl schätzen',
      type_mc_short: 'Auswahl',
      type_tf_short: 'W / F',
      type_short_short: 'Kurz',
      type_guess_short: 'Schätzen',

      // lobby
      stepLobby: 'Code {code} · warte auf Schüler:innen',
      joinAt: 'Beitreten auf {host}/play',
      joinedWrote: '{joined} DABEI · {wrote} HABEN IHRE FRAGE GESCHRIEBEN',
      nobodyYet: 'Noch niemand da — teile den Code!',
      reviewQuestionsBtn: 'Fragen prüfen',
      lobbyOpenBadge: 'Lobby offen',

      // review
      stepReview: 'Fragen prüfen & freigeben',
      reviewQuestionsTitle: 'Fragen prüfen',
      approvedBadge: 'Freigegeben',
      sentBackBadge: 'Zurückgeschickt',
      approveBtn: 'Freigeben',
      noQuestionsYet: 'Noch keine Fragen eingereicht.',
      approvedPending: '{approved} FREIGEGEBEN · {pending} OFFEN',
      startQuizBtn: 'Quiz starten',

      // play — active
      stepPlay: 'Frage {n} von {total}',
      byAuthor: 'von {avatar} {author}',
      skipBtn: 'Weiter',
      skipTitle: 'Jetzt auflösen',
      answerOnPhone: 'Antwort auf dem Handy eingeben',
      answeredCount: '{n} / {m} beantwortet',
      trueLabel: 'Wahr',
      falseLabel: 'Falsch',

      // play — reveal
      resultsLabel: 'Frage {n} / {total} · ERGEBNIS',
      correctSuffix: '· richtig',
      correctAnswerLabel: 'Richtige Antwort',
      showScoresBtn: 'Punktestand zeigen',

      // play — scores
      leaderboardTitle: 'Rangliste',
      afterQ: 'NACH FRAGE {n}',
      nextQuestionBtn: 'Nächste Frage',
      finalResultsBtn: 'Endergebnis',

      // podium
      stepPodium: 'Spiel beendet',
      finalResultsTitle: 'Endergebnis',
      place1: '1.', place2: '2.', place3: '3.',
      newQuizBtn: 'Neues Quiz',

      // student — join
      joinTitle: 'Quiz beitreten',
      joinSubtitle: 'Gib den Code von der Tafel ein',
      joinBtn: 'Beitreten',
      joinErrorGeneric: 'Beitritt fehlgeschlagen.',
      joinErrorCode: 'Gib den 4-stelligen Code ein.',

      // student — avatar
      makeItYours: "Mach's zu deinem",
      codeLabel: 'CODE {code}',
      pickAvatar: 'Wähle einen Avatar',
      nicknameLabel: 'Spitzname',
      nicknamePlaceholder: 'z. B. Robincode',
      enterLobbyBtn: 'Lobby betreten',
      enterNicknameFirst: 'Gib zuerst einen Spitznamen ein.',

      // student — write
      writeQuestionTitle: 'Schreib eine Frage',
      rejectedBanner: 'Deine Lehrperson bittet dich, diese Frage zu überarbeiten',
      questionPlaceholder: 'Schreib deine Frage…',
      optionPlaceholder: 'Option {n}',
      tapCorrectHint: 'Tippe auf den Kreis, um die richtige Antwort zu markieren',
      statementIs: 'Die Aussage ist…',
      acceptedAnswerLabel: 'Akzeptierte Antwort',
      acceptedAnswerPlaceholder: 'z. B. Mitochondrium',
      correctNumberLabel: 'Richtige Zahl',
      unitLabel: 'Einheit (optional)',
      unitPlaceholder: 'z. B. Knochen',
      timeLimitLabel: 'Zeitlimit',
      submitForReviewBtn: 'Zur Prüfung einreichen',
      submitErrorGeneric: 'Konnte nicht eingereicht werden.',

      // student — submitted / waiting
      submittedTitle: 'Frage eingereicht!',
      submittedBody: 'Warte, bis deine Lehrperson das Quiz prüft und startet…',
      submittedBadge: 'DU SPIELST, SOBALD ES STARTET',

      // student — locked (own question)
      lockedTitle: 'Die ist von dir!',
      lockedBody: 'Du hast diese Frage geschrieben, darum pausierst du — keine Punkte in dieser Runde.',
      answeringCount: '{n} / {m} antworten…',

      // student — waiting (already answered)
      lockedInTitle: 'Eingereicht!',
      waitingOthers: 'Warte auf die anderen…',
      answeredBadge: '{n} / {m} BEANTWORTET',

      // student — answer input
      readBoardHint: 'Schau auf die Tafel · tippe deine Antwort',
      lockInGuessBtn: 'Schätzung abschicken',
      typeYourAnswerPlaceholder: 'Antwort eingeben',
      submitAnswerBtn: 'Antwort abschicken',

      // student — reveal
      satOutTitle: 'Du hast pausiert',
      satOutBody: 'Es war deine Frage — keine Punkte, aber gut geschrieben!',
      correctTitle: 'Richtig!',
      streakBadge: '{n}er-Serie',
      placeBadge: '{rank} Platz',
      notThisTimeTitle: 'Diesmal nicht',
      timesUpTitle: 'Zeit abgelaufen',
      answerLabel: 'Antwort',
      streakResetStill: 'Serie zurückgesetzt · weiterhin {rank} Platz',

      // student — scores
      yourStanding: 'Dein Stand',
      pointsLabel: 'Punkte',
      watchBoardHint: 'Schau auf die Tafel für den Stand',

      // student — podium
      finishedRank: 'Du bist {rank} geworden!',
      goodGame: 'gutes Spiel!',
      onPodium: 'auf dem Podest!',
      youWon: 'du hast gewonnen!',
      backToJoinBtn: 'Zurück zum Beitritts-Bildschirm',

      // student — ended
      quizEndedTitle: 'Dieses Quiz ist beendet',
      quizEndedBody: 'Frag deine Lehrperson nach einem neuen Code für das nächste Quiz.',
      joinAnotherBtn: 'Ein anderes Quiz beitreten',

      // server-side error strings
      err_quizNotFound: 'Quiz nicht gefunden.',
      err_notAuthorized: 'Nicht autorisiert.',
      err_questionNotFound: 'Frage nicht gefunden.',
      err_approveAtLeastOne: 'Gib zuerst mindestens eine Frage frei.',
      err_notReady: 'Noch nicht bereit.',
      err_noQuizWithCode: 'Kein Quiz mit diesem Code gefunden.',
      err_quizAlreadyStartedJoin: 'Dieses Quiz läuft bereits — frag deine Lehrperson nach dem Code für die nächste Runde.',
      err_rejoinFirst: 'Tritt dem Quiz zuerst wieder bei.',
      err_enterNickname: 'Gib einen Spitznamen ein.',
      err_joinLobbyFirst: 'Tritt zuerst der Lobby bei.',
      err_quizAlreadyStarted: 'Das Quiz hat bereits begonnen.',
      err_alreadyApproved: 'Deine Frage wurde bereits freigegeben und kann nicht mehr bearbeitet werden.',
      err_noActiveQuestion: 'Gerade läuft keine aktive Frage.',
      err_cantAnswerOwn: 'Du kannst deine eigene Frage nicht beantworten.',
      err_alreadyAnswered: 'Bereits beantwortet.',
      err_noQuestionData: 'Keine Frage vorhanden.',
      err_unknownType: 'Unbekannter Fragetyp.',
      err_typeNotEnabled: 'Dieser Fragetyp ist für dieses Quiz nicht aktiviert.',
      err_writeQuestionFirst: 'Schreib zuerst eine Frage.',
      err_needTwoOptions: 'Füge mindestens zwei Antwortoptionen hinzu.',
      err_addAcceptedAnswer: 'Füge die akzeptierte Antwort hinzu.',
      err_addCorrectNumber: 'Füge die richtige Zahl hinzu.',
    },
    en: {
      teacherConsole: 'teacher console',
      pageTitleTeacher: 'Chnobli — Teacher',
      pageTitlePlay: 'Chnobli — Play',
      pageTitleHome: 'Chnobli',
      endQuizBtn: 'End quiz',
      endQuizConfirm: 'End this quiz for everyone? This cannot be undone.',
      bottomHintTeacher: 'Project this screen for the class. Students join on their own phones at {host} or by scanning the QR code.',

      landingTagline: 'The class writes the questions. Everyone else plays them live.',
      roleTeacherTitle: "I'm the teacher",
      roleTeacherDesc: 'Create a quiz, review questions, run the presentation.',
      roleStudentTitle: "I'm a student",
      roleStudentDesc: 'Join with the code or QR on the board.',

      stepSetup: 'Set up a new quiz',
      newQuizCardTitle: 'New quiz',
      defaultQuizTitle: 'Untitled quiz',
      quizTitleLabel: 'Quiz title',
      typesLabel: 'Question types students can write',
      languageLabel: 'Language',
      playerFallback: 'Player',
      createBtn: 'Create & open lobby',
      createError: 'Could not create the quiz.',

      type_mc: 'Multiple choice',
      type_tf: 'True / False',
      type_short: 'Short answer',
      type_guess: 'Guess the number',
      type_mc_short: 'Choice',
      type_tf_short: 'T / F',
      type_short_short: 'Short',
      type_guess_short: 'Guess',

      stepLobby: 'Code {code} · waiting for students',
      joinAt: 'Join at {host}/play',
      joinedWrote: '{joined} JOINED · {wrote} WROTE THEIR QUESTION',
      nobodyYet: 'Nobody yet — share the code!',
      reviewQuestionsBtn: 'Review questions',
      lobbyOpenBadge: 'Lobby open',

      stepReview: 'Review & approve questions',
      reviewQuestionsTitle: 'Review questions',
      approvedBadge: 'Approved',
      sentBackBadge: 'Sent back',
      approveBtn: 'Approve',
      noQuestionsYet: 'No questions submitted yet.',
      approvedPending: '{approved} APPROVED · {pending} PENDING',
      startQuizBtn: 'Start quiz',

      stepPlay: 'Question {n} of {total}',
      byAuthor: 'by {avatar} {author}',
      skipBtn: 'Skip',
      skipTitle: 'Reveal now',
      answerOnPhone: 'Answer on your phone',
      answeredCount: '{n} / {m} answered',
      trueLabel: 'True',
      falseLabel: 'False',

      resultsLabel: 'Q {n} / {total} · RESULTS',
      correctSuffix: '· correct',
      correctAnswerLabel: 'Correct answer',
      showScoresBtn: 'Show scores',

      leaderboardTitle: 'Leaderboard',
      afterQ: 'AFTER Q{n}',
      nextQuestionBtn: 'Next question',
      finalResultsBtn: 'Final results',

      stepPodium: 'Game over',
      finalResultsTitle: 'Final results',
      place1: '1st', place2: '2nd', place3: '3rd',
      newQuizBtn: 'New quiz',

      joinTitle: 'Join a quiz',
      joinSubtitle: 'Enter the code shown on the board',
      joinBtn: 'Join',
      joinErrorGeneric: 'Could not join.',
      joinErrorCode: 'Enter the 4-digit code.',

      makeItYours: 'Make it yours',
      codeLabel: 'CODE {code}',
      pickAvatar: 'Pick an avatar',
      nicknameLabel: 'Nickname',
      nicknamePlaceholder: 'e.g. Robincode',
      enterLobbyBtn: 'Enter lobby',
      enterNicknameFirst: 'Enter a nickname first.',

      writeQuestionTitle: 'Write a question',
      rejectedBanner: 'Your teacher asked you to revise this',
      questionPlaceholder: 'Type your question…',
      optionPlaceholder: 'Option {n}',
      tapCorrectHint: 'Tap the circle to mark the correct answer',
      statementIs: 'The statement is…',
      acceptedAnswerLabel: 'Accepted answer',
      acceptedAnswerPlaceholder: 'e.g. Mitochondrion',
      correctNumberLabel: 'Correct number',
      unitLabel: 'Unit (optional)',
      unitPlaceholder: 'e.g. bones',
      timeLimitLabel: 'Time limit',
      submitForReviewBtn: 'Submit for review',
      submitErrorGeneric: 'Could not submit.',

      submittedTitle: 'Question submitted!',
      submittedBody: 'Waiting for your teacher to review and start the quiz…',
      submittedBadge: "YOU'LL PLAY WHEN IT STARTS",

      lockedTitle: "This one's yours!",
      lockedBody: "You wrote this question, so you're sitting it out — no points this round.",
      answeringCount: '{n} / {m} answering…',

      lockedInTitle: 'Locked in!',
      waitingOthers: 'Waiting for everyone else…',
      answeredBadge: '{n} / {m} ANSWERED',

      readBoardHint: 'Read the board · tap your answer',
      lockInGuessBtn: 'Lock in guess',
      typeYourAnswerPlaceholder: 'Type your answer',
      submitAnswerBtn: 'Submit answer',

      satOutTitle: 'You sat this one out',
      satOutBody: 'It was your question — no points, but nice writing!',
      correctTitle: 'Correct!',
      streakBadge: '{n} streak',
      placeBadge: '{rank} place',
      notThisTimeTitle: 'Not this time',
      timesUpTitle: "Time's up",
      answerLabel: 'Answer',
      streakResetStill: 'Streak reset · still {rank} place',

      yourStanding: 'Your standing',
      pointsLabel: 'points',
      watchBoardHint: 'Watch the board for the standings',

      finishedRank: 'You finished {rank}!',
      goodGame: 'good game!',
      onPodium: 'on the podium!',
      youWon: 'you won!',
      backToJoinBtn: 'Back to join screen',

      quizEndedTitle: 'This quiz has ended',
      quizEndedBody: 'Ask your teacher for a new code to join the next one.',
      joinAnotherBtn: 'Join another quiz',

      err_quizNotFound: 'Quiz not found.',
      err_notAuthorized: 'Not authorized.',
      err_questionNotFound: 'Question not found.',
      err_approveAtLeastOne: 'Approve at least one question first.',
      err_notReady: 'Not ready.',
      err_noQuizWithCode: 'No quiz with that code.',
      err_quizAlreadyStartedJoin: 'This quiz has already started — ask your teacher for the code of the next one.',
      err_rejoinFirst: 'Rejoin the quiz first.',
      err_enterNickname: 'Enter a nickname.',
      err_joinLobbyFirst: 'Join the lobby first.',
      err_quizAlreadyStarted: 'The quiz has already started.',
      err_alreadyApproved: 'Your question was already approved and can no longer be edited.',
      err_noActiveQuestion: 'No active question right now.',
      err_cantAnswerOwn: "You can't answer your own question.",
      err_alreadyAnswered: 'Already answered.',
      err_noQuestionData: 'No question data.',
      err_unknownType: 'Unknown question type.',
      err_typeNotEnabled: 'That question type is not enabled for this quiz.',
      err_writeQuestionFirst: 'Write a question first.',
      err_needTwoOptions: 'Add at least two answer options.',
      err_addAcceptedAnswer: 'Add the accepted answer.',
      err_addCorrectNumber: 'Add the correct number.',
    },
  };

  const DEFAULT_LANG = 'de';

  function normLang(lang) {
    return lang === 'en' ? 'en' : DEFAULT_LANG;
  }

  function t(lang, key, vars) {
    const dict = DICT[normLang(lang)] || DICT[DEFAULT_LANG];
    let str = dict[key] != null ? dict[key] : (DICT[DEFAULT_LANG][key] != null ? DICT[DEFAULT_LANG][key] : key);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return str;
  }

  return { DICT, DEFAULT_LANG, normLang, t };
}));
