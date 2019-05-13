/* eslint-disable no-unused-vars */
/*global config gameData getScene OPENING_SCENE_ID */
// webhelper.js
var buttonElement = document.getElementById("button1");
var currentStoryElement = document.getElementById("currentStory");
var dropdown = document.getElementById("choices");
var messages = [];
var choices;
var answer;
var textTimer;

// Track in-game progress for saves.
var gameProgress = {
  id: null,
  character: null,
  currentScene: null,
  gold: 25,
  hitPoints: 10,
  flags: [],
  turnNumber: 0
};

var config = {
  START_GAME: 'START_GAME',
  SELECT_CHARACTER: 'SELECT_CHARACTER',
  PLAY_GAME: 'PLAY_GAME',
  GAME_OVER: 'GAME_OVER',
  OPTION_NEW_GAME: 'OPTION_NEW_GAME',
  OPTION_SAVE_GAME: 'OPTION_SAVE_GAME'
};

// Track game state and keep information pulled from Airtable that we don't
// want to have to request again later.
var gameData = {
  currentGameState: config.START_GAME,
  optionFlags: [],
  characters: [],
  savedGames: {},
  touchedSinceSave: false
};

var optionFlags = {};

function setup() {
  setOptions([{ choice: "", target: "" }]);
  buttonElement.innerHTML = "What will you do?"; 
  buttonElement
    .addEventListener("click", handleClick);
    // .setAttribute("onclick", "getScene(dropdown.value)");
}

// This will return false if the character does not have the required flag
// for a choice or if the character has the blocking flag for the choise.
// Otherwise it will return true.
function optionIsVisible(requiredFlags, blockingFlags) {
  if (requiredFlags)  {
    for (let idx = 0; idx < requiredFlags.length; idx++) {
      if (!gameProgress.flags.includes(requiredFlags[idx])) {
        return false;
      }
    }
  }
  if (blockingFlags) {
    for (let idx = 0; idx < blockingFlags.length; idx++) {
      if (gameProgress.flags.includes(blockingFlags[idx])) {
        return false;
      }
    }
  }
  return true;
}

// Use game state to determine how to handle the button click.
function handleClick() {
  switch (gameData.currentGameState) {
    case config.START_GAME:
      getNewOrSavedStory(dropdown.value);
      break;
    case config.SELECT_CHARACTER:
      getCharacterSelection(dropdown.value);
      break;
    default:
      if (dropdown.value === config.OPTION_SAVE_GAME) {
        saveGame();
      } else {
        getScene(dropdown.value);
      }
  }
}

function addOptionFlag(target, flag) {
  optionFlags[target] = flag;
}

function clearOptionFlags() {
  Object.keys(optionFlags).forEach(function (key) {
    delete optionFlags[key];
  });
}

function setOptions(options) {
  var dropdown = document.getElementById("choices");
  
  while (dropdown.options.length) {
      dropdown.remove(0);
  }
  if (options) {
    for (var i = 0; i < options.length; i++) {
      // This is object-oriented JavaScript (hence capital letter)
      var option = new Option(options[i].choice, options[i].target);
      dropdown.options.add(option);
      if (options[i].flag) {
        addOptionFlag(options[i].target, options[i].flag);
      }
    }
    appendGameOptions();
  } else {
    buttonElement.innerHTML = 'The End';
    buttonElement.setAttribute('disabled', 'true');
  }
}

function appendGameOptions() {
  let option;
  if (playingGame() && gameData.touchedSinceSave) {
    option = new Option('* Save Game', 'OPTION_SAVE_GAME');
    dropdown.options.add(option);
  }
}

function playingGame() {
  return gameData.currentGameState === config.PLAY_GAME;
}

function displayStory(text) {
    currentStoryElement.innerHTML = text;
}

function getCharacterName(character) {
  return character.split(' ')[0];
}
