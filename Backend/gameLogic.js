// gameLogic.js
const solvableSets = require('./solvableSets');

class GameLogic {
  // สุ่มเลือกชุดตัวเลขจากไฟล์ solvableSets.js
  static generateNumbers() {
    const randomSet = solvableSets[
      Math.floor(Math.random() * solvableSets.length)
    ];
    return this.shuffleArray([...randomSet]);
  }

  // ฟังก์ชันสับเปลี่ยนตัวเลข
  static shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ตรวจสอบว่า expression ใช้ตัวเลขถูกต้องหรือไม่
  static validateExpression(expression, originalNumbers) {
    try {
      console.log('🔍 Expression ที่ได้รับ:', expression);
      console.log('🔢 ตัวเลขต้นฉบับ:', originalNumbers);
      
      // ลบช่องว่างออก
      let cleanExpr = expression.replace(/\s+/g, '');
      
      // แปลง × และ ÷ เป็น * และ /
      cleanExpr = cleanExpr.replace(/×/g, '*').replace(/÷/g, '/');
      
      console.log('✨ Expression หลังทำความสะอาด:', cleanExpr);
      
      // แยกตัวเลขออกมา (รองรับทศนิยมด้วย)
      const numbersInExpr = cleanExpr.match(/\d+\.?\d*/g);
      
      if (!numbersInExpr || numbersInExpr.length !== 4) {
        console.log('❌ ใช้ตัวเลขไม่ครบ 4 ตัว');
        return {
          valid: false,
          error: 'ต้องใช้ตัวเลขครบ 4 ตัว'
        };
      }

      // เช็คว่าตัวเลขตรงกับที่กำหนดหรือไม่
      const exprNumbers = numbersInExpr.map(n => parseFloat(n)).sort((a, b) => a - b);
      const sortedOriginal = [...originalNumbers].sort((a, b) => a - b);
      
      console.log('📊 ตัวเลขใน expression:', exprNumbers);
      console.log('📊 ตัวเลขต้นฉบับ:', sortedOriginal);
      
      const numbersMatch = exprNumbers.length === sortedOriginal.length && 
        exprNumbers.every((num, idx) => Math.abs(num - sortedOriginal[idx]) < 0.01);
      
      if (!numbersMatch) {
        console.log('❌ ใช้ตัวเลขไม่ถูกต้อง');
        return {
          valid: false,
          error: 'ใช้ตัวเลขไม่ถูกต้อง'
        };
      }

      // คำนวณผลลัพธ์
      let result;
      try {
        result = eval(cleanExpr);
      } catch (evalError) {
        console.log('❌ คำนวณไม่ได้:', evalError.message);
        return {
          valid: false,
          error: 'สูตรคำนวณไม่ถูกต้อง'
        };
      }
      
      console.log('🧮 ผลลัพธ์:', result);
      
      // เช็คว่าได้ 24 หรือไม่
      if (Math.abs(result - 24) < 0.01) {
        console.log('✅ ถูกต้อง!');
        return {
          valid: true,
          result: result
        };
      } else {
        console.log(`❌ ได้ ${result} ไม่ใช่ 24`);
        return {
          valid: false,
          error: `ผลลัพธ์ได้ ${result} ไม่ใช่ 24`
        };
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
      return {
        valid: false,
        error: 'สูตรไม่ถูกต้อง: ' + error.message
      };
    }
  }
}

module.exports = GameLogic;
