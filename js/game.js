var Game = function() {
    var currentGameState = GAME_STATE.PAUSED;
    var playerList = [];
    var hud = Hud();
    var sound = Sound();
    var stateTimer;
    var lastUpdate;
    var timePlayed;
    var isOverTime = false;
    var currentKick = undefined;

    var beforePauseGameState;
    var pausingGamepadIndex = -1;
    var pauseButtonReady = true;

    var kickOffTeam;

    var menu;
    var runner;
    var playingField;
    var ball;
    var engine;
    var recorder;

    var allowDraw;
    var goalLimit = Number.POSITIVE_INFINITY;
    var timeLimit = Number.POSITIVE_INFINITY;

    var teamScores = {
      red: 0,
      blue: 0
    }

    function endKickoff() {
      if (currentGameState == GAME_STATE.KICKOFF) {
        playingField.hideBarrier();
        currentGameState = GAME_STATE.RUNNING;
      }
    }

    function pawnTouchesBall(pawn, ball) {
      endKickoff();
      if (pawn.isKicking) {
        doKick(pawn, ball);
      }
    }

    function doKick(pawn, ball) {
      pawn.isKicking = false;
      sound.playKick();
      currentKick = {
        direction: Matter.Vector.normalise(
          Matter.Vector.sub(ball.position, pawn.position)),
        ball: ball
      };
    }

    function registerHandlers() {
      Matter.Events.on(engine, "collisionActive collisionStart",
        function(event) {
          for (var i = 0; i < event.pairs.length; i++) {
            if (event.pairs[i].bodyA.isBall && event.pairs[i].bodyB.isPlayer)
            {
              pawnTouchesBall(event.pairs[i].bodyB, event.pairs[i].bodyA);
            }
            else if (event.pairs[i].bodyB.isBall && event.pairs[i].bodyA.isPlayer) {
              pawnTouchesBall(event.pairs[i].bodyA, event.pairs[i].bodyB);
            }
          }
        });

      Matter.Events.on(engine, "beforeUpdate", function(e) {
        if (currentKick !== undefined) {
          var speed = Matter.Vector.magnitude(currentKick.ball.velocity);
          var newVelocity = Matter.Vector.mult(currentKick.direction, speed);
          Matter.Body.setVelocity(currentKick.ball, newVelocity);
          var force = Matter.Vector.mult(currentKick.direction, PLAYER_KICK_FORCE);
          Matter.Body.applyForce(
            currentKick.ball,
            currentKick.ball.position,
            force);
          currentKick = undefined;
        }
      });
    };

    function showMenu() {
      window.clearTimeout(stateTimer);
      currentGameState = GAME_STATE.MENU;
      menu.show();
    }

    function updateInputs() {
      var gamepadState = navigator.getGamepads();

      for (var i = 0; i < playerList.length; i++) {
        if (gamepadState[playerList[i].gamePadIndex].buttons[PLAYER_INPUT_PAUSE].pressed && pauseButtonReady) {
          pauseGame(playerList[i].gamePadIndex);
          return;
        }
        playerList[i].update(gamepadState[playerList[i].gamePadIndex]);
      }
      if (!pauseButtonReady) {
        pauseButtonReady = !gamepadState[pausingGamepadIndex].buttons[PLAYER_INPUT_PAUSE].pressed;
      }
      checkDistanceKicks();
    }

    function pauseGame(gamePadIndex) {
      beforePauseGameState = currentGameState;
      currentGameState = GAME_STATE.PAUSED;
      pauseButtonReady = false;
      pausingGamepadIndex = gamePadIndex;
      hud.showMessage("PAUSED", "red");
      runner.enabled = false;
    }

    function updatePause() {
      var gamepadState = navigator.getGamepads();
      if (gamepadState[pausingGamepadIndex] === undefined) {
        continueGame();
        pauseButtonReady = true;
        return;
      }
      if (gamepadState[pausingGamepadIndex].buttons[PLAYER_INPUT_PAUSE].pressed && pauseButtonReady) {
        continueGame();
        return;
      }
      if (gamepadState[pausingGamepadIndex].buttons[PLAYER_INPUT_MENU].pressed) {
        hud.hideMessage();
        showMenu();
        return;
      }
      pauseButtonReady = !gamepadState[pausingGamepadIndex].buttons[PLAYER_INPUT_PAUSE].pressed;
    }

    function continueGame() {
      pauseButtonReady = false;
      currentGameState = beforePauseGameState;
      runner.enabled = true;
      hud.hideMessage();
    }

    function goalScored(scoreTeam) {
      sound.playCheer();
      var gameEnd = false;
      currentGameState = GAME_STATE.AFTER_GOAL;
      if (scoreTeam == GAME_TEAM_RED) {
        teamScores.red += 1;
        gameEnd = teamScores.red >= goalLimit;
      }
      else {
        teamScores.blue += 1;
        gameEnd = teamScores.blue >= goalLimit;
      }
      hud.updateScore(teamScores);
      if (gameEnd || isOverTime) {
        endGame(scoreTeam, true);
      }
      else {
        kickOffTeam = scoreTeam == "red"?"blue":"red";
        hud.showMessage(scoreTeam + " team scores!",
          scoreTeam == "red"?"#D24E4E":"#3A85CC", 5);
        stateTimer = window.setTimeout(function() {
          currentGameState = GAME_STATE.REPLAY;
          runner.enabled = false;
        }, GAME_AFTER_GOAL_TIME);
      }
    }

    function endGame(winner, byGoal) {
      currentGameState = GAME_STATE.ENDED;
      if (winner !== undefined) {
        sound.playCheer();
        hud.showMessage(winner + " wins the game!",
          winner == "red"?"#D24E4E":"#3A85CC");
        if (byGoal) {
          stateTimer = window.setTimeout(function() {
            currentGameState = GAME_STATE.REPLAY_END;
            runner.enabled = false;
          }, GAME_AFTER_GOAL_TIME);
        }
      }
      else {
        sound.playEnd();
        hud.showMessage("DRAW!", "white");
      }
    }

    function checkGoal() {
      //TODO: replace by constant
      if (ball.getPositionX() > playingField.rightGoalLine) {
        goalScored(GAME_TEAM_RED);
        //TODO: replace by constant
      } else if (ball.getPositionX() < playingField.leftGoalLine) {
        goalScored(GAME_TEAM_BLUE);
      }
    }

    function checkDistanceKicks() {
      for (var i = 0; i < engine.world.bodies.length; i++) {
        if (engine.world.bodies[i].isKicking) {
          var diffVector = Matter.Vector.sub(
            ball.getPosition(), engine.world.bodies[i].position);

          if (Matter.Vector.magnitudeSquared(diffVector) < 1600) {
            endKickoff();
            doKick(engine.world.bodies[i], ball.getBody());
          }
        }
      }
    }

    function updateTimer(deltaTime) {
      var newTimePlayed = timePlayed + deltaTime;
      var totalSeconds = Math.floor(newTimePlayed / 1000);
      // if seconds changed we need to update our timer display
      if (Math.floor(newTimePlayed / 1000) != Math.floor(timePlayed / 1000)) {
        hud.updateTime(totalSeconds);
      }

      if (timeLimit == totalSeconds) {
        if (teamScores.red > teamScores.blue) {
          endGame(GAME_TEAM_RED);
        } else if (teamScores.red < teamScores.blue) {
          endGame(GAME_TEAM_BLUE);
        } else if (allowDraw) {
          endGame();
        }
        else if (!isOverTime) {
          isOverTime = true;
          hud.showMessage("Overtime!", "red", 2);
        }
      }

      timePlayed = newTimePlayed;
    }

    function checkCancel() {
      var gamepadState = navigator.getGamepads();
      for (var i = 0; i < 4; i++) {
        if (gamepadState[i] !== undefined
            && gamepadState[i].buttons[PLAYER_INPUT_CANCEL].pressed) {

          return true;
        }
      }
      return false;
    }

    function update(time) {
      var deltaTime = time - lastUpdate;

      if (currentGameState == GAME_STATE.RUNNING) {
        recorder.recordTick();
        updateInputs();
        updateTimer(deltaTime);
        checkGoal();
      } else if (currentGameState == GAME_STATE.KICKOFF) {
        recorder.recordTick();
        updateInputs();
      } else if (currentGameState == GAME_STATE.AFTER_GOAL) {
        recorder.recordTick();
        updateInputs();
      } else if (currentGameState == GAME_STATE.ENDED) {
        recorder.recordTick();
        updateInputs();
        checkMenuReturn();
      } else if (currentGameState == GAME_STATE.MENU) {
        menu.update();
      } else if (currentGameState == GAME_STATE.PAUSED) {
        updatePause();
      } else if (currentGameState == GAME_STATE.REPLAY) {
        recorder.playTick();
        if (recorder.isDone() || checkCancel()) {
          runner.enabled = true;
          prepareKickoff(kickOffTeam);
          sound.playStart();
          currentGameState = GAME_STATE.KICKOFF;
        }
      } else if (currentGameState == GAME_STATE.REPLAY_END) {
        checkMenuReturn();
        recorder.playTick();
        if (recorder.isDone() || checkCancel()) {
          runner.enabled = true;
          currentGameState = GAME_STATE.ENDED;
        }
      }
      HtmlRenderer.update();
      lastUpdate = time;
      // request next animation frame
      requestAnimationFrame(update);
    };

    function checkMenuReturn() {
      var gamepadStates = navigator.getGamepads();
      for (var i = 0; i < gamepadStates.length; i++) {
        if (gamepadStates[i].buttons[PLAYER_INPUT_MENU].pressed) {
          showMenu();
          return;
        }
      }
    }

    function resetTeam(team, positionX) {
      var players = [];
      var count = 0;
      // select all players from the team and count their pawns
      for (var i = 0; i < playerList.length; i++) {
        if (playerList[i].team == team) {
          players.push(playerList[i]);
          count += playerList[i].pawnCount;
        }
      }

      var offset = GAME_PLAYER_KICKOFF_DISTANCE * (count-1) / 2;
      for (var i = 0; i < players.length; i++) {
        var positions = [];
        for (var p = 0; p < players[i].pawnCount; p++) {
          positions.push({
            label: count,
            x: positionX,
            y: SCREEN_HEIGHT/2 - offset + GAME_PLAYER_KICKOFF_DISTANCE * --count

          });
        }
        players[i].reset(positions);
      }
    }

    function prepareKickoff(team) {
      resetTeam(GAME_TEAM_RED, playingField.leftTeamLine );
      resetTeam(GAME_TEAM_BLUE, playingField.rightTeamLine );

      if (team == GAME_TEAM_RED) {
        playingField.showRightBarrier();
      }
      else {
        playingField.showLeftBarrier();
      }
      ball.reset();
      recorder = Recorder(engine.world, sound);
      sound.setRecorder(recorder);
    }


    function start(options) {
      runner.enabled = true;
      teamScores = {
        red: 0,
        blue: 0
      };
      hud.updateScore(teamScores);
      for (var i = 0; i < playerList.length; i++) {
        playerList[i].clearBodies();
      }
      playerList = [];
      for (var i = 0; i < options.players.length; i++) {
        var player = Player(
          engine,
          options.players[i].gamePadIndex,
          options.players[i].team,
          options.players[i].pawnCount);
        playerList.push(player);
      }
      pausingGamepadIndex = -1;
      timePlayed = 0;
      hud.updateTime(0);
      isOverTime = false;
      allowDraw = options.allowDraw;
      goalLimit = options.goalLimit;
      timeLimit = options.timeLimit;
      prepareKickoff(options.startingTeam);
      currentGameState = GAME_STATE.WARMUP;
      window.setTimeout(function () {
        sound.playStart();
        currentGameState = GAME_STATE.KICKOFF;
      }, 3000);
      hud.showMessageQueue([
        { text: "3", duration: 1 },
        { text: "2", duration: 1 },
        { text: "1", duration: 1 },
        { text: "GO!", duration: 1 }
      ]);
    };

    function initMatter() {
      // create a Matter.js engine with dummy renderer
      var dummyRenderer = {
          create: function() {
              return { controller: dummyRenderer };
          },
          world: function(engine) {
              // your code here to render engine.world
          }
      };
      engine = Matter.Engine.create({
        render: {
          controller: dummyRenderer
        }
      });

      engine.world.gravity.y = 0;
      runner = Matter.Runner.create();
      Matter.Engine.run(runner, engine);
    }

    function init() {
      teamScores = {
        red: 0,
        blue: 0
      }
      initMatter();
      playingField = PlayingField(engine);
      playingField.init();
      ball = Ball(engine);
      hud.updateScore(teamScores);
      menu = Menu(start);
      currentGameState = GAME_STATE.MENU;
      registerHandlers();
      lastUpdate = performance.now();
      update(lastUpdate);
    };

    return {
      start: start,
      init:init
    }
};
