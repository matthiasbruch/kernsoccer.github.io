var HtmlRenderer = function () {
  var field = document.getElementById("playingField");
  var players = [];
  var ballBody;
  var ballDisplayObject = document.createElement("div");
  ballDisplayObject.classList.add("displayObject");
  ballDisplayObject.classList.add("ball");
  ballDisplayObject.style.transform =
    "translate(" + SCREEN_WIDTH/2 + "px," + SCREEN_HEIGHT/2 + "px)";
  field.appendChild(ballDisplayObject);

  function setBall(body) {
    ballBody = body;
    ballDisplayObject.style.width = body.circleRadius * 2 + "px";
    ballDisplayObject.style.height = body.circleRadius * 2 + "px"
  }

  function addPlayer(body, color, label) {
    var displayObject = document.createElement("div");
    displayObject.classList.add("displayObject");
    displayObject.style.width = body.circleRadius * 2 + "px";
    displayObject.style.height = body.circleRadius * 2 + "px";
    if (label !== undefined) {
      displayObject.innerText = label;
    }
    displayObject.classList.add("player");
    displayObject.classList.add(color);

    field.appendChild(displayObject);

    players.push({
      body: body,
      displayObject: displayObject
    });
  };

  function removePlayer(body) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].body.id == body.id) {
        field.removeChild(players[i].displayObject);
        players.splice(i, 1);
        return;
      }
    }
  }

  function updatePlayer(player) {
    var x = player.body.position.x - player.body.circleRadius;
    var y = player.body.position.y - player.body.circleRadius;
    if (player.body.isKicking) {
      player.displayObject.classList.add("kicking");
    }
    else {
      player.displayObject.classList.remove("kicking");
    }
    player.displayObject.style.transform =
      "translate(" + x + "px," + y + "px)";
  }

  function update(engine) {
    for (var i = 0; i < players.length; i++) {
      updatePlayer(players[i]);
    }
    if (ballBody !== undefined) {
      var x = ballBody.position.x - ballBody.circleRadius;
      var y = ballBody.position.y - ballBody.circleRadius;
      ballDisplayObject.style.transform =
        "translate(" + x + "px," + y + "px)";
    }
  }

  return {
    update: update,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    setBall: setBall
  }
}();
