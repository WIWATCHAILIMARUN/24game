import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [gameState, setGameState] = useState('menu');
  const [roomId, setRoomId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [opponentId, setOpponentId] = useState(null);

  // My game state
  const [myNumbers, setMyNumbers] = useState([]);
  const [myOriginalNumbers, setMyOriginalNumbers] = useState([]);
  const [mySelectedNumber, setMySelectedNumber] = useState(null);
  const [mySelectedOperator, setMySelectedOperator] = useState(null);
  const [myHistory, setMyHistory] = useState([]);

  // Opponent game state
  const [opponentNumbers, setOpponentNumbers] = useState([]);
  const [opponentHistory, setOpponentHistory] = useState([]);

  const [scores, setScores] = useState({});
  const [message, setMessage] = useState('');
  const [roundNumber, setRoundNumber] = useState(1);

  // Power-ups
  const [myPowerUps, setMyPowerUps] = useState({
    shuffle: 1,
    freeze: 1,
    lock: 1,
    minus: 1
  });
  const [frozen, setFrozen] = useState(false);
  const [lockedNumbers, setLockedNumbers] = useState([]);
  const [flipped, setFlipped] = useState(false); // ✅ เพิ่ม state สำหรับ flip effect

  useEffect(() => {
    socket.on('connect', () => {
      setMyPlayerId(socket.id);
      console.log('เชื่อมต่อแล้ว:', socket.id);
    });

    socket.on('waiting', () => {
      setGameState('waiting');
      setMessage('🔍 กำลังหาคู่ต่อสู้...');
    });

    socket.on('matchFound', (data) => {
      console.log('เจอคู่แล้ว!', data);
      setRoomId(data.gameState.roomId);

      const nums = data.gameState.numbers;
      const players = data.gameState.players;
      const opponent = players.find(p => p !== socket.id);
      setOpponentId(opponent);

      setMyOriginalNumbers(nums);
      setMyNumbers(nums.map((n, i) => ({
        value: n,
        id: Date.now() + i,
        expr: n.toString()
      })));

      setOpponentNumbers(nums.map((n, i) => ({
        value: n,
        id: Date.now() + 1000 + i
      })));

      setScores(data.gameState.scores);
      setRoundNumber(data.gameState.roundNumber);
      setGameState('playing');
      setMessage('🎮 เริ่มเกม! คำนวณให้ได้ 24');
      setTimeout(() => setMessage(''), 2000);

      resetGame();
    });

    socket.on('receivePowerUp', (data) => {
      const { type } = data;
      handleReceivePowerUp(type);
    });

    socket.on('powerUpSent', (data) => {
      setMessage(`✅ ส่ง ${getPowerUpName(data.type)} แล้ว!`);
      setTimeout(() => setMessage(''), 2000);
    });

    socket.on('opponentUpdate', (data) => {
      setOpponentNumbers(data.numbers);
      if (data.history) setOpponentHistory(data.history);
    });

    socket.on('scoreDeducted', (data) => {
      setScores(data.scores);
      if (data.deductedPlayer === socket.id) {
        setMessage(`💥 ถูกลบคะแนน ${data.points} คะแนน!`);
        setTimeout(() => setMessage(''), 2000);
      }
    });

    socket.on('answerResult', (data) => {
      if (data.correct) {
        setScores(data.gameState.scores);
        if (data.playerId === socket.id) {
          setMessage('✅ ถูกต้อง! +10 คะแนน');
        } else {
          setMessage('⚠️ คู่แข่งตอบถูก!');
        }
      } else {
        if (data.playerId === socket.id) {
          setMessage(`❌ ${data.error}`);
          setTimeout(() => setMessage(''), 2000);
        }
      }
    });

    socket.on('newRound', (data) => {
      const nums = data.gameState.numbers;
      setMyOriginalNumbers(nums);
      setMyNumbers(nums.map((n, i) => ({
        value: n,
        id: Date.now() + Math.random() * 1000 + i,
        expr: n.toString()
      })));
      setOpponentNumbers(nums.map((n, i) => ({
        value: n,
        id: Date.now() + Math.random() * 1000 + 1000 + i
      })));
      setScores(data.gameState.scores);
      setRoundNumber(data.gameState.roundNumber);
      setMessage(`🔄 รอบที่ ${data.gameState.roundNumber} - เริ่ม!`);
      setTimeout(() => setMessage(''), 1500);

      resetGame();
      setMyPowerUps({
        shuffle: 1,
        freeze: 1,
        lock: 1,
        minus: 1
      });
    });

    socket.on('gameOver', (data) => {
      const myScore = data.gameState.scores[socket.id];
      const opponentScore = data.gameState.scores[opponentId];
      if (data.winner === socket.id) {
        setMessage(`🏆 คุณชนะ! (${myScore} - ${opponentScore})`);
      } else if (data.winner === null) {
        setMessage(`🤝 เสมอ! (${myScore} - ${opponentScore})`);
      } else {
        setMessage(`😢 คุณแพ้ (${myScore} - ${opponentScore})`);
      }
      setTimeout(() => {
        setGameState('menu');
        resetGame();
        setScores({});
        setRoundNumber(1);
      }, 4000);
    });

    socket.on('opponentLeft', () => {
      setMessage('⚠️ คู่แข่งออกจากเกม');
      setTimeout(() => {
        setGameState('menu');
        resetGame();
        setScores({});
        setRoundNumber(1);
      }, 2000);
    });

    return () => {
      socket.off();
    };
  }, [opponentId]);

  const resetGame = () => {
    setMySelectedNumber(null);
    setMySelectedOperator(null);
    setMyHistory([]);
    setOpponentHistory([]);
    setFrozen(false);
    setLockedNumbers([]);
    setFlipped(false);
  };

  const findMatch = () => {
    socket.emit('findMatch', { name: 'Player' });
  };

  const calculate = (a, op, b) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? Math.round((a / b) * 100) / 100 : 0;
      default: return 0;
    }
  };

  const handleNumberClick = (num) => {
    if (frozen) {
      setMessage('❄️ หน้าจอถูก Freeze!');
      return;
    }
    if (lockedNumbers.includes(num.id)) {
      setMessage('🔒 ตัวเลขนี้ถูกล็อค!');
      return;
    }
    if (mySelectedOperator === null) {
      setMySelectedNumber(num);
      setMessage('เลือกเครื่องหมาย (+, -, ×, ÷)');
    } else {
      if (num.id === mySelectedNumber.id) {
        setMessage('⚠️ ไม่สามารถเลือกตัวเลขเดิมได้');
        return;
      }
      const result = calculate(mySelectedNumber.value, mySelectedOperator, num.value);
      const exprPart = `(${mySelectedNumber.expr}${mySelectedOperator}${num.expr})`;

      const opSymbol = mySelectedOperator === '*' ? '×' : mySelectedOperator === '/' ? '÷' : mySelectedOperator;
      const historyText = `${mySelectedNumber.value} ${opSymbol} ${num.value} = ${result}`;
      const newHistory = [...myHistory, historyText];
      setMyHistory(newHistory);

      const newNumbers = myNumbers.filter(
        n => n.id !== mySelectedNumber.id && n.id !== num.id
      );
      const newNumber = {
        value: result,
        id: Date.now() + Math.random() * 1000,
        expr: exprPart
      };
      const updatedNumbers = [...newNumbers, newNumber];
      setMyNumbers(updatedNumbers);
      setMySelectedNumber(null);
      setMySelectedOperator(null);

      if (updatedNumbers.length === 1) {
        checkFinalAnswer(result, exprPart);
      } else {
        setMessage(`ได้ ${result} - คำนวณต่อ`);
      }
      broadcastMyState(updatedNumbers, newHistory);
    }
  };

  const broadcastMyState = (numbers, history) => {
    socket.emit('updateMyState', {
      roomId,
      numbers: numbers.map(n => ({ value: n.value, id: n.id })),
      history
    });
  };

  const handleOperatorClick = (op) => {
    if (frozen) {
      setMessage('❄️ หน้าจอถูก Freeze!');
      return;
    }
    if (mySelectedNumber === null) {
      setMessage('⚠️ เลือกตัวเลขก่อน');
      return;
    }
    setMySelectedOperator(op);
    setMessage('เลือกตัวเลขตัวที่สอง');
  };

  const checkFinalAnswer = (result, expression) => {
    if (Math.abs(result - 24) < 0.01) {
      setMessage('🎉 ส่งคำตอบ...');
      socket.emit('submitAnswer', { roomId, expression });
    } else {
      setMessage(`ได้ ${result} - ลองใหม่อีกครั้ง`);
    }
  };

  const usePowerUp = (type) => {
    if (myPowerUps[type] <= 0) {
      setMessage('⚠️ ไอเทมนี้ใช้หมดแล้ว!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    socket.emit('usePowerUp', {
      roomId,
      powerUpType: type,
      targetPlayerId: opponentId
    });
    setMyPowerUps({
      ...myPowerUps,
      [type]: myPowerUps[type] - 1
    });
  };

  // ✅ ปรับส่วนนี้ให้เป็น Flip 180°
  const handleReceivePowerUp = (type) => {
    switch (type) {
      case 'shuffle':
        const shuffled = [...myNumbers].sort(() => Math.random() - 0.5);
        setMyNumbers(shuffled);
        setMessage('🔄 ตัวเลขถูกรีเซ็ต!');
        setTimeout(() => setMessage(''), 2000);
        break;

      case 'freeze':
        setFrozen(true);
        setMessage('❄️ หน้าจอถูก Freeze 5 วินาที!');
        setTimeout(() => {
          setFrozen(false);
          setMessage('✅ Freeze หมดแล้ว');
          setTimeout(() => setMessage(''), 1000);
        }, 5000);
        break;

      case 'lock':
        if (myNumbers.length > 0) {
          const randomNum = myNumbers[Math.floor(Math.random() * myNumbers.length)];
          setLockedNumbers([randomNum.id]);
          setMessage('🔒 ตัวเลข 1 ตัวถูกล็อค 10 วินาที!');
          setTimeout(() => {
            setLockedNumbers([]);
            setMessage('✅ ล็อคหมดแล้ว');
            setTimeout(() => setMessage(''), 1000);
          }, 10000);
        }
        break;

      case 'minus': // 🔁 เปลี่ยนเป็นเอฟเฟกต์ Flip
        setMessage('💫 หน้าจอหมุนกลับหัว 5 วินาที!');
        setFlipped(true);
        setTimeout(() => {
          setFlipped(false);
          setMessage('✅ กลับมาแล้ว!');
          setTimeout(() => setMessage(''), 1000);
        }, 5000);
        break;
    }
  };

  const getPowerUpName = (type) => {
    const names = {
      shuffle: '🔄 รีเซ็ต',
      freeze: '❄️ Freeze',
      lock: '🔒 ล็อคปุ่ม',
      minus: '💫 Flip'
    };
    return names[type];
  };

  const clearGame = () => {
    const newNumbers = myOriginalNumbers.map((n, i) => ({
      value: n,
      id: Date.now() + Math.random() * 1000 + i,
      expr: n.toString()
    }));
    setMyNumbers(newNumbers);
    setMySelectedNumber(null);
    setMySelectedOperator(null);
    setMyHistory([]);
    setMessage('🔄 เริ่มใหม่');
    setTimeout(() => setMessage(''), 1500);
    broadcastMyState(newNumbers, []);
  };

  const getMyScore = () => scores[socket.id] || 0;
  const getOpponentScore = () => scores[opponentId] || 0;

  return (
    <div className="App">
      {gameState === 'menu' && (
        <div className="menu-overlay">
          <h1>🎮 เกม 24</h1>
          <button className="find-match-btn" onClick={findMatch}>
            🔍 หาคู่ต่อสู้
          </button>
          {message && <p className="message">{message}</p>}
        </div>
      )}

      {gameState === 'waiting' && (
        <div className="menu-overlay">
          <div className="waiting">
            <div className="spinner"></div>
            <p className="message">{message}</p>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="split-screen-container">
          <div className="score-board">
            <div className="round-info">รอบที่ {roundNumber} / 5</div>
            <div className="scores-horizontal">
              <div className="player-score my-score">
                <span className="label">คุณ</span>
                <span className="score">{getMyScore()}</span>
              </div>
              <div className="vs">VS</div>
              <div className="player-score opponent-score">
                <span className="label">คู่แข่ง</span>
                <span className="score">{getOpponentScore()}</span>
              </div>
            </div>
          </div>

          <div className={`game-panel left ${frozen ? 'frozen' : ''} ${flipped ? 'flipped' : ''}`}>
            <div className="panel-header">
              <h3>🎮 คุณ</h3>
            </div>

            <div className="instruction">คำนวณให้ได้ 24</div>

            {myHistory.length > 0 && (
              <div className="history">
                {myHistory.map((h, i) => (
                  <div key={i} className="history-item">{h}</div>
                ))}
              </div>
            )}

            <div className="numbers-grid">
              {myNumbers.map((num) => (
                <div
                  key={num.id}
                  className={`number-block ${
                    mySelectedNumber?.id === num.id ? 'selected' : ''
                  } ${
                    mySelectedOperator && mySelectedNumber?.id !== num.id ? 'selectable' : ''
                  } ${
                    lockedNumbers.includes(num.id) ? 'locked' : ''
                  }`}
                  onClick={() => handleNumberClick(num)}
                >
                  {num.value}
                  {lockedNumbers.includes(num.id) && <span className="lock-icon">🔒</span>}
                </div>
              ))}
            </div>

            <div className="operators">
              {['+', '-', '*', '/'].map((op) => (
                <button
                  key={op}
                  className={`operator-btn ${mySelectedOperator === op ? 'active' : ''}`}
                  onClick={() => handleOperatorClick(op)}
                  disabled={frozen}
                >
                  {op === '*' ? '×' : op === '/' ? '÷' : op}
                </button>
              ))}
            </div>

            <button className="clear-btn" onClick={clearGame} disabled={frozen}>
              🔄 เริ่มใหม่
            </button>

            <div className="powerups">
              <button className="powerup-btn" onClick={() => usePowerUp('shuffle')} disabled={myPowerUps.shuffle <= 0}>
                🔄 รี ({myPowerUps.shuffle})
              </button>
              <button className="powerup-btn" onClick={() => usePowerUp('freeze')} disabled={myPowerUps.freeze <= 0}>
                ❄️ Freeze ({myPowerUps.freeze})
              </button>
              <button className="powerup-btn" onClick={() => usePowerUp('lock')} disabled={myPowerUps.lock <= 0}>
                🔒 ล็อค ({myPowerUps.lock})
              </button>
              <button className="powerup-btn" onClick={() => usePowerUp('minus')} disabled={myPowerUps.minus <= 0}>
                💫 Flip ({myPowerUps.minus})
              </button>
            </div>

            <p className="message">{message}</p>
          </div>

          <div className="divider"></div>

          <div className="game-panel right">
            <div className="panel-header">
              <h3>👤 คู่แข่ง</h3>
            </div>

            <div className="instruction">คำนวณให้ได้ 24</div>

            {opponentHistory.length > 0 && (
              <div className="history">
                {opponentHistory.map((h, i) => (
                  <div key={i} className="history-item">{h}</div>
                ))}
              </div>
            )}

            <div className="numbers-grid">
              {opponentNumbers.map((num) => (
                <div key={num.id} className="number-block opponent-block">
                  {num.value}
                </div>
              ))}
            </div>

            <div className="operators">
              <button className="operator-btn" disabled>+</button>
              <button className="operator-btn" disabled>-</button>
              <button className="operator-btn" disabled>×</button>
              <button className="operator-btn" disabled>÷</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
