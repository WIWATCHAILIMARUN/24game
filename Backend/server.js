const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const GameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const gameRooms = new Map();
const waitingPlayers = [];

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.numbers = GameLogic.generateNumbers();
    this.scores = {};
    this.gameState = 'waiting';
    this.roundNumber = 1;
    this.maxRounds = 5;
  }

  addPlayer(socketId, playerName) {
    this.players.push(socketId);
    this.scores[socketId] = 0;
    
    if (this.players.length === 2) {
      this.gameState = 'playing';
    }
  }

  nextRound() {
    this.roundNumber++;
    this.numbers = GameLogic.generateNumbers();
    
    if (this.roundNumber > this.maxRounds) {
      this.gameState = 'finished';
    }
  }

  addScore(socketId, points) {
    if (this.scores[socketId] !== undefined) {
      this.scores[socketId] += points;
    }
  }

  getGameState() {
    return {
      roomId: this.roomId,
      players: this.players,
      numbers: this.numbers,
      scores: this.scores,
      gameState: this.gameState,
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds
    };
  }
}

io.on('connection', (socket) => {
  console.log(`✅ ผู้เล่นเชื่อมต่อ: ${socket.id}`);

  socket.on('findMatch', (playerData) => {
    console.log(`🔍 ${socket.id} กำลังหาคู่...`);
    
    if (waitingPlayers.length > 0) {
      const opponent = waitingPlayers.shift();
      const roomId = `room_${Date.now()}`;
      
      const room = new GameRoom(roomId);
      room.addPlayer(socket.id, playerData.name || 'Player 1');
      room.addPlayer(opponent.id, opponent.name || 'Player 2');
      
      gameRooms.set(roomId, room);
      
      socket.join(roomId);
      opponent.socket.join(roomId);
      
      io.to(roomId).emit('matchFound', {
        roomId: roomId,
        gameState: room.getGameState()
      });
      
      console.log(`✅ จับคู่สำเร็จ! Room: ${roomId}`);
      console.log(`📊 ตัวเลขรอบแรก:`, room.numbers);
      
    } else {
      waitingPlayers.push({
        id: socket.id,
        socket: socket,
        name: playerData.name || 'Player'
      });
      
      socket.emit('waiting', { message: 'กำลังหาคู่ต่อสู้...' });
      console.log(`⏳ ${socket.id} รออยู่ในคิว`);
    }
  });

  socket.on('submitAnswer', (data) => {
    const { roomId, expression } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) {
      console.log(`❌ ไม่พบห้อง: ${roomId}`);
      socket.emit('error', { message: 'ไม่พบห้องเกม' });
      return;
    }

    console.log(`📝 ${socket.id} ส่งคำตอบ: ${expression}`);
    console.log(`🔢 ตัวเลขที่ถูกต้อง:`, room.numbers);

    const validation = GameLogic.validateExpression(expression, room.numbers);
    
    console.log(`✔️ ผลการตรวจ:`, validation);
    
    if (validation.valid) {
      room.addScore(socket.id, 10);
      
      console.log(`🎉 ถูกต้อง! คะแนนปัจจุบัน:`, room.scores);
      
      io.to(roomId).emit('answerResult', {
        playerId: socket.id,
        correct: true,
        expression: expression,
        gameState: room.getGameState()
      });

      setTimeout(() => {
        room.nextRound();
        
        console.log(`🔄 รอบที่ ${room.roundNumber}, สถานะ: ${room.gameState}`);
        
        if (room.gameState === 'finished') {
          const winner = getWinner(room);
          console.log(`🏆 จบเกม! ผู้ชนะ:`, winner);
          
          io.to(roomId).emit('gameOver', {
            gameState: room.getGameState(),
            winner: winner
          });
          
          gameRooms.delete(roomId);
        } else {
          console.log(`📊 ตัวเลขรอบใหม่:`, room.numbers);
          
          io.to(roomId).emit('newRound', {
            gameState: room.getGameState()
          });
        }
      }, 1500);
      
    } else {
      console.log(`❌ ผิด:`, validation.error);
      
      socket.emit('answerResult', {
        playerId: socket.id,
        correct: false,
        error: validation.error,
        expression: expression
      });
    }
  });

  socket.on('usePowerUp', (data) => {
    const { roomId, powerUpType, targetPlayerId } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) return;

    console.log(`🎯 ${socket.id} ใช้ ${powerUpType} กับ ${targetPlayerId}`);

    io.to(targetPlayerId).emit('receivePowerUp', {
      type: powerUpType,
      from: socket.id
    });

    socket.emit('powerUpSent', {
      type: powerUpType,
      message: 'ส่งไอเทมสำเร็จ!'
    });
  });

  socket.on('deductScore', (data) => {
    const { roomId, playerId, points } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) return;

    const currentScore = room.scores[playerId] || 0;
    room.scores[playerId] = Math.max(0, currentScore - points);

    console.log(`💥 ลบคะแนน ${playerId}: ${currentScore} → ${room.scores[playerId]}`);

    io.to(roomId).emit('scoreDeducted', {
      scores: room.scores,
      deductedPlayer: playerId,
      points: points
    });
  });

  socket.on('updateMyState', (data) => {
    const { roomId, numbers, history } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) return;

    const opponent = room.players.find(p => p !== socket.id);
    if (opponent) {
      io.to(opponent).emit('opponentUpdate', {
        numbers,
        history
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ ผู้เล่นออก: ${socket.id}`);
    
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex > -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }
    
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.includes(socket.id)) {
        socket.to(roomId).emit('opponentLeft', {
          message: 'คู่ต่อสู้ออกจากเกม'
        });
        
        gameRooms.delete(roomId);
        break;
      }
    }
  });
});

function getWinner(room) {
  const scores = room.scores;
  const players = room.players;
  
  if (scores[players[0]] > scores[players[1]]) {
    return players[0];
  } else if (scores[players[1]] > scores[players[0]]) {
    return players[1];
  } else {
    return null;
  }
}

app.get('/', (req, res) => {
  res.json({ 
    message: 'Game 24 Server กำลังทำงาน!',
    activeRooms: gameRooms.size,
    waitingPlayers: waitingPlayers.length
  });
});

app.get('/status', (req, res) => {
  res.json({
    activeRooms: gameRooms.size,
    waitingPlayers: waitingPlayers.length,
    totalConnections: io.engine.clientsCount
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server ทำงานที่ port ${PORT}`);
});