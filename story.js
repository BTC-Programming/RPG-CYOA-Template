/*global displayStory setOptions gameProgress optionFlags clearOptionFlags */
// rpg-tollbooth.js
window.onload = start;

// Replace with your own AirTable API key.
// Normally, you will want to keep this private.
const key = 'keyCTEV1rBtpMeDDa'; // mine
const app_id = 'appK20CRKWRVV1mYc'; // mine
const base_url = `https://api.airtable.com/v0/${app_id}`;

// Change this to match ID in your AirTable.
const STORY_INTRO_ID = 'recYlGco11TCMd4ba'; // Start Game Scene
const CHARACTER_SELECT_ID = 'recQBB2ni4XFJtEvL' // Character Select Scene

// Start story and make initial DB requests for opening scene, saved games,
// and available characters.
function start() {
  setup();
  // Create array of requests and use Promise.all to await both responses before proceeding.
  const requests = [
    $.ajax({
      url: `${base_url}/scenes/${STORY_INTRO_ID}?api_key=${key}`,
      type: 'GET'
    }),
    $.ajax({
      url: `${base_url}/history?api_key=${key}`,
      type: 'GET'
    }),
    $.ajax({
      url: `${base_url}/characters?api_key=${key}`
    })
  ];
  Promise.all(requests)
    .then(function (data) {
      const choices = [{
        choice: '* New Game',
        target: config.OPTION_NEW_GAME
      }];
      const story = data[0].fields.story;
      data[1].records.forEach(function (record) {
        let choice = `${record.fields.character} - Turn ${record.fields.turnNumber}`;
        choices.push({ choice, target: record.id });
        gameData.savedGames[record.id] = record.fields;
      });
      data[2].records.forEach(function (record) {
        gameData.characters.push(record);
      });
      displayStory(story);
      setOptions(choices);
    })
    .catch(function (err) {
      console.log(err);
    });
}

// Save a game. Makes a POST request to the base on the first save for
// a character, and PATCH requests on follow-up saves.
function saveGame() {
  const progressData = {
    fields: {
      character: history.character,
      currentScene: [history.currentScene],
      gold: history.gold,
      hitPoints: history.hitPoints,
      flags: history.flags,
      turnNumber: history.turnNumber
    }
  };
  let url = `${base_url}/history?api_key=${key}`;
  let type = 'POST';

  if (history.id) {
    url = `${base_url}/history/${history.id}?api_key=${key}`;
    type = 'PATCH';
  }
  buttonElement.innerHTML = 'Saving game...';
  $.ajax({ url, type, data: progressData })
    .done(function (data) {
      buttonElement.innerHTML = 'What will you do?';
      history.id = data.id;
      history.saveNumber += 1;
      gameData.savedGames[data.id] = data.fields;
      gameData.touchedSinceSave = false;
      getScene(history.currentScene, true);
    })
    .fail(function (err) {
      console.log(err);
    });
}

// Get the scene and option info. Advance the game turn number.
function getScene(record_id, resume = false) {
  history.currentScene = record_id;
  if (!resume) {
    history.turnNumber += 1;
    gameData.touchedSinceSave = true;
  }
  if (optionFlags[record_id]) {
    history.flags.push(optionFlags[record_id]);
  }
  clearOptionFlags();

  $.ajax({
    url: `${base_url}/scenes/${record_id}?api_key=${key}`,
    type: 'GET'
  })
    .done(function (data) {
      // Once AJAX request returns data, we destructure
      // it and store it in variables.
      let choices = [];
      let { title, story, special } = data.fields;
      if (data.fields.special) {
        switch(special) {
          case "M8":
            alert("Play Mastermind!");
            break;
          default:
            console.log('special:', data.fields.special);
        }
      }	  
      // Don't bother if the scene doesn't have any choices.
      else if (data.fields.choices) {
        // Collect AirTable queries for every choice into an array.
        for (let idx = 0; idx < data.fields.choices.length; idx++) {
          choices.push($.ajax({
          url: `${base_url}/choices/${data.fields.choices[idx]}?api_key=${key}`,
            type: 'GET'
          }));
        }
        // Use Promise.all() to wait until every query in the array
        // has been returned before proceeding.
        Promise.all(choices)
          .then(function (data) {
            let targetArray = [];
            for (let idx = 0; idx < data.length; idx++) {
              // Destructure the necessary fields.
              // targets is an array
              console.log(data[idx]);
              let {
                choice,
                targets,
                flag,
                requiredFlags,
                blockingFlags } = data[idx].fields;
              if (optionIsVisible(requiredFlags, blockingFlags)) {
                targetArray.push({ choice: choice, target: targets[0], flag: flag ? flag[0] : null });
              }
            }
            displayStory(story);
            setOptions(targetArray);
          })
          .catch(function (err) {
            console.log(err);
          });
      } else {
        displayStory(story);
        // No options available.
        setOptions(null);
      }
    })
    .fail(function (err) {
      console.log(err);
    });
}

// Start a new game or resume a previously saved game.
function getNewOrSavedStory(value) {
  if (value === config.OPTION_NEW_GAME) {
    gameData.currentGameState = config.SELECT_CHARACTER;

    const choices = [];
    $.ajax({
        url: `${base_url}/scenes/${CHARACTER_SELECT_ID}?api_key=${key}`,
        type: 'GET'
      })
        .done(function (data) {
          displayStory(data.fields.story);
          gameData.characters.forEach(function (character) {
            let {
              name,
              charClass,
              firstScene,
              flag
            } = character.fields;
            let choice = `${name} the ${charClass}`;
            choices.push({ choice, target: firstScene[0], flag: flag[0] });
          });
          setOptions(choices);
        })
        .fail(function (err) {
          console.log(err);
        });
  } else if (gameData.savedGames[value]) {
    gameData.currentGameState = config.PLAY_GAME;
    resumeGame(value, gameData.savedGames[value]);
  } else {
    console.log('ERROR: Saved game could not be found.');
  }
}

// Build current game progress data from saved game data.
function resumeGame(record_id, progressData) {
  history.id = record_id;
  history.character = progressData.character;
  history.gold = parseInt(progressData.gold);
  history.hitPoints = parseInt(progressData.hitPoints);
  history.flags = [].concat(progressData.flags);
  history.turnNumber = parseInt(progressData.turnNumber);
  getScene(progressData.currentScene, true);
}

// Update game progress with the selected character.
function getCharacterSelection(value) {
  let character = gameData.characters.find(function (element) {
    return element.fields.firstScene[0] === value;
  })
  if (character) {
    gameData.currentGameState = config.PLAY_GAME;
    history.character = `${character.fields.name} the ${character.fields.charClass}`;
    getScene(value);
  } else {
    console.log('ERROR: Character could not be found.');
  }
}
