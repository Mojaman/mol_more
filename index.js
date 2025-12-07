const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// サーバー側に favicon を明示的に返すよう追加
app.get("/favicon.ico", (req, res) => res.status(204).end());
//ここまではコピペ(多分)
console.log("molモット！");

// 検索用　gensiStatusReload
//////////////////////////////////////////////////////////////////////////////////////

let players = {};
// let playerCount = 0;
//let playersID = {};
//let gensiInfo = {};
let rooms = {}; //{roomId:}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("disconnect", (reason) => {
    console.log("disconnected:", socket.id, "reason:", reason);
    io.sockets.to(players[socket.id]).emit("player-left");
  });

  socket.on("matching", (roomId) => {
    // console.log("matching");
    io.to(socket.id).emit("checkedMatching", roomId in rooms);
  });

  //部屋が一つもない時の処理は？？？
  socket.on("strayMatching", (condition) => {
    //部屋番号は1から数える
    let number;
    let beforeNum = 0;
    let makableRoomNum = 0;
    let strayCount = 0;
    // console.log("strayMatching");
    //存在しないなら作成、存在して1人なら入る
    for (const roomNum in rooms) {
      if (roomNum.length >= 9) {
        number = roomNum.substring(8);
        number = parseInt(number);
        strayCount++;
        //部屋番号が一つ前の部屋番号より2以上大きい(部屋をとばしてる)か
        if (number - beforeNum > 1 && makableRoomNum === 0) {
          makableRoomNum = beforeNum + 1;
        } else {
          beforeNum = number;
          // console.log("makableRoomNum:" + makableRoomNum);
        }
        
        if (rooms[roomNum].playerCount === 1) {
          //returnして部屋に参加
          //console.log(roomNum)
          joinRoom(roomNum, condition)
          return;
        }
       
      }
      //console.log("number:" + number);
    }
    //入れなかったので部屋を作成させる
    if (makableRoomNum === 0) {
      makableRoomNum = strayCount + 1;
    }

    //作成！
    
    
    io.to(socket.id).emit("makeStrayRoom", makableRoomNum);
  });

  //部屋作成
  socket.on("makeroom", (random, condition, setId) => {
    let roomId;

    if (setId) {
      roomId = setId;
    } else {
      roomId = Math.random().toString(36).slice(-8);
    }

    if (roomId in rooms) {
      io.to(socket.id).emit("unusableId");
      return;
    }

    //これ再戦時初期化されてる？どこで？
    console.log("roomId:" + roomId);
    rooms[roomId] = {
      players: {},
      playerCount: 0,
      gensiInfo: {
        publicgensi1: null,
        publicgensi2: null,
        publicgensi3: null,
        publicgensi4: null,
        publicgensi5: null,
        publicgensi6: null,
      },
      turn: random,
      first: random,
      points: {
        1: 0,
        2: 0,
      },
      finishCondition: condition,
      isOnemore: {
        1: false,
        2: false,
      },
      names: {
        1: null,
        2: null,
      },
      bunsiInfo:{
        //プレイヤー番号
        1: {
          //分子index(自分から見て左から)
          //h,c,n,o
          0: [0,0,0,0],
          1: [0,0,0,0],
          2: [0,0,0,0],
          3: [0,0,0,0],
        },
        2: {
          //分子index(自分から見て左から)
          0: [0,0,0,0],
          1: [0,0,0,0],
          2: [0,0,0,0],
          3: [0,0,0,0],
        },
      }
    };

    // プレイヤーを部屋に追加
    rooms[roomId].playerCount++;
    rooms[roomId].players[socket.id] = {
      number: rooms[roomId].playerCount,
      gensi1: null,
      gensi2: null,
      gensi3: null,
      roomId: roomId,
    };

    players[socket.id] = roomId;

    socket.join(roomId);
    socket.emit("room-created", roomId);
    socket.emit("player-joined", rooms[roomId].playerCount, roomId);
    socket.emit("sendFinishCondition", rooms[roomId].finishCondition);
    players[socket.id] = roomId;
    console.log(
      `プレイヤー${rooms[roomId].playerCount}が部屋${roomId}に参加しました`,
    );
  });

  socket.on("joinroom", (roomId, condition) => {
   joinRoom(roomId, condition);
  });

  function joinRoom(roomId, condition) {
    if (rooms[roomId] && rooms[roomId].playerCount < 2) {
      rooms[roomId].playerCount++;
      rooms[roomId].players[socket.id] = {
        number: rooms[roomId].playerCount,
        gensi1: null,
        gensi2: null,
        gensi3: null,
        roomId: roomId,
      };

      // console.log(rooms[roomId].finishCondition, condition)
      if ((rooms[roomId].finishCondition === 0 && condition === 1) || (rooms[roomId].finishCondition === 1 && condition === 0) || (rooms[roomId].finishCondition === 2 && condition === 2)){
        rooms[roomId].finishCondition = Math.floor(Math.random() * 2);
        // console.log("conditionをランダムにしました" + rooms[roomId].finishCondition)
      }else if ((rooms[roomId].finishCondition === 2 && condition === 0) || (rooms[roomId].finishCondition === 0 && condition === 2)) {
        rooms[roomId].finishCondition = 0;
        // console.log("conditionを0にしました" + rooms[roomId].finishCondition)
      }else if ((rooms[roomId].finishCondition === 2 && condition === 1) || (rooms[roomId].finishCondition === 1 && condition === 2)) {
        rooms[roomId].finishCondition = 1;
        // console.log("conditionを1にしました" + rooms[roomId].finishCondition)
      };

      

      socket.join(roomId);
      socket.emit("player-joined", rooms[roomId].playerCount, roomId);
      console.log(
        `プレイヤー${rooms[roomId].playerCount}が部屋${roomId}に参加しました`,
      );

      // 部屋が満員になったらゲーム開始
      if (rooms[roomId].playerCount === 2) {
        socket.to(roomId).emit("game-start");
        //なんでこれ部屋に入っている人にだけ送らるのか？？↓
        socket.emit("game-start");
        
        // game-start後にfinishConditionを送信
        // setTimeout(() => {
        //   io.to(roomId).emit("sendFinishCondition", rooms[roomId].finishCondition);
        // }, 100);
      }
    } else {
      socket.emit("room-full");
    }
  };

  socket.on("disconnect", () => {
    // 部屋からプレイヤーを削除
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        console.log(
          `プレイヤー${rooms[roomId].players[socket.id].number}が部屋${roomId}から退出しました`,
        );

        io.to(roomId).emit("player-left");
        delete rooms[roomId];
        

        // 部屋が一人になったら削除
        // if (rooms[roomId].playerCount === 1) {
        //   delete rooms[roomId];
        //   console.log(`部屋${roomId}が削除されました`);
        // }
        break;
      }
    }
  });

  socket.on("reloadTurn", (roomId) => {
    let turn = rooms[roomId].turn;
    if (turn === 1) {
      turn = 2;
    } else {
      turn = 1;
    }
    let isCountTurn = turn === rooms[roomId].first;
    rooms[roomId].turn = turn;
    io.to(roomId).emit("nextTurn", rooms[roomId].turn, isCountTurn);

    //とりあえずスタート後に読み込まれそうなここにおいとく
    io.to(roomId).emit("sendFinishCondition", rooms[roomId].finishCondition);
  });

  //修正の余地あり
  socket.on("sendGensiCard1", (gensi1) => {
    // 部屋システムでプレイヤーを検索
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id].gensi1 = gensi1;
        // console.log("gensi1:" + gensi1 + "を受け取りました");
        break;
      }
    }
  });

  socket.on("sendGensiCard2", (gensi2) => {
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id].gensi2 = gensi2;
        // console.log("gensi2:" + gensi2 + "を受け取りました");
        break;
      }
    }
  });

  socket.on("sendGensiCard3", (gensi3) => {
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        rooms[roomId].players[socket.id].gensi3 = gensi3;
        // console.log("gensi3:" + gensi3 + "を受け取りました");
        break;
      }
    }
  });

  socket.on("reLoad", (playerNum) => {
    // console.log("リロードしました");

    // 部屋システムでプレイヤーを検索(なにこれ)
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        const room = rooms[roomId];
        const player = room.players[socket.id];

        if (playerNum === 1) {
          room.gensiInfo.publicgensi1 = player.gensi1;
          room.gensiInfo.publicgensi2 = player.gensi2;
          room.gensiInfo.publicgensi3 = player.gensi3;
        } else {
          room.gensiInfo.publicgensi4 = player.gensi1;
          room.gensiInfo.publicgensi5 = player.gensi2;
          room.gensiInfo.publicgensi6 = player.gensi3;
        }

        // console.log(room.gensiInfo);
        //socket.emit("reLoadedNewGensi", room.gensiInfo);
        io.to(roomId).emit("reLoadedNewGensi", room.gensiInfo);
        break;
      }
    }
  });

  socket.on("gensiStatus", (roomId, gensiStatus) => {
    // console.log("gensiStatus:" + gensiStatus);
    io.to(roomId).emit("gensiStatusReload", gensiStatus);
    // console.log("送られてきたroomId:" + roomId);
  });

  socket.on("selectedGensiCard", (roomId, publicNum) => {
    // console.log("selectedGensiCard:" + publicNum);
    io.to(roomId).emit("reloadDisplay", publicNum);
  });

  socket.on("sendDisplayReset", (roomId) => {
    // console.log(roomId);
    io.to(roomId).emit("displayReset");
  });

  socket.on("emitWhatBunsi", (roomId, bunsiNum) => {
    // console.log("bunsiNum:" + bunsiNum);
    io.to(roomId).emit("reLoadWhatBunsi", bunsiNum);
  });

  socket.on("alert", (roomId, message) => {
    io.to(roomId).emit("sentAlert", message);
  });

  socket.on("sendMix", (roomId, gensiP) => {
    io.to(roomId).emit("mix", gensiP);
    // console.log("mix");
  });

  socket.on("socketReloadBlank", (roomId, blank) => {
    io.to(roomId).emit("reloadBlank", blank);
  });

  socket.on("socketAddPoint", (roomId, point, playerNumber) => {
    rooms[roomId].points[playerNumber] += point;
    io.to(roomId).emit(
      "addPoint",
      rooms[roomId].points[playerNumber],
      playerNumber,
    );
  });

  socket.on("socketFinishGame", (roomId) => {
    // console.log("ゲーム終了!");
    io.to(roomId).emit("finishGame");
  });

  socket.on("isOnemore", (roomId, playerNum) => {
    rooms[roomId].isOnemore[playerNum] = true;
    //ここではまだ初期化はしない
    if (rooms[roomId].isOnemore[1] && rooms[roomId].isOnemore[2]) {
      rooms[roomId].isOnemore[1] = false;
      rooms[roomId].isOnemore[2] = false;
      //前回の敗者が先手、引き分けならランダムにする処理
      if (rooms[roomId].points[1] > rooms[roomId].points[2]) {
        rooms[roomId].turn = 2;
      } else if (rooms[roomId].points[1] < rooms[roomId].points[2]) {
        rooms[roomId].turn = 1;
      } else {
        rooms[roomId].turn = Math.floor(Math.random() * 2) + 1;
      }
      rooms[roomId].first = rooms[roomId].turn;

      rooms[roomId].points[1] = 0;
      rooms[roomId].points[2] = 0;
      io.to(roomId).emit("onemoreGame");
    }
  });

  socket.on("setPlayerName", (roomId, name, num) => {
    rooms[roomId].names[num] = name;
    // console.log(roomId + "プレイヤー" + num + "の名前は" + name);

    io.to(roomId).emit("reloadPlayerName", rooms[roomId].names)
  });

  socket.on("sendStockBunsi", (roomId, displayInfo, dataNum, playerNum) => {
    if (!rooms[roomId]) {
      // roomIdが未定義の場合、エラー処理を行う
      console.error("Room not found:", roomId, displayInfo, dataNum, playerNum);
      return;
    }

    if (!rooms[roomId].bunsiInfo) {
      // bunsiInfoが未定義の場合、エラー処理を行う
      console.error("bunsiInfo is missing in room:", roomId);
      return;
    }

    if (playerNum !== 1 && playerNum !== 2) {
      // playerNumが1または2でない場合、エラー処理を行う
      console.error("Invalid player number:", playerNum);
      return;
    }

    //rooms[roomId].bunsiInfo[playerNum][dataNum] = displayInfo;
    rooms[roomId].bunsiInfo[playerNum][dataNum] = displayInfo;

    io.to(roomId).emit("reloadStockBunsi", playerNum, displayInfo, dataNum);
  });

  //クライアント側に分子の情報を渡すやつ
  socket.on("getBunsiInfo", (roomId) => {
    io.to(socket.id).emit("getBunsiInfo_response", rooms[roomId].bunsiInfo);
  });

  socket.on("updatePublicGensi", (roomId, gensoArray) => {
    for(let i = 0; i < gensoArray.length; i++) {
      if(gensoArray[i]) {
        rooms[roomId].gensiInfo["publicgensi" + (i + 1)] = gensoArray[i];
      }
    }
console.log(gensoArray);
    io.to(roomId).emit("updatePublicGensi_response", rooms[roomId].gensiInfo);
  });

  socket.on("debug", (roomId) => {
    //io.to(roomId).emit("mix")
    console.log(rooms[roomId].gensiInfo);
  });

 

  //ここより上に処理をかく
});

// Bind to 0.0.0.0 on port 5000 for external access
server.listen(5000, "0.0.0.0", () => {
  console.log("Listening on port 5000");
});
